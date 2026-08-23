"use client"

import { useCallback, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

const ZOOM_CONTROL_SELECTOR = ".maplibregl-ctrl-group"

const applyCapsuleZoomControlStyles = (root: ParentNode | null) => {
  const group = root?.querySelector<HTMLElement>(ZOOM_CONTROL_SELECTOR)
  if (!group) return

  group.style.setProperty("border-radius", "9999px", "important")
  group.style.setProperty("box-shadow", "none", "important")
  group.style.setProperty("overflow", "hidden", "important")
  group.style.setProperty(
    "border",
    "0.5px solid color-mix(in oklch, var(--border) 32%, transparent)",
    "important"
  )
  group.style.setProperty(
    "background-color",
    "color-mix(in oklch, var(--background) 62%, transparent)",
    "important"
  )
  group.style.setProperty(
    "-webkit-backdrop-filter",
    "blur(32px) saturate(1.6)",
    "important"
  )
  group.style.setProperty(
    "backdrop-filter",
    "blur(32px) saturate(1.6)",
    "important"
  )
}

export const useMapZoomControlStyles = (mapRef: RefObject<MapRef | null>) => {
  const applyZoomControlStyles = useCallback(() => {
    const mapContainer = mapRef.current?.getMap()?.getContainer() ?? null
    applyCapsuleZoomControlStyles(mapContainer)
  }, [mapRef])

  return applyZoomControlStyles
}
