"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import { attachFps120Controller } from "@/lib/map/fps120/controller"
import { readFps120Flags, type Fps120Flags } from "@/lib/map/fps120/flag"

const OFF: Fps120Flags = { controller: false, meter: false }

/** Reads ?fps120 / ?fpsmeter after mount (SSR renders the plain map). */
export const useFps120Flags = () => {
  const [flags, setFlags] = useState<Fps120Flags>(OFF)
  useEffect(() => {
    let storage: Storage | null = null
    try {
      storage = window.localStorage
    } catch {
      storage = null
    }
    const next = readFps120Flags(window.location.search, storage)
    if (next.controller || next.meter) queueMicrotask(() => setFlags(next))
  }, [])
  return flags
}

export const useFps120Controller = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean,
  onLongPress: (point: { latitude: number; longitude: number }) => void
) => {
  const longPressRef = useRef(onLongPress)
  useEffect(() => {
    longPressRef.current = onLongPress
  }, [onLongPress])

  useEffect(() => {
    if (!enabled) return
    const map = mapRef.current?.getMap()
    if (!map) return
    return attachFps120Controller(map, {
      onLongPress: (point) => longPressRef.current(point),
    })
  }, [enabled, mapRef])
}
