/**
 * Where the published DEFRA noise bake lives and how its layers are named.
 *
 * Design and feedback rules: doc/noise-data/DESIGN.md (sections 3, 5, 6).
 * Principles are fixed; a bug here is an implementation detail.
 *
 * Self-contained on purpose (no imports) so node --test can load it.
 */

/**
 * Immutable base URL of one published bake: `<public Blob origin>/noise/<hash>`
 * with `grid/` (the 10 m band grid the map draws with WebGL) and `points/`
 * (the archive point values read). Never overwrite a published bake; a new
 * bake gets a new hash and a new value here. Unset (null) means nothing is
 * published yet, so the map keeps using the live WMS proxy under
 * /api/map/defra.
 */
export const NOISE_DATA_BASE_URL: string | null =
  (process.env.NEXT_PUBLIC_NOISE_DATA_BASE ?? "").replace(/\/+$/, "") || null

/** West, south, east, north of the baked London grid (E 502,005-562,005, N 153,005-203,005). */
export const NOISE_GRID_BOUNDS: [number, number, number, number] = [
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
