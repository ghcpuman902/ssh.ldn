"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import {
  LONDON_CENTER,
} from "@/lib/map/config"
import {
  osmGridCellKey,
  osmGridCellsForViewport,
  osmGridFetchLimitForZoom,
  prioritizeOsmGridCells,
} from "@/lib/map/osm-grid"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"

const DEBOUNCE_MS = 350
const BATCH_GAP_MS = 150

const mergeNightlifeCollections = (
  existing: NightlifeFeatureCollection | null,
  incoming: NightlifeFeatureCollection
): NightlifeFeatureCollection => {
  const byId = new Map<string, NightlifeFeatureCollection["features"][number]>()

  for (const feature of existing?.features ?? []) {
    byId.set(feature.properties.featureId, feature)
  }

  for (const feature of incoming.features) {
    byId.set(feature.properties.featureId, feature)
  }

  return {
    type: "FeatureCollection",
    features: [...byId.values()],
    meta: incoming.meta ?? existing?.meta,
  }
}

export const useViewportNightlifeGeoJson = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean
) => {
  const fetchedKeysRef = useRef(new Set<string>())
  const [geoJson, setGeoJson] = useState<NightlifeFeatureCollection | null>(null)
  const abortControllersRef = useRef(new Set<AbortController>())
  const processingRef = useRef(false)

  const fetchGridCell = useCallback(async (row: number, col: number) => {
    const key = osmGridCellKey(row, col)
    if (fetchedKeysRef.current.has(key)) return

    const controller = new AbortController()
    abortControllersRef.current.add(controller)

    try {
      const params = new URLSearchParams({
        row: String(row),
        col: String(col),
      })
      const response = await fetch(
        `/api/discovery/osm/nightlife?${params.toString()}`,
        { signal: controller.signal }
      )

      if (!response.ok) return

      const data = (await response.json()) as NightlifeFeatureCollection
      fetchedKeysRef.current.add(key)
      setGeoJson((current) => mergeNightlifeCollections(current, data))
    } catch {
      // keep previously merged features visible
    } finally {
      abortControllersRef.current.delete(controller)
    }
  }, [])

  const loadForViewport = useCallback(async () => {
    const map = mapRef.current?.getMap()
    if (!map || processingRef.current) return

    const bounds = map.getBounds()
    const zoom = map.getZoom()
    const cells = osmGridCellsForViewport({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    })

    const center = map.getCenter()
    const pending = prioritizeOsmGridCells(
      cells.filter(
        (cell) => !fetchedKeysRef.current.has(osmGridCellKey(cell.row, cell.col))
      ),
      { latitude: center.lat, longitude: center.lng },
      LONDON_CENTER
    )

    if (pending.length === 0) return

    processingRef.current = true
    const limit = osmGridFetchLimitForZoom(zoom)
    const batch = pending.slice(0, limit)

    try {
      for (const cell of batch) {
        await fetchGridCell(cell.row, cell.col)
      }
    } finally {
      processingRef.current = false
    }

    const remaining = pending.length - batch.length
    if (remaining > 0) {
      window.setTimeout(() => {
        void loadForViewport()
      }, BATCH_GAP_MS)
    }
  }, [fetchGridCell, mapRef])

  useEffect(() => {
    if (!enabled) return

    const map = mapRef.current?.getMap()
    if (!map) return

    let timeout: ReturnType<typeof setTimeout> | undefined

    const scheduleLoad = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        void loadForViewport()
      }, DEBOUNCE_MS)
    }

    scheduleLoad()
    map.on("moveend", scheduleLoad)

    return () => {
      if (timeout) clearTimeout(timeout)
      map.off("moveend", scheduleLoad)
      for (const controller of abortControllersRef.current) {
        controller.abort()
      }
      abortControllersRef.current.clear()
    }
  }, [enabled, loadForViewport, mapRef])

  return geoJson
}
