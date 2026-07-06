import type { LocalNoiseAmenity } from "@/lib/map/venue-time"

export type PoiDensitySlot =
  | "weekday-day"
  | "weekday-night"
  | "weekend-day"
  | "weekend-night"

export const poiDensitySlotFromParts = ({
  week,
  part,
}: {
  week: "weekday" | "weekend"
  part: "day" | "night"
}): PoiDensitySlot => `${week}-${part}`

export const POI_DENSITY_WEIGHTS: Record<LocalNoiseAmenity, number> = {
  pub: 0.36,
  bar: 0.44,
  nightclub: 1,
  music_venue: 0.92,
  hospital: 0.82,
}

export const POI_EMOJI_PRIORITY_MIN_ZOOM: Record<LocalNoiseAmenity, number> = {
  hospital: 11,
  nightclub: 11.5,
  music_venue: 12,
  pub: 14,
  bar: 14,
}

export const POI_DENSITY_TILE_SIZE = 256

/**
 * Generator writes tile pixels normalised to 0–1, then maps the range to alpha.
 * The manifest stores the cap used for reproducibility.
 */
export const POI_DENSITY_NORMALIZED_RANGE = [0, 1] as const

export const POI_DENSITY_SLOTS: PoiDensitySlot[] = [
  "weekday-day",
  "weekday-night",
  "weekend-day",
  "weekend-night",
]

export const isPoiDensitySlot = (value: string): value is PoiDensitySlot =>
  (POI_DENSITY_SLOTS as string[]).includes(value)
