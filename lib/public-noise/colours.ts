export type NoiseRights = "open" | "unknown" | "restricted"

export type NoisePosition =
  | "standing"
  | "seated"
  | "cab"
  | "test-vehicle"
  | "passenger"
  | "passenger-smartphone"

export type PublicNoiseObservation = {
  id: string
  sourceId: string
  lineId: string
  lineName: string
  fromStation: string
  toStation: string
  direction: string
  date: string
  stock: string
  position: NoisePosition | string
  metric: string
  valueDb: number
  unit: string
  durationSeconds: number | null
  confidenceTier: "A" | "B" | "C"
  rights: NoiseRights
  notes: string | null
  segmentId?: string | null
  matchStatus?: string
  fromStationId?: string
  toStationId?: string
}

export type PublicNoiseSegmentProperties = {
  segmentId: string
  lineId: string
  lineName: string
  fromStation: string
  toStation: string
  fromStationId: string
  toStationId: string
  valueDb: number | null
  passengerValueDb: number | null
  cabValueDb: number | null
  metric: string
  unit: string
  observationCount: number
  dateMin: string | null
  dateMax: string | null
  positions: string[]
  sourceIds: string[]
  rights: NoiseRights
  confidenceTier: "A" | "B" | "C"
  geometryFallback: boolean
  hasPassenger: boolean
  hasCab: boolean
}

export type PublicNoiseSource = {
  id: string
  title: string
  provider: string
  url: string
  rights: NoiseRights
  rightsLabel: string
  mapReady?: boolean
  confidenceTier?: string
  coverage?: string
  notes?: string
  localPath?: string
  format?: string
  documentDate?: string
  measurementDate?: string
  position?: string[]
  stock?: string
  metric?: string[]
  foi?: string
}

/**
 * Exaggerated air-quality ramp: green (quieter) → yellow → orange → red → purple (noisier).
 * High chroma so adjacent bands stay visually distinct on the map.
 */
export const NOISE_COLOUR_STOPS = [
  { db: 70, color: "#00c853" }, // vivid green
  { db: 78, color: "#ffeb3b" }, // yellow
  { db: 84, color: "#ff9800" }, // orange
  { db: 90, color: "#f44336" }, // red
  { db: 96, color: "#9c27b0" }, // purple
  { db: 105, color: "#4a148c" }, // deep purple
] as const

export const NO_DATA_COLOUR = "#9ca3af"

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "")
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const colourForDb = (valueDb: number | null | undefined): string => {
  if (valueDb === null || valueDb === undefined || !Number.isFinite(valueDb)) {
    return NO_DATA_COLOUR
  }

  if (valueDb <= NOISE_COLOUR_STOPS[0].db) return NOISE_COLOUR_STOPS[0].color
  if (valueDb >= NOISE_COLOUR_STOPS[NOISE_COLOUR_STOPS.length - 1].db) {
    return NOISE_COLOUR_STOPS[NOISE_COLOUR_STOPS.length - 1].color
  }

  for (let i = 0; i < NOISE_COLOUR_STOPS.length - 1; i++) {
    const a = NOISE_COLOUR_STOPS[i]
    const b = NOISE_COLOUR_STOPS[i + 1]
    if (valueDb >= a.db && valueDb <= b.db) {
      const t = (valueDb - a.db) / (b.db - a.db)
      const ca = hexToRgb(a.color)
      const cb = hexToRgb(b.color)
      const r = Math.round(lerp(ca.r, cb.r, t))
      const g = Math.round(lerp(ca.g, cb.g, t))
      const bch = Math.round(lerp(ca.b, cb.b, t))
      return `#${[r, g, bch].map((n) => n.toString(16).padStart(2, "0")).join("")}`
    }
  }

  return NO_DATA_COLOUR
}

/** MapLibre interpolate expression for line color from feature property. */
export const mapLibreNoiseColourExpression = (
  property: "valueDb" | "passengerValueDb" | "cabValueDb" = "valueDb",
) =>
  [
    "case",
    ["==", ["get", property], null],
    NO_DATA_COLOUR,
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", property]],
      ...NOISE_COLOUR_STOPS.flatMap((stop) => [stop.db, stop.color]),
    ],
  ] as unknown as import("maplibre-gl").ExpressionSpecification

export const LEGEND_BANDS = [
  { label: "≤ 70 dBA", color: NOISE_COLOUR_STOPS[0].color },
  { label: "~78 dBA", color: NOISE_COLOUR_STOPS[1].color },
  { label: "~84 dBA", color: NOISE_COLOUR_STOPS[2].color },
  { label: "~90 dBA", color: NOISE_COLOUR_STOPS[3].color },
  { label: "~96 dBA", color: NOISE_COLOUR_STOPS[4].color },
  { label: "≥ 105 dBA", color: NOISE_COLOUR_STOPS[5].color },
  { label: "No data", color: NO_DATA_COLOUR },
] as const
