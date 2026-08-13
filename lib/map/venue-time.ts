import opening_hours from "opening_hours"

import { ALL_NOISE_TIME_SLOTS, type NoiseTimeSlot } from "@/lib/map/noise-time"

export type LocalNoiseAmenity =
  "pub" | "bar" | "nightclub" | "music_venue" | "hospital"

export const LOCAL_NOISE_AMENITIES: readonly LocalNoiseAmenity[] = [
  "pub",
  "bar",
  "nightclub",
  "music_venue",
  "hospital",
]

export const isLocalNoiseAmenity = (
  amenity: string | null | undefined
): amenity is LocalNoiseAmenity =>
  amenity !== null &&
  amenity !== undefined &&
  LOCAL_NOISE_AMENITIES.includes(amenity as LocalNoiseAmenity)

/** Base noise contribution weight by local source type (before time slot). */
export const AMENITY_BASE_WEIGHT: Record<LocalNoiseAmenity, number> = {
  pub: 0.5,
  bar: 0.7,
  nightclub: 1,
  music_venue: 0.9,
  hospital: 0.75,
}

type SlotKey = `${NoiseTimeSlot["week"]}-${NoiseTimeSlot["part"]}`

/** Heuristic activity (0–1) when opening_hours is missing. */
export const AMENITY_FALLBACK_ACTIVITY: Record<
  LocalNoiseAmenity,
  Record<SlotKey, number>
> = {
  pub: {
    "weekday-day": 0.7,
    "weekday-night": 0.5,
    "weekend-day": 0.75,
    "weekend-night": 0.85,
  },
  bar: {
    "weekday-day": 0.4,
    "weekday-night": 0.75,
    "weekend-day": 0.65,
    "weekend-night": 0.95,
  },
  nightclub: {
    "weekday-day": 0.05,
    "weekday-night": 0,
    "weekend-day": 0.1,
    "weekend-night": 1,
  },
  music_venue: {
    "weekday-day": 0.05,
    "weekday-night": 0.35,
    "weekend-day": 0.15,
    "weekend-night": 0.95,
  },
  hospital: {
    "weekday-day": 0.9,
    "weekday-night": 0.65,
    "weekend-day": 0.8,
    "weekend-night": 0.65,
  },
}

const slotKey = ({ week, part }: NoiseTimeSlot): SlotKey => `${week}-${part}`

/** Representative probe timestamps aligned with DEFRA day/night windows. */
export const slotToProbeDate = ({ week, part }: NoiseTimeSlot): Date => {
  const year = 2026
  const month = 6 // July — avoids DST edge cases in UK summer time

  if (week === "weekday" && part === "day") {
    return new Date(Date.UTC(year, month, 1, 12, 0, 0)) // Wed 12:00 UTC
  }
  if (week === "weekday" && part === "night") {
    return new Date(Date.UTC(year, month, 2, 1, 0, 0)) // Thu 01:00 UTC
  }
  if (week === "weekend" && part === "day") {
    return new Date(Date.UTC(year, month, 4, 12, 0, 0)) // Sat 12:00 UTC
  }
  return new Date(Date.UTC(year, month, 5, 1, 0, 0)) // Sun 01:00 UTC
}

/** Probe the breadth of each slot, not just one day, so weekend-only venues stand out. */
export const slotToProbeDates = (slot: NoiseTimeSlot): Date[] => {
  const year = 2026
  const month = 6 // July — avoids DST edge cases in UK summer time

  if (slot.part === "day") {
    const days = slot.week === "weekday" ? [6, 7, 8, 9, 10] : [11, 12]
    return days.flatMap((day) => [
      new Date(Date.UTC(year, month, day, 12, 0, 0)),
      new Date(Date.UTC(year, month, day, 17, 0, 0)),
    ])
  }

  const nightStarts = slot.week === "weekday" ? [6, 7, 8, 9] : [10, 11]
  return nightStarts.flatMap((day) => [
    new Date(Date.UTC(year, month, day, 23, 0, 0)),
    new Date(Date.UTC(year, month, day + 1, 1, 0, 0)),
    new Date(Date.UTC(year, month, day + 1, 3, 0, 0)),
  ])
}

