import {
  NOISE_TILE_MIN_ZOOM,
  NOISE_TILE_PRECACHE_MAX_ZOOM,
} from "@/lib/map/config"
import { lngLatToTilePixel } from "@/lib/map/web-mercator"

const latFromMercatorY = (yNormalized: number) => {
  const n = Math.PI * (1 - 2 * yNormalized)
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}

export const xyzToLngLatBounds = (z: number, x: number, y: number) => {
  const n = 2 ** z
  const west = (x / n) * 360 - 180
  const east = ((x + 1) / n) * 360 - 180
  const north = latFromMercatorY(y / n)
  const south = latFromMercatorY((y + 1) / n)

  return { west, south, east, north }
}

export type LngLatBoundsTuple = [number, number, number, number]

/**
 * Tight Web Mercator window around the viewport center — one ring of noise
 * tiles (3×3) so the first heatmap paint does not request the full viewport.
 */
export const noiseCenterFrameBounds = (
  longitude: number,
  latitude: number,
  zoom: number,
  radiusTiles = 1
): LngLatBoundsTuple => {
  const z = Math.min(
    NOISE_TILE_PRECACHE_MAX_ZOOM,
    Math.max(NOISE_TILE_MIN_ZOOM, Math.floor(zoom))
  )
  const tile = lngLatToTilePixel({ longitude, latitude, z })
  const n = 2 ** z
  const minX = Math.max(0, tile.x - radiusTiles)
  const maxX = Math.min(n - 1, tile.x + radiusTiles)
  const minY = Math.max(0, tile.y - radiusTiles)
  const maxY = Math.min(n - 1, tile.y + radiusTiles)
  const northWest = xyzToLngLatBounds(z, minX, minY)
  const southEast = xyzToLngLatBounds(z, maxX, maxY)

  return [northWest.west, southEast.south, southEast.east, northWest.north]
}
