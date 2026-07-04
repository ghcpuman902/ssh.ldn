"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import {
  isWithinLondonBounds,
  viewportFetchRadiusMeters,
} from "@/lib/map/config"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"

const CACHE_PRECISION = 2
const DEBOUNCE_MS = 350

const cacheKeyFor = (lat: number, lng: number, radiusMeters: number) =>
  `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)},${radiusMeters}`

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
  const inflightRef = useRef<AbortController | null>(null)

  const loadForViewport = useCallback(async () => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const { lat, lng } = map.getCenter()
    if (!isWithinLondonBounds(lat, lng)) return

    const radiusMeters = viewportFetchRadiusMeters(map.getZoom())
    const key = cacheKeyFor(lat, lng, radiusMeters)

    if (fetchedKeysRef.current.has(key)) return

    inflightRef.current?.abort()
    const controller = new AbortController()
    inflightRef.current = controller

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radiusMeters: String(radiusMeters),
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
      if (!controller.signal.aborted) {
        // keep previously merged features visible
      }
    }
  }, [mapRef])

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
      inflightRef.current?.abort()
    }
  }, [enabled, loadForViewport, mapRef])

  return geoJson
}
