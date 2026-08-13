import type { LngLatBoundsLike } from "maplibre-gl"

export {
  BASEMAP_LABELS_LAYER_ID,
  getMapStyle,
  MAP_TILE_STYLES,
  NOISE_OVERLAY_SLOT_ID,
  RAIL_UNDERLAY_SLOT_ID,
  TRANSIT_OVERLAY_SLOT_ID,
  type MapTheme,
} from "@/lib/map/basemap-style"

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
  "© OpenStreetMap contributors · © OpenFreeMap"

/** Retina-aware canvas scale; cap at 2× so first paint stays sharp without 3× tile cost. */
export const getMapPixelRatio = () => {
  if (typeof window === "undefined") return 1

  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
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
