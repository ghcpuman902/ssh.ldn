"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import {
  noiseCenterFrameBounds,
  type LngLatBoundsTuple,
} from "@/lib/map/noise-coverage"

export type NoiseRevealStage = "basemap" | "center" | "spiral" | "complete"

const CENTER_HOLD_MS = 220
const SPIRAL_HOLD_MS = 700
const CENTER_FALLBACK_MS = 650
const COMPLETE_FALLBACK_MS = 1600

type NoiseRevealState = {
  stage: NoiseRevealStage
  coverageBounds: LngLatBoundsTuple | undefined
  lineUpgrade: boolean
  rasterFadeMs: number
}

/**
 * First paint: basemap only, then the center 3×3 noise tiles.
 * After those land, drop the bounds so the rest of the viewport fills in.
 * Line-detail upgrade waits until the spiral has started (or a fallback).
 */
export const useNoiseReveal = (
  mapRef: RefObject<MapRef | null>,
  mapReady: boolean
): NoiseRevealState => {
  const [stage, setStage] = useState<NoiseRevealStage>("basemap")
  const [coverageBounds, setCoverageBounds] = useState<
    LngLatBoundsTuple | undefined
  >()
  const [lineUpgrade, setLineUpgrade] = useState(false)
  const [rasterFadeMs, setRasterFadeMs] = useState(250)
  const stageRef = useRef(stage)
  stageRef.current = stage

  useEffect(() => {
    if (!mapReady) return

    const map = mapRef.current?.getMap()
    if (!map) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (reduceMotion) {
      setCoverageBounds(undefined)
      setStage("complete")
      setLineUpgrade(true)
      setRasterFadeMs(0)
      return
    }

    const center = map.getCenter()
    setCoverageBounds(
      noiseCenterFrameBounds(center.lng, center.lat, map.getZoom())
    )
    setStage("center")

    let cancelled = false
    let spiralTimer = 0
    let completeTimer = 0

    const advanceToSpiral = () => {
      if (cancelled || stageRef.current !== "center") return
      window.clearTimeout(completeTimer)
      setCoverageBounds(undefined)
      setStage("spiral")
      completeTimer = window.setTimeout(advanceToComplete, SPIRAL_HOLD_MS)
    }

    const advanceToComplete = () => {
      if (cancelled) return
      setStage("complete")
      setLineUpgrade(true)
    }

    const handleSourceData = (event: {
      sourceId?: string
      isSourceLoaded?: boolean
    }) => {
      if (!event.isSourceLoaded) return
      if (
        typeof event.sourceId === "string" &&
        event.sourceId.startsWith("defra-noise-road") &&
        stageRef.current === "center"
      ) {
        window.clearTimeout(spiralTimer)
        spiralTimer = window.setTimeout(advanceToSpiral, CENTER_HOLD_MS)
      }
    }

    map.on("sourcedata", handleSourceData)
    spiralTimer = window.setTimeout(advanceToSpiral, CENTER_FALLBACK_MS)
    completeTimer = window.setTimeout(advanceToComplete, COMPLETE_FALLBACK_MS)

    return () => {
      cancelled = true
      map.off("sourcedata", handleSourceData)
      window.clearTimeout(spiralTimer)
      window.clearTimeout(completeTimer)
    }
  }, [mapReady, mapRef])

  return { stage, coverageBounds, lineUpgrade, rasterFadeMs }
}
