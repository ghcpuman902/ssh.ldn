/**
 * Where the baked DEFRA map tiles live and how to name them.
 *
 * Design and feedback rules: doc/noise-data/DESIGN.md (sections 3, 5, 6).
 * Principles are fixed; a bug here is an implementation detail.
 *
 * Self-contained on purpose (no imports) so node --test can load it.
 */

/**
 * Immutable base URL of one published bake: `<public Blob origin>/noise/<hash>`.
 * Never overwrite a published bake; a new bake gets a new hash and a new
 * value here. Unset (null) means the baked tiles are not published yet, so
 * the map keeps using the live WMS proxy under /api/map/defra.
 */
export const NOISE_DATA_BASE_URL: string | null =
  (process.env.NEXT_PUBLIC_NOISE_DATA_BASE ?? "").replace(/\/+$/, "") || null

/** Baked Web Mercator zoom range (DESIGN section 3). Past max, overzoom with nearest. */
export const BAKED_TILE_MIN_ZOOM = 8
export const BAKED_TILE_MAX_ZOOM = 13

/** West, south, east, north of the baked London grid; tiles outside do not exist. */
export const BAKED_TILE_BOUNDS: [number, number, number, number] = [
  -0.5392900256, 51.2670817557, 0.3430191321, 51.7024041375,
]

const PERIOD_TO_LAYER_SUFFIX = {
  day: "Lday",
  night: "Lnight",
  evening: "Leve",
  all: "Lden",
} as const

export type BakedNoisePeriod = keyof typeof PERIOD_TO_LAYER_SUFFIX
export type BakedNoiseKind = "road" | "rail" | "airport"

export const bakedLayerName = (kind: BakedNoiseKind, period: BakedNoisePeriod) =>
  `${kind}_${PERIOD_TO_LAYER_SUFFIX[period] ?? "Lday"}`

/** MapLibre template, with {z}/{x}/{y} left in place. */
export const bakedTileTemplate = (
  base: string,
  kind: BakedNoiseKind,
  period: BakedNoisePeriod
) => `${base}/tiles/${bakedLayerName(kind, period)}/{z}/{x}/{y}.webp`

export const bakedTileUrl = (
  base: string,
  kind: BakedNoiseKind,
  period: BakedNoisePeriod,
  z: number,
  x: number,
  y: number
) =>
  bakedTileTemplate(base, kind, period)
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
