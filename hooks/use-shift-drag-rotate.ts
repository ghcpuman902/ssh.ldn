"use client"

import { useEffect, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

/** Matches MapLibre DragRotateHandler bearing sensitivity. */
const BEARING_SENSITIVITY = 0.8
/** Matches MapLibre DragRotateHandler pitch sensitivity. */
const PITCH_SENSITIVITY = 0.5

/**
 * Replaces MapLibre's right-click / Ctrl+drag rotate with Shift+left-drag.
 * Requires `dragRotate={false}` and `boxZoom={false}` on the Map so Shift+drag
 * is free and right-click no longer rotates.
 */
export const useShiftDragRotate = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!enabled) return

    const map = mapRef.current?.getMap()
    if (!map) return

    const container = map.getCanvasContainer()
    let dragging = false
    let startX = 0
    let startY = 0
    let startBearing = 0
    let startPitch = 0

    const handleContextMenu = (event: Event) => {
      event.preventDefault()
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragging) return

      const dx = event.clientX - startX
      const dy = event.clientY - startY
      const nextPitch = Math.min(
        map.getMaxPitch(),
        Math.max(0, startPitch - dy * PITCH_SENSITIVITY)
      )

      map.jumpTo({
        bearing: startBearing + dx * BEARING_SENSITIVITY,
        pitch: nextPitch,
      })
    }

    const handleMouseUp = () => {
      if (!dragging) return

      dragging = false
      map.dragPan.enable()
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !event.shiftKey) return

      event.preventDefault()
      event.stopPropagation()

      dragging = true
      startX = event.clientX
      startY = event.clientY
      startBearing = map.getBearing()
      startPitch = map.getPitch()
      map.dragPan.disable()

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    container.addEventListener("mousedown", handleMouseDown, true)
    container.addEventListener("contextmenu", handleContextMenu)

    return () => {
      handleMouseUp()
      container.removeEventListener("mousedown", handleMouseDown, true)
      container.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [enabled, mapRef])
}
