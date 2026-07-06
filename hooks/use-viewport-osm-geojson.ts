"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import { LONDON_CENTER } from "@/lib/map/config"
import {
  osmGridCellKey,
  osmGridCellsForViewport,
  osmGridFetchLimitForZoom,
  prioritizeOsmGridCells,
} from "@/lib/map/osm-grid"

const DEBOUNCE_MS = 350
const BATCH_GAP_MS = 150

type FeatureCollection = {
  type: "FeatureCollection"
  features: Array<{ properties: Record<string, unknown> }>
  meta?: Record<string, unknown>
}

const mergeFeatureCollections = <T extends FeatureCollection>(
  existing: T | null,
  incoming: T,
  getFeatureId: (feature: T["features"][number]) => string,
): T => {
  const byId = new Map<string, T["features"][number]>()

  for (const feature of existing?.features ?? []) {
    byId.set(getFeatureId(feature), feature)
  }

  for (const feature of incoming.features) {
    byId.set(getFeatureId(feature), feature)
  }

  return {
    ...incoming,
    features: [...byId.values()] as T["features"],
    meta: incoming.meta ?? existing?.meta,
  } as T
}

type ViewportOsmGeoJsonOptions<T extends FeatureCollection> = {
  mapRef: RefObject<MapRef | null>
  enabled: boolean
  buildUrl: (row: number, col: number) => string
  getFeatureId: (feature: T["features"][number]) => string
}

export const useViewportOsmGeoJson = <T extends FeatureCollection>({
  mapRef,
  enabled,
  buildUrl,
  getFeatureId,
}: ViewportOsmGeoJsonOptions<T>) => {
  const fetchedKeysRef = useRef(new Set<string>())
  const [geoJson, setGeoJson] = useState<T | null>(null)
  const abortControllersRef = useRef(new Set<AbortController>())
  const processingRef = useRef(false)

  const fetchGridCell = useCallback(
    async (row: number, col: number) => {
      const key = osmGridCellKey(row, col)
      if (fetchedKeysRef.current.has(key)) return

      const controller = new AbortController()
      abortControllersRef.current.add(controller)

      try {
        const response = await fetch(buildUrl(row, col), { signal: controller.signal })
        if (!response.ok) return

        const data = (await response.json()) as T
        fetchedKeysRef.current.add(key)
        setGeoJson((current) => mergeFeatureCollections(current, data, getFeatureId))
      } catch {
        // keep previously merged features visible
      } finally {
        abortControllersRef.current.delete(controller)
      }
    },
    [buildUrl, getFeatureId],
  )

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
        (cell) => !fetchedKeysRef.current.has(osmGridCellKey(cell.row, cell.col)),
      ),
      { latitude: center.lat, longitude: center.lng },
      LONDON_CENTER,
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

export const useStaticGeoJson = <T>(url: string, enabled: boolean) => {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()

    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) return
        setData((await response.json()) as T)
      } catch {
        // keep previous data if fetch fails
      }
    }

    void load()

    return () => controller.abort()
  }, [enabled, url])

  return data
}