const resolveAmenity = (
  amenity: string | null | undefined
): LocalNoiseAmenity => (isLocalNoiseAmenity(amenity) ? amenity : "pub")

const getFallbackActivity = (
  amenity: string | null | undefined,
  slot: NoiseTimeSlot
): number => {
  const key = resolveAmenity(amenity)
  return AMENITY_FALLBACK_ACTIVITY[key][slotKey(slot)]
}

const activityFromHours = (
  openingHours: string,
  slot: NoiseTimeSlot
): number | null => {
  try {
    const oh = new opening_hours(openingHours)
    const probes = slotToProbeDates(slot)
    const openProbeCount = probes.filter((probe) => oh.getState(probe)).length

    return openProbeCount / probes.length
  } catch {
    return null
  }
}

export const isVenueActiveInSlot = (
  openingHours: string | null | undefined,
  amenity: string | null | undefined,
  slot: NoiseTimeSlot
): boolean => {
  if (openingHours) {
    const parsed = activityFromHours(openingHours, slot)
    if (parsed !== null) {
      return parsed > 0
    }
  }

  return getFallbackActivity(amenity, slot) >= 0.5
}

export const venueSlotActivity = (
  openingHours: string | null | undefined,
  amenity: string | null | undefined,
  slot: NoiseTimeSlot
): number => {
  const key = resolveAmenity(amenity)
  const base = AMENITY_BASE_WEIGHT[key]

  if (openingHours) {
    const parsed = activityFromHours(openingHours, slot)
    if (parsed !== null) {
      return parsed > 0 ? base * Math.max(0.35, parsed) : 0
    }
  }

  return base * getFallbackActivity(amenity, slot)
}

export const venueActivityWeight = (
  openingHours: string | null | undefined,
  amenity: string | null | undefined,
  slot: NoiseTimeSlot,
  distanceMeters?: number
): number => {
  const activity = venueSlotActivity(openingHours, amenity, slot)

  if (distanceMeters === undefined) {
    return activity
  }

  const distanceFactor =
    distanceMeters <= 75
      ? 1
      : distanceMeters <= 150
        ? 0.85
        : distanceMeters <= 300
          ? 0.55
          : 0.25

  return activity * distanceFactor
}

export const computeLocalNoiseSourceScore = (
  features: Array<{
    amenity: string | null
    openingHours?: string | null
    distanceMeters: number
  }>,
  slot: NoiseTimeSlot
): number => {
  const localNoiseFeatures = features.filter((feature) =>
    isLocalNoiseAmenity(feature.amenity)
  )

  const raw = localNoiseFeatures.reduce((sum, feature) => {
    const weight = venueActivityWeight(
      feature.openingHours ?? null,
      feature.amenity,
      slot,
      feature.distanceMeters
    )
    return sum + weight * 12
  }, 0)

  return Math.min(100, Math.round(raw))
}

export type LocalNoiseTimeProfile = {
  overall: number
  day: number
  night: number
}

/** Peak local-source score across every weekday/weekend × day/night slot. */
export const computeLocalNoiseTimeProfile = (
  features: Array<{
    amenity: string | null
    openingHours?: string | null
    distanceMeters: number
  }>
): LocalNoiseTimeProfile => {
  const scores = ALL_NOISE_TIME_SLOTS().map((slot) => ({
    part: slot.part,
    score: computeLocalNoiseSourceScore(features, slot),
  }))

  const day = Math.max(
    0,
    ...scores.filter((item) => item.part === "day").map((item) => item.score)
  )
  const night = Math.max(
    0,
    ...scores.filter((item) => item.part === "night").map((item) => item.score)
  )

  return {
    overall: Math.max(day, night),
    day,
    night,
  }
}
