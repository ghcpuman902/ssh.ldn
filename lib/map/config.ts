import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl"

export const LONDON_CENTER = {
  longitude: -0.118,
  latitude: 51.507,
} as const

export const DEFAULT_ZOOM = 11

export const LONDON_VIEWPORT = {
  ...LONDON_CENTER,
  zoom: DEFAULT_ZOOM,
  bearing: 0,
  pitch: 0,
} as const

/** Greater London — keeps the map focused without feeling cramped. */
export const LONDON_BOUNDS: LngLatBoundsLike = [
  [-0.52, 51.28],
  [0.24, 51.72],
]

export const isWithinLondonBounds = (latitude: number, longitude: number) =>
  longitude >= -0.52 &&
  longitude <= 0.24 &&
  latitude >= 51.28 &&
  latitude <= 51.72

/** Overpass radius scaled to zoom — smaller when zoomed in, capped for London panning. */
export const viewportFetchRadiusMeters = (zoom: number) =>
  Math.round(Math.min(8000, Math.max(1500, 8000 / 1.6 ** Math.max(0, zoom - 10))))

const OSM_ATTRIBUTION =
  "© OpenStreetMap contributors · © CARTO"

const createQuietRasterStyle = (
  tiles: string[],
  name: string
): StyleSpecification => ({
  version: 8,
  name,
  sources: {
    basemap: {
      type: "raster",
      tiles,
      tileSize: 256,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
})

/**
 * Muted basemaps derived from OpenStreetMap data.
 * Positron (light) and Dark Matter (dark) stay out of the way of overlays.
 */
export const MAP_TILE_STYLES = {
  light: createQuietRasterStyle(
    ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"],
    "positron-quiet"
  ),
  dark: createQuietRasterStyle(
    ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"],
    "dark-matter-quiet"
  ),
} as const

export type MapTheme = keyof typeof MAP_TILE_STYLES

export const getMapStyle = (theme: MapTheme = "light") => MAP_TILE_STYLES[theme]

export const MAP_CONFIG = {
  minZoom: 9,
  maxZoom: 18,
  attribution: OSM_ATTRIBUTION,
  bounds: LONDON_BOUNDS,
  defaultViewport: LONDON_VIEWPORT,
} as const

/**
 * DEFRA strategic noise: z10–12 pre-cached (~13 MB for London via download script).
 * z13 loads on demand from DEFRA WMS and is write-through cached as you pan.
 * z14+ overzooms z13 — avoids GB-scale bulk downloads.
 */
export const NOISE_TILE_MIN_ZOOM = 10
export const NOISE_TILE_PRECACHE_MAX_ZOOM = 12
export const NOISE_TILE_MAX_ZOOM = 13
