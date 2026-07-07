import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl"

export const LONDON_CENTER = {
  longitude: -0.118,
  latitude: 51.507,
} as const

/** Tighter central-London default — fewer viewport grid cells on first paint, still within pre-cached DEFRA tiles (z10–12). */
export const DEFAULT_ZOOM = 12

export const LONDON_VIEWPORT = {
  ...LONDON_CENTER,
  zoom: DEFAULT_ZOOM,
  bearing: 0,
  pitch: 0,
} as const

/**
 * M25 orbital corridor / Greater London — Staines to Dartford, Surrey fringe to Herts fringe.
 * Shared by map maxBounds, OSM grid, DEFRA tile cache, and search viewbox.
 */
export const LONDON_BOUNDS: LngLatBoundsLike = [
  [-0.57, 51.24],
  [0.36, 51.73],
]

export const LONDON_BBOX = {
  west: -0.57,
  south: 51.24,
  east: 0.36,
  north: 51.73,
} as const

export const isWithinLondonBounds = (latitude: number, longitude: number) =>
  longitude >= LONDON_BBOX.west &&
  longitude <= LONDON_BBOX.east &&
  latitude >= LONDON_BBOX.south &&
  latitude <= LONDON_BBOX.north

const OSM_ATTRIBUTION =
  "© OpenStreetMap contributors · © CARTO"

/**
 * High-zoom label overlay kicks in here — below this, small street labels stay
 * under heatmaps as part of the full basemap.
 */
export const BASEMAP_LABEL_OVERLAY_MIN_ZOOM = 14

/** Shared opacity for the high-zoom label overlay. */
export const BASEMAP_LABEL_OVERLAY_OPACITY = 0.7

/** Insert noise/POI layers before this id so labels stay on top. */
export const BASEMAP_LABELS_LAYER_ID = "basemap-labels"

const BASEMAP_PAINT = {
  light: {
    "raster-contrast": 0.08,
    "raster-fade-duration": 0,
  },
  dark: {
    "raster-contrast": 0.06,
    "raster-fade-duration": 0,
  },
} as const

/** CARTO bakes halos/shadows into label tiles — only fade + opacity here. */
const BASEMAP_LABELS_PAINT = {
  "raster-opacity": BASEMAP_LABEL_OVERLAY_OPACITY,
  "raster-fade-duration": 0,
} as const

const createBasemapStyle = (
  allTiles: string[],
  labelTiles: string[],
  name: string,
  theme: "light" | "dark"
): StyleSpecification => ({
  version: 8,
  name,
  sources: {
    basemap: {
      type: "raster",
      tiles: allTiles,
      tileSize: 256,
      attribution: OSM_ATTRIBUTION,
    },
    "basemap-labels-src": {
      type: "raster",
      tiles: labelTiles,
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
      paint: BASEMAP_PAINT[theme],
    },
    {
      id: BASEMAP_LABELS_LAYER_ID,
      type: "raster",
      source: "basemap-labels-src",
      minzoom: BASEMAP_LABEL_OVERLAY_MIN_ZOOM,
      maxzoom: 20,
      paint: BASEMAP_LABELS_PAINT,
    },
  ],
})

/**
 * Full Positron / Dark Matter basemap with a high-zoom label overlay above heatmaps.
 * Positron/Dark Matter label tiles ship with subtle baked-in halos — no extra passes.
 */
export const MAP_TILE_STYLES = {
  light: createBasemapStyle(
    ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"],
    ["https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"],
    "positron-quiet",
    "light"
  ),
  dark: createBasemapStyle(
    ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"],
    ["https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"],
    "dark-matter-quiet",
    "dark"
  ),
} as const

export type MapTheme = keyof typeof MAP_TILE_STYLES

export const getMapStyle = (theme: MapTheme = "light") => MAP_TILE_STYLES[theme]

/** Retina-aware canvas scale; capped to balance sharpness and GPU cost. */
export const getMapPixelRatio = () => {
  if (typeof window === "undefined") return 1

  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
}

export const MAP_CONFIG = {
  minZoom: 9,
  maxZoom: 18,
  attribution: OSM_ATTRIBUTION,
  bounds: LONDON_BOUNDS,
  defaultViewport: LONDON_VIEWPORT,
} as const

/**
 * DEFRA strategic noise: z10–12 pre-cached (~13 MB for London via download script).
 * z13–14 load on demand from DEFRA WMS and are write-through cached as you pan.
 * z15+ overzooms z14 — avoids GB-scale bulk downloads.
 */
export const NOISE_TILE_MIN_ZOOM = 10
export const NOISE_TILE_PRECACHE_MAX_ZOOM = 12
export const NOISE_TILE_MAX_ZOOM = 14

/**
 * Prebuilt OSM POI density tiles mirror the DEFRA overview strategy:
 * zoomed-out rendering is raster/pixel-based through z14, then live symbols take over.
 */
export const POI_DENSITY_TILE_MIN_ZOOM = 10
export const POI_DENSITY_TILE_MAX_ZOOM = 14
