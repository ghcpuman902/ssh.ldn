"use client"

import { useEffect, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import {
  carryOverOverlays,
  getBasemapTheme,
  getMapStyle,
  type MapTheme,
} from "@/lib/map/basemap-style"

/** Long enough to read as "the light changed", short enough to not block panning. */
const BASEMAP_CROSSFADE_MS = 550

/**
 * Swap Positron ↔ Dark Matter in place when the time slice flips day/night.
 *
 * react-map-gl's own `mapStyle` diff drops every runtime layer and re-adds it
 * on `styledata`, which flashes the noise rasters. Here the map keeps its
 * initial `mapStyle` prop and we diff manually with `carryOverOverlays`, so
 * shared basemap layers only get `setPaintProperty` calls and MapLibre's
 * paint transitions crossfade the colours.
 */
export const useBasemapLighting = (
  mapRef: RefObject<MapRef | null>,
  theme: MapTheme,
  enabled: boolean
) => {
  useEffect(() => {
    if (!enabled) return

    const map = mapRef.current?.getMap()
    if (!map) return
    if (getBasemapTheme(map.getStyle()) === theme) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    map.setStyle(getMapStyle(theme), {
      diff: true,
      validate: false,
      transformStyle: (previous, next) => ({
        ...carryOverOverlays(previous, next),
        transition: {
          duration: reduceMotion ? 0 : BASEMAP_CROSSFADE_MS,
          delay: 0,
        },
      }),
    })
  }, [enabled, mapRef, theme])
}
