export type ValueMode = "primary" | "passenger" | "cab"

export type PublicNoiseFilters = {
  line: string | null
  source: string | null
  position: string | null
  direction: string | null
  year: string | null
  confidence: string | null
  rights: string | null
  minDb: number | null
  maxDb: number | null
  valueMode: ValueMode
  segment: string | null
}

export const DEFAULT_PUBLIC_NOISE_FILTERS: PublicNoiseFilters = {
  line: null,
  source: null,
  position: null,
  direction: null,
  year: null,
  confidence: null,
  rights: null,
  minDb: null,
  maxDb: null,
  valueMode: "primary",
  segment: null,
}

const parseOptionalNumber = (raw: string | null) => {
  if (raw === null || raw === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const ALLOWED_VALUE_MODES = new Set<ValueMode>(["primary", "passenger", "cab"])

export const parsePublicNoiseFilters = (
  params: URLSearchParams | { get: (key: string) => string | null },
): PublicNoiseFilters => {
  const valueModeRaw = params.get("mode") ?? "primary"
  const valueMode = ALLOWED_VALUE_MODES.has(valueModeRaw as ValueMode)
    ? (valueModeRaw as ValueMode)
    : "primary"

  return {
    line: params.get("line") || null,
    source: params.get("source") || null,
    position: params.get("position") || null,
    direction: params.get("direction") || null,
    year: params.get("year") || null,
    confidence: params.get("confidence") || null,
    rights: params.get("rights") || null,
    minDb: parseOptionalNumber(params.get("minDb")),
    maxDb: parseOptionalNumber(params.get("maxDb")),
    valueMode,
    segment: params.get("segment") || null,
  }
}

export const serializePublicNoiseFilters = (filters: PublicNoiseFilters) => {
  const params = new URLSearchParams()

  if (filters.line) params.set("line", filters.line)
  if (filters.source) params.set("source", filters.source)
  if (filters.position) params.set("position", filters.position)
  if (filters.direction) params.set("direction", filters.direction)
  if (filters.year) params.set("year", filters.year)
  if (filters.confidence) params.set("confidence", filters.confidence)
  if (filters.rights) params.set("rights", filters.rights)
  if (filters.minDb !== null) params.set("minDb", String(filters.minDb))
  if (filters.maxDb !== null) params.set("maxDb", String(filters.maxDb))
  if (filters.valueMode !== "primary") params.set("mode", filters.valueMode)
  if (filters.segment) params.set("segment", filters.segment)

  return params.toString()
}

export const getSegmentDisplayValue = (
  properties: {
    valueDb: number | null
    passengerValueDb: number | null
    cabValueDb: number | null
  },
  mode: ValueMode,
) => {
  if (mode === "passenger") return properties.passengerValueDb
  if (mode === "cab") return properties.cabValueDb
  return properties.valueDb
}

export const segmentMatchesFilters = (
  properties: {
    lineId: string
    sourceIds: string[]
    positions: string[]
    dateMin: string | null
    dateMax: string | null
    confidenceTier: string
    rights: string
    valueDb: number | null
    passengerValueDb: number | null
    cabValueDb: number | null
    hasPassenger: boolean
    hasCab: boolean
  },
  filters: PublicNoiseFilters,
) => {
  if (filters.line && properties.lineId !== filters.line) return false
  if (filters.source && !properties.sourceIds.includes(filters.source)) return false
  if (filters.position && !properties.positions.includes(filters.position)) {
    return false
  }
  if (filters.confidence && properties.confidenceTier !== filters.confidence) {
    return false
  }
  if (filters.rights && properties.rights !== filters.rights) return false

  if (filters.year) {
    const year = filters.year
    const inRange = (date: string | null) =>
      Boolean(date && date.startsWith(year))
    if (!inRange(properties.dateMin) && !inRange(properties.dateMax)) {
      return false
    }
  }

  if (filters.valueMode === "passenger" && !properties.hasPassenger) return false
  if (filters.valueMode === "cab" && !properties.hasCab) return false

  const display = getSegmentDisplayValue(properties, filters.valueMode)
  if (filters.minDb !== null && (display === null || display < filters.minDb)) {
    return false
  }
  if (filters.maxDb !== null && (display === null || display > filters.maxDb)) {
    return false
  }

  return true
}
