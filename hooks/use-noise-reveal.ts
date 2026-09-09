"use client"

import { useEffect, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

export type NoiseRevealStage = "basemap" | "center" | "spiral" | "complete"

const SPIRAL_HOLD_MS = 700

type NoiseRevealState = {
  stage: NoiseRevealStage
  coverageBounds: undefined
  lineUpgrade: boolean
  rasterFadeMs: number
}

/**
 * Cached z12 heatmaps paint as soon as the map is ready.
 * Nightlife / POI rasters and unique-track line upgrades wait until the
 * spiral hold so they do not race first paint.
 */
export const useNoiseReveal = (
  mapRef: RefObject<MapRef | null>,
  mapReady: boolean
): NoiseRevealState => {
  const [stage, setStage] = useState<NoiseRevealStage>("basemap")
  const [lineUpgrade, setLineUpgrade] = useState(false)
  const [rasterFadeMs, setRasterFadeMs] = useState(250)

  useEffect(() => {
    if (!mapReady) return

    const map = mapRef.current?.getMap()
    if (!map) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (reduceMotion) {
      setStage("complete")
      setLineUpgrade(true)
      setRasterFadeMs(0)
      return
    }

    setStage("spiral")

    let cancelled = false
    const completeTimer = window.setTimeout(() => {
      if (cancelled) return
      setStage("complete")
      setLineUpgrade(true)
    }, SPIRAL_HOLD_MS)

    return () => {
      cancelled = true
      window.clearTimeout(completeTimer)
    }
  }, [mapReady, mapRef])

  return { stage, coverageBounds: undefined, lineUpgrade, rasterFadeMs }
}
