import type { MapTheme } from "@/lib/map/basemap-style"

/** Day (07:00–19:00) vs night (23:00–07:00) — maps to DEFRA Lday / Lnight WMS layers. */
export type NoiseDayPart = "day" | "night"

export type NoiseWeekSegment = "weekday" | "weekend"

export type NoiseTimeSlot = {
  week: NoiseWeekSegment
  part: NoiseDayPart
}

export const WEEK_SEGMENT_LABELS: Record<NoiseWeekSegment, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
}

/**
 * Days each segment covers. A night belongs to the evening it starts on, so
 * Fri and Sat nights are the weekend and Sun night is back to the week.
 */
export const WEEK_SEGMENT_DAYS: Record<
  NoiseDayPart,
  Record<NoiseWeekSegment, string>
> = {
  day: { weekday: "Mon–Fri", weekend: "Sat–Sun" },
  night: { weekday: "Sun–Thu", weekend: "Fri–Sat" },
}

/** Short letter-day markers used as grid column headers (Mon–Fri / Sat–Sun). */
export const WEEK_SEGMENT_LETTERS: Record<NoiseWeekSegment, string> = {
  weekday: "M T W T F",
  weekend: "S S",
}

export const NOISE_DAY_PARTS: Array<{
  part: NoiseDayPart
  label: string
  hours: string
}> = [
  { part: "day", label: "Day", hours: "07:00–19:00" },
  { part: "night", label: "Night", hours: "23:00–07:00" },
]

/** DEFRA Lday / Leve / Lnight windows — used by the address panel, not the map toggle. */
export type NoiseAnalysisPart = "day" | "evening" | "night"

export type NoiseAnalysisSlot = {
  week: NoiseWeekSegment
  part: NoiseAnalysisPart
}

export const ANALYSIS_DAY_PARTS: Array<{
  part: NoiseAnalysisPart
  label: string
  hours: string
  durationHours: number
}> = [
  { part: "day", label: "Day", hours: "07:00–19:00", durationHours: 12 },
  { part: "evening", label: "Evening", hours: "19:00–23:00", durationHours: 4 },
  { part: "night", label: "Night", hours: "23:00–07:00", durationHours: 8 },
]

export const WEEK_SEGMENTS: NoiseWeekSegment[] = ["weekday", "weekend"]

export const encodeNoiseAnalysisSlot = ({ week, part }: NoiseAnalysisSlot) =>
  `${week}-${part}`

export const formatNoiseAnalysisSlot = ({ week, part }: NoiseAnalysisSlot) => {
  const partLabel =
    ANALYSIS_DAY_PARTS.find(
      (item) => item.part === part
    )?.label.toLowerCase() ?? part
  return `${WEEK_SEGMENT_LABELS[week]} ${partLabel}`
}

export const ALL_NOISE_ANALYSIS_SLOTS = (): NoiseAnalysisSlot[] =>
  WEEK_SEGMENTS.flatMap((week) =>
    ANALYSIS_DAY_PARTS.map(({ part }) => ({ week, part }))
  )

export const DEFAULT_NOISE_TIME_SLOT: NoiseTimeSlot = {
  week: "weekday",
  part: "day",
}

const LONDON_TIME_ZONE = "Europe/London"

const getLondonClock = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date)

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon"
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 12)

  return { weekday, hour }
}

const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Map the current London clock to the nearest UI time slot. Days are Sat–Sun
 * weekends; nights count from the evening they start on, so Fri 19:00 →
 * Sat 07:00 is a weekend night and Sun 19:00 → Mon 07:00 a weekday night.
 */
export const getCurrentNoiseTimeSlot = (
  date: Date = new Date()
): NoiseTimeSlot => {
  const { weekday, hour } = getLondonClock(date)
  const part: NoiseDayPart = hour >= 7 && hour < 19 ? "day" : "night"

  if (part === "day") {
    const week = weekday === "Sat" || weekday === "Sun" ? "weekend" : "weekday"
    return { week, part }
  }

  const today = Math.max(0, WEEKDAY_ORDER.indexOf(weekday))
  const nightStart = WEEKDAY_ORDER[hour < 7 ? (today + 6) % 7 : today]
  const week =
    nightStart === "Fri" || nightStart === "Sat" ? "weekend" : "weekday"
  return { week, part }
}

export const encodeNoiseTimeSlot = ({ week, part }: NoiseTimeSlot) =>
  `${week}-${part}`

export const decodeNoiseTimeSlot = (value: string): NoiseTimeSlot | null => {
  const match = /^(weekday|weekend)-(day|night)$/.exec(value)
  if (!match) return null
  return { week: match[1] as NoiseWeekSegment, part: match[2] as NoiseDayPart }
}

export const formatNoiseTimeSlot = ({ week, part }: NoiseTimeSlot) => {
  const weekLabel = WEEK_SEGMENT_LABELS[week]
  const partLabel = part === "day" ? "daytime" : "night-time"
  return `${weekLabel} ${partLabel}`
}

/** Compact map-control label: "weekday day", "weekend night". */
export const formatNoiseTimeSlotShort = ({ week, part }: NoiseTimeSlot) =>
  `${week} ${part}`

/** DEFRA Round 4 is a yearly average. Weekday/weekend only changes local modifiers, not the raster. */
export const DEFRA_TIME_SLOT_NOTE =
  "DEFRA maps are yearly averages. Day and night switch the official layers. Weekday vs weekend only changes local sources and traffic."

export const isWeekendNight = ({ week, part }: NoiseTimeSlot) =>
  week === "weekend" && part === "night"

/** The basemap lighting is the day/night indicator: day = Positron, night = Dark Matter. */
export const mapThemeForTimeSlot = ({ part }: NoiseTimeSlot): MapTheme =>
  part === "night" ? "dark" : "light"

/** Title-case label for the time picker and live region: "Weekend night". */
export const formatNoiseTimeSlotTitle = ({ week, part }: NoiseTimeSlot) =>
  `${WEEK_SEGMENT_LABELS[week]} ${part === "day" ? "day" : "night"}`
