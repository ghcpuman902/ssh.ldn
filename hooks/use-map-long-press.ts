"use client"

import { useEffect, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10

type LongPressPoint = {
  latitude: number
  longitude: number
}

/**
 * Fires `onLongPress` after a single-finger hold on the map canvas.
 * Cancels on move, lift, or a second finger (so pinch/rotate stay clean).
 */
export const useMapLongPress = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean,
  onLongPress: (point: LongPressPoint) => void
) => {
  useEffect(() => {
    if (!enabled) return

    const map = mapRef.current?.getMap()
    if (!map) return

    const container = map.getCanvasContainer()
    let timerId: ReturnType<typeof setTimeout> | null = null
    let startX = 0
    let startY = 0
    let activeTouchId: number | null = null

    const clearTimer = () => {
      if (timerId === null) return
      clearTimeout(timerId)
      timerId = null
    }

    const reset = () => {
      clearTimer()
      activeTouchId = null
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset()
        return
      }

      const touch = event.touches[0]
      activeTouchId = touch.identifier
      startX = touch.clientX
      startY = touch.clientY
      clearTimer()

      timerId = setTimeout(() => {
        timerId = null
        if (activeTouchId === null) return

        const rect = container.getBoundingClientRect()
        const point = map.unproject([startX - rect.left, startY - rect.top])

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(10)
        }

        onLongPress({
          latitude: point.lat,
          longitude: point.lng,
        })
        reset()
      }, LONG_PRESS_MS)
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (activeTouchId === null || timerId === null) return

      if (event.touches.length !== 1) {
        reset()
        return
      }

      const touch = event.touches[0]
      if (touch.identifier !== activeTouchId) {
        reset()
        return
      }

      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        reset()
      }
    }

    const handleTouchEnd = () => {
      reset()
    }

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    })
    container.addEventListener("touchmove", handleTouchMove, { passive: true })
    container.addEventListener("touchend", handleTouchEnd)
    container.addEventListener("touchcancel", handleTouchEnd)

    return () => {
      reset()
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
      container.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [enabled, mapRef, onLongPress])
}
