"use client"

import { useEffect, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import {
  IDLE_DELAY_MS,
  createIdlePrefetcher,
  planPrefetch,
  prefetchBudget,
} from "@/lib/map/noise-prefetch"
import {
  BAKED_TILE_BOUNDS,
  BAKED_TILE_MAX_ZOOM,
  NOISE_DATA_BASE_URL,
  bakedTileUrl,
} from "@/lib/map/noise-tiles"

/**
 * DESIGN section 6. Nothing is prefetched until the map is idle (MapLibre's
 * `idle` event: the view's own tiles have loaded) and then stays quiet for
 * about 2 s, and only while the tab is visible. Any pan, zoom, search or key
 * press aborts the queue at once, so prefetch never competes with what the
 * user is looking at.
 */
export const useNoisePrefetch = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean
) => {
  useEffect(() => {
    const base = NOISE_DATA_BASE_URL
    const map = mapRef.current?.getMap()
    if (!enabled || !base || !map) return

    const prefetcher = createIdlePrefetcher()
    let timer: ReturnType<typeof setTimeout> | null = null
    let done = false
    // `enabled` already means the map has had its first idle.
    let idled = true
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection

    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
      prefetcher.abort()
    }
    const arm = () => {
      cancel()
      if (document.visibilityState !== "visible") return
      timer = setTimeout(() => {
        timer = null
        if (
          document.visibilityState !== "visible" ||
          map.isMoving() ||
          !map.areTilesLoaded()
        ) {
          return
        }
        const centre = map.getCenter()
        prefetcher.start(
          planPrefetch({
            urlFor: (kind, period, z, x, y) =>
              bakedTileUrl(base, kind, period, z, x, y),
            bounds: BAKED_TILE_BOUNDS,
            maxZoom: BAKED_TILE_MAX_ZOOM,
            centre: { lng: centre.lng, lat: centre.lat },
            budget: prefetchBudget(connection),
          })
        )
        done = true
      }, IDLE_DELAY_MS)
    }

    const onIdle = () => {
      idled = true
      // After a started run only new input re-plans, from the new centre.
      if (!done && !timer) arm()
    }
    const onInput = () => {
      done = false
      cancel()
      // Quiet again for 2 s starts a fresh plan, but never before the first idle.
      if (idled) arm()
    }

    map.on("idle", onIdle)
    arm()
    for (const event of ["movestart", "zoomstart", "dragstart", "rotatestart", "pitchstart"] as const) {
      map.on(event, onInput)
    }
    const container = map.getContainer()
    container.addEventListener("pointerdown", onInput, { passive: true })
    container.addEventListener("wheel", onInput, { passive: true })
    window.addEventListener("keydown", onInput)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (idled) arm()
      } else {
        done = false
        cancel()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancel()
      map.off("idle", onIdle)
      for (const event of ["movestart", "zoomstart", "dragstart", "rotatestart", "pitchstart"] as const) {
        map.off(event, onInput)
      }
      container.removeEventListener("pointerdown", onInput)
      container.removeEventListener("wheel", onInput)
      window.removeEventListener("keydown", onInput)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [mapRef, enabled])
}
