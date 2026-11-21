/**
 * Snap a UI noise reading to the device pixel the WebGL noise layer drew under
 * it (see shouldSnapReading in noise-grid-gl-math.ts). Only the UI paths use
 * this; /api/noise/point stays the exact-coordinate API.
 */
import type { Map as MapLibreMap } from "maplibre-gl"

import {
  devicePixelCentre,
  pixelMetersAt,
  shouldSnapReading,
} from "@/lib/map/noise-grid-gl-math"

type LngLat = { latitude: number; longitude: number }

const canvasRatio = (map: MapLibreMap) => {
  const canvas = map.getCanvas()
  return canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1
}

/** Reading position for a CSS screen point the user tapped or hovered. */
export const snapReadingAtPoint = (
  map: MapLibreMap,
  point: { x: number; y: number },
  exact: LngLat
): LngLat => {
  if (!shouldSnapReading(pixelMetersAt(map.getZoom(), exact.latitude))) return exact
  const c = devicePixelCentre(point.x, point.y, canvasRatio(map))
  const at = map.unproject([c.x, c.y])
  return { latitude: at.lat, longitude: at.lng }
}

/** Reading position for a pinned lat/lng, snapped only while the map is still and the pin is on screen. */
export const snapReadingAtLngLat = (map: MapLibreMap | null | undefined, exact: LngLat): LngLat => {
  if (!map || map.isMoving()) return exact
  const p = map.project([exact.longitude, exact.latitude])
  const canvas = map.getCanvas()
  if (p.x < 0 || p.y < 0 || p.x > canvas.clientWidth || p.y > canvas.clientHeight) return exact
  return snapReadingAtPoint(map, p, exact)
}
