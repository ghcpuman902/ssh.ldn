"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"
import { mutate } from "swr"

import {
  fetchNightlifeCell,
  nightlifeCellApiKey,
} from "@/lib/client/nightlife-cell-cache"
import { LONDON_CENTER } from "@/lib/map/config"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"
import {
  osmGridCellKey,
  osmGridCellsForViewport,
  osmGridFetchLimitForZoom,
  prioritizeOsmGridCells,
} from "@/lib/map/osm-grid"

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

const loadNightlifeCell = async (row: number, col: number, signal?: AbortSignal) => {
  const key = nightlifeCellApiKey(row, col)

  return mutate(
    key,
    async () => {
      const data = await fetchNightlifeCell(row, col, signal)
      if (!data) {
        throw new Error(`Nightlife cell fetch failed: ${key}`)
      }

      return data
    },
    {
      populateCache: true,
      revalidate: false,
    }
  )
}

export type NightlifeViewportState = {
  geoJson: NightlifeFeatureCollection | null
  /** True while a viewport batch is in flight. */
  isFetching: boolean
  /** True after the first viewport load attempt has finished (success or empty). */
  hasSettledInitial: boolean
}

export const useViewportNightlifeGeoJson = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean
): NightlifeViewportState => {
  const fetchedKeysRef = useRef(new Set<string>())
  const [geoJson, setGeoJson] = useState<NightlifeFeatureCollection | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [hasSettledInitial, setHasSettledInitial] = useState(false)
  const abortControllersRef = useRef(new Set<AbortController>())
  const processingRef = useRef(false)
  const mapRefStable = useRef(mapRef)
  mapRefStable.current = mapRef

  const fetchGridCell = useCallback(async (row: number, col: number) => {
    const key = osmGridCellKey(row, col)
    if (fetchedKeysRef.current.has(key)) return

    const controller = new AbortController()
    abortControllersRef.current.add(controller)

    try {
      const data = await loadNightlifeCell(row, col, controller.signal)
      if (!data) return

      fetchedKeysRef.current.add(key)
      setGeoJson((current) => mergeNightlifeCollections(current, data))
    } catch {
      // Aborted or failed — leave cell unfetched so a later pass can retry
    } finally {
      abortControllersRef.current.delete(controller)
    }
  }, [])

  const loadForViewport = useCallback(async () => {
    const map = mapRefStable.current.current?.getMap()
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

    if (pending.length === 0) {
      setHasSettledInitial(true)
      return
    }

    processingRef.current = true
    setIsFetching(true)
    const limit = osmGridFetchLimitForZoom(zoom)
    const batch = pending.slice(0, limit)

    try {
      for (const cell of batch) {
        await fetchGridCell(cell.row, cell.col)
      }
    } finally {
      processingRef.current = false
      setIsFetching(false)
      setHasSettledInitial(true)
    }

    const remaining = pending.length - batch.length
    if (remaining > 0) {
      window.setTimeout(() => {
        void loadForViewport()
      }, BATCH_GAP_MS)
    }
  }, [fetchGridCell])

  const loadForViewportRef = useRef(loadForViewport)
  loadForViewportRef.current = loadForViewport

  useEffect(() => {
    if (!enabled) return

    const map = mapRefStable.current.current?.getMap()
    if (!map) return

    let timeout: ReturnType<typeof setTimeout> | undefined

    const scheduleLoad = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        void loadForViewportRef.current()
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
  }, [enabled])

  return { geoJson, isFetching, hasSettledInitial }
}
