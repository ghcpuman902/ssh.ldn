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

/**
 * Local noise sources (OSM pubs, bars, clubs, music venues, hospitals) baked
 * onto the same 10 m BNG cells as DEFRA (scripts/noise-bake/bake_local.py),
 * one pair of grid layers per time slot:
 * - `local_<slot>`: local sources alone, value = round(2 x dB), 0 under 35 dB.
 * - `roadlocal_<slot>`: the DEFRA road band of road + local energy (10 log10
 *   of the summed 10^(L/10)), never below the road band. Day slots add to
 *   road_Lday, nights to road_Lnight.
 * With local sources on, the road layer draws `roadlocal_<slot>` so venues
 * raise the road baseline cell by cell; with road off, `local_<slot>` draws
 * on its own. The readout reads the same chunks, so it shows what is drawn.
 */
export type LocalNoiseSlot = "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night"

export const localLayerName = (slot: LocalNoiseSlot) => `local_${slot}`
export const roadLocalLayerName = (slot: LocalNoiseSlot) => `roadlocal_${slot}`

/** The road layer a slot's local sources add to. */
export const roadLayerForSlot = (slot: LocalNoiseSlot) =>
  slot.endsWith("night") ? "road_Lnight" : "road_Lday"

/** DEFRA band of a level on a road layer: 5 dB steps from 40 (day) or 35 (night) dB; 0 below. */
export const roadBandOf = (db: number, night: boolean) => {
  const lo = night ? 30 : 35
  const top = night ? 10 : 9
  if (!(db >= lo + 5)) return 0
  return Math.min(top, Math.floor((db - lo) / 5))
}

/** Energy sum of levels in dB; null and 0 add nothing. Null when all are empty. */
export const energySumDb = (...levels: Array<number | null | undefined>) => {
  let e = 0
  for (const l of levels) if (l && l > 0) e += 10 ** (l / 10)
  return e > 0 ? 10 * Math.log10(e) : null
}
