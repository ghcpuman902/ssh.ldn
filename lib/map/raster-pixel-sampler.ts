import {
  NOISE_TILE_MIN_ZOOM,
  NOISE_TILE_PRECACHE_MAX_ZOOM,
} from "@/lib/map/config"
import type { DefraMapKind, DefraNoisePeriod } from "@/lib/map/defra-layers"
import {
  defraRasterPixelToIntensity,
  sanitizeTransportRasterIntensity,
} from "@/lib/map/defra-raster-legend"
import {
  BAKED_TILE_BOUNDS,
  BAKED_TILE_MAX_ZOOM,
  NOISE_DATA_BASE_URL,
  bakedTileUrl,
  type BakedNoisePeriod,
} from "@/lib/map/noise-tiles"
import { lngLatToTilePixel } from "@/lib/map/web-mercator"

const TILE_SIZE = 256

type TilePixels = {
  imageData: ImageData
}

type SampleInput = {
  kind: DefraMapKind
  period: DefraNoisePeriod
  longitude: number
  latitude: number
  zoom: number
}

const tileCache = new Map<string, Promise<TilePixels>>()

/**
 * Baked tiles go to z13 (11.9 m pixels) and read the same files the map
 * paints, so a lookup is usually already in the HTTP cache. The live proxy
 * stays at z12.
 */
const clampTileZoom = (zoom: number) =>
  NOISE_DATA_BASE_URL
    ? Math.min(BAKED_TILE_MAX_ZOOM, Math.max(NOISE_TILE_MIN_ZOOM, Math.floor(zoom)))
    : Math.min(
        NOISE_TILE_PRECACHE_MAX_ZOOM,
        Math.max(NOISE_TILE_MIN_ZOOM, Math.floor(zoom))
      )

const insideBakedBounds = (longitude: number, latitude: number) => {
  const [west, south, east, north] = BAKED_TILE_BOUNDS
  return (
    longitude >= west && longitude <= east && latitude >= south && latitude <= north
  )
}

const createCanvas = () => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
  }

  const canvas = document.createElement("canvas")
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  return canvas
}

const loadTilePixels = async (url: string): Promise<TilePixels> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Noise tile failed: ${response.status}`)
  }

  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = createCanvas()
  const context = canvas.getContext("2d", { willReadFrequently: true })

  if (!context || !("drawImage" in context) || !("getImageData" in context)) {
    throw new Error("Could not create tile sampling canvas")
  }

  context.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE)
  bitmap.close()

  return {
    imageData: context.getImageData(0, 0, TILE_SIZE, TILE_SIZE),
  }
}

const getTilePixels = ({
  kind,
  period,
  z,
  x,
  y,
}: {
  kind: DefraMapKind
  period: DefraNoisePeriod
  z: number
  x: number
  y: number
}) => {
  const cacheKey = `${kind}:${period}:${z}:${x}:${y}`
  const cached = tileCache.get(cacheKey)
  if (cached) return cached

  const url = NOISE_DATA_BASE_URL
    ? bakedTileUrl(
        NOISE_DATA_BASE_URL,
        kind,
        period as BakedNoisePeriod,
        z,
        x,
        y
      )
    : `/api/map/defra/${kind}/${z}/${x}/${y}.png?period=${period}`
  const loading = loadTilePixels(url).catch((error) => {
    tileCache.delete(cacheKey)
    throw error
  })

  tileCache.set(cacheKey, loading)
  return loading
}

export const sampleDefraRasterIntensity = async ({
  kind,
  period,
  longitude,
  latitude,
  zoom,
}: SampleInput) => {
  // The baked tiles only cover London; outside it there is nothing to read
  // (and no tile to 404 on).
  if (NOISE_DATA_BASE_URL && !insideBakedBounds(longitude, latitude)) return 0

  const z = clampTileZoom(zoom)
  const tile = lngLatToTilePixel({
    longitude,
    latitude,
    z,
    tileSize: TILE_SIZE,
  })
  const { imageData } = await getTilePixels({
    kind,
    period,
    z,
    x: tile.x,
    y: tile.y,
  })

  const index = (tile.pixelY * TILE_SIZE + tile.pixelX) * 4

  const intensity = defraRasterPixelToIntensity({
    red: imageData.data[index] ?? 0,
    green: imageData.data[index + 1] ?? 0,
    blue: imageData.data[index + 2] ?? 0,
    alpha: imageData.data[index + 3] ?? 0,
  })

  return sanitizeTransportRasterIntensity(intensity, kind)
}
