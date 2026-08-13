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

type FetchPriority = "high" | "low" | "auto"

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
  const buildUrlRef = useRef(buildUrl)
  const getFeatureIdRef = useRef(getFeatureId)
  const mapRefStable = useRef(mapRef)

  buildUrlRef.current = buildUrl
  getFeatureIdRef.current = getFeatureId
  mapRefStable.current = mapRef

  const fetchGridCell = useCallback(async (row: number, col: number) => {
    const key = osmGridCellKey(row, col)
    if (fetchedKeysRef.current.has(key)) return

    const controller = new AbortController()
    abortControllersRef.current.add(controller)

    try {
      const response = await fetch(buildUrlRef.current(row, col), {
        signal: controller.signal,
      })
      if (!response.ok) return

      const data = (await response.json()) as T
      fetchedKeysRef.current.add(key)
      setGeoJson((current) =>
        mergeFeatureCollections(current, data, getFeatureIdRef.current)
      )
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
      await Promise.all(
        batch.map((cell) => fetchGridCell(cell.row, cell.col))
      )
    } finally {
      processingRef.current = false
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
      // Abort only when this layer is disabled or the hook unmounts —
      // not on parent re-renders that used to recreate callback identities.
      for (const controller of abortControllersRef.current) {
        controller.abort()
      }
      abortControllersRef.current.clear()
    }
  }, [enabled])

  return geoJson
}

const staticGeoJsonCache = new Map<string, unknown>()
const staticGeoJsonInflight = new Map<string, Promise<unknown>>()

const loadStaticGeoJson = async <T>(
  url: string,
  priority: FetchPriority = "auto"
): Promise<T | null> => {
  if (staticGeoJsonCache.has(url)) {
    return staticGeoJsonCache.get(url) as T
  }

  let request = staticGeoJsonInflight.get(url) as Promise<T | null> | undefined

  if (!request) {
    request = (async () => {
      try {
        const response = await fetch(url, {
          credentials: "omit",
          priority,
        })
        if (!response.ok) return null
        const data = (await response.json()) as T
        staticGeoJsonCache.set(url, data)
        return data
      } finally {
        staticGeoJsonInflight.delete(url)
      }
    })()

    staticGeoJsonInflight.set(url, request)
  }

  return request
}

/** Fetch once, cache in memory. Prefetch when `prefetch` is true. */
export const useStaticGeoJson = <T>(
  url: string,
  prefetch: boolean,
  priority: FetchPriority = "auto"
) => {
  const [data, setData] = useState<T | null>(
    () => (staticGeoJsonCache.get(url) as T | undefined) ?? null,
  )

  useEffect(() => {
    if (!prefetch) return

    if (staticGeoJsonCache.has(url)) {
      setData(staticGeoJsonCache.get(url) as T)
      return
    }

    let cancelled = false

    void loadStaticGeoJson<T>(url, priority).then((next) => {
      if (!cancelled && next) setData(next)
    })

    return () => {
      cancelled = true
    }
  }, [prefetch, priority, url])

  return data
}
