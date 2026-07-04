import { useCallback, useEffect, useRef, useState } from "react"
import {
  buildMapClipGeometry,
  toClipPath,
  type InletRect,
  type MapClipDebugPoint,
} from "@/lib/map/squircle-path"

const CORNER_RADIUS = 40
const LOGO_INLET_MARGIN = 6
/** Simple cubic radius for logo notch — not squircle. */
const LOGO_INLET_RADIUS = 18

/** Set false to hide red debug dots on the clip path. */
export const MAP_CLIP_DEBUG = true

export const useMapWindowClip = () => {
  const clipContainerRef = useRef<HTMLDivElement>(null)
  const mapWindowRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLImageElement>(null)
  const [debugPoints, setDebugPoints] = useState<MapClipDebugPoint[]>([])

  const updateClip = useCallback(() => {
    const container = clipContainerRef.current
    const mapWindow = mapWindowRef.current
    if (!container || !mapWindow) return

    const mapRect = mapWindow.getBoundingClientRect()
    if (mapRect.width <= 0 || mapRect.height <= 0) return

    let inlet: InletRect | null = null
    const logoEl = logoRef.current

    if (logoEl) {
      const logoRect = logoEl.getBoundingClientRect()
      if (logoRect.width > 0 && logoRect.height > 0) {
        inlet = {
          x: 0,
          y: 0,
          width: logoRect.right - mapRect.left + LOGO_INLET_MARGIN,
          height: logoRect.bottom - mapRect.top + LOGO_INLET_MARGIN,
          radius: LOGO_INLET_RADIUS,
        }
      }
    }

    const { path, debugPoints: points } = buildMapClipGeometry(
      0,
      0,
      mapRect.width,
      mapRect.height,
      CORNER_RADIUS,
      inlet
    )

    container.style.clipPath = toClipPath(path)
    setDebugPoints(MAP_CLIP_DEBUG ? points : [])
  }, [])

  useEffect(() => {
    let rafId = 0

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateClip)
    }

    const mapWindow = mapWindowRef.current
    const logoEl = logoRef.current

    scheduleUpdate()

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    if (mapWindow) resizeObserver.observe(mapWindow)
    if (logoEl) resizeObserver.observe(logoEl)

    window.addEventListener("resize", scheduleUpdate)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      window.removeEventListener("resize", scheduleUpdate)
    }
  }, [updateClip])

  return {
    clipContainerRef,
    mapWindowRef,
    logoRef,
    debugPoints,
    updateClip,
  }
}
