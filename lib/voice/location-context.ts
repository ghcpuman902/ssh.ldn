import type { AnalyseState } from "@/components/map/map-analyse-panel"
import {
  encodeNoiseTimeSlot,
  type NoiseTimeSlot,
  WEEK_SEGMENT_LABELS,
  NOISE_DAY_PARTS,
} from "@/lib/map/noise-time"

export type LocationContext = {
  address: string
  normalizedAddress: string
  latitude: number
  longitude: number
  coordinatePrecision: string
  noiseScore: number | null
  noiseBand: string | null
  confidenceScore: number | null
  confidenceBand: string | null
  dominantSources: string[]
  timeSlot: NoiseTimeSlot
  warnings: string[]
}

export type LocationContextDynamicVariables = {
  location_address: string
  location_lat: string
  location_lng: string
  noise_score: string
  noise_band: string
  confidence_score: string
  confidence_band: string
  dominant_sources: string
  time_slot: string
  context_session_id: string
}

const formatSourceLabel = (source: string) => {
  switch (source) {
    case "road":
      return "Road"
    case "rail":
      return "Rail"
    case "airport":
      return "Aircraft"
    case "nightlife":
      return "Local sources"
    case "traffic":
      return "Traffic"
    default:
      return source
  }
}

const formatTimeSlotLabel = ({ week, part }: NoiseTimeSlot) => {
  const weekLabel = WEEK_SEGMENT_LABELS[week]
  const partLabel =
    NOISE_DAY_PARTS.find((entry) => entry.part === part)?.label ?? part
  return `${weekLabel} ${partLabel}`
}

export const locationContextFromAnalyse = (
  state: Extract<AnalyseState, { status: "ready" }>,
  timeSlot: NoiseTimeSlot
): LocationContext => ({
  address: state.address,
  normalizedAddress: state.geocode.normalizedAddress,
  latitude: state.geocode.latitude,
  longitude: state.geocode.longitude,
  coordinatePrecision: state.geocode.coordinatePrecision,
  noiseScore: state.score?.noiseScore ?? null,
  noiseBand: state.score?.noiseBand ?? null,
  confidenceScore: state.score?.confidenceScore ?? null,
  confidenceBand: state.score?.confidenceBand ?? null,
  dominantSources: state.score?.dominantSources ?? [],
  timeSlot,
  warnings: state.geocode.warnings,
})

export const toDynamicVariables = (
  context: LocationContext,
  contextSessionId: string
): LocationContextDynamicVariables => ({
  location_address: context.normalizedAddress,
  location_lat: context.latitude.toFixed(5),
  location_lng: context.longitude.toFixed(5),
  noise_score:
    context.noiseScore !== null ? String(context.noiseScore) : "unknown",
  noise_band: context.noiseBand ?? "unknown",
  confidence_score:
    context.confidenceScore !== null
      ? String(context.confidenceScore)
      : "unknown",
  confidence_band: context.confidenceBand ?? "unknown",
  dominant_sources:
    context.dominantSources.length > 0
      ? context.dominantSources.map(formatSourceLabel).join(", ")
      : "none identified",
  time_slot: formatTimeSlotLabel(context.timeSlot),
  context_session_id: contextSessionId,
})

export const parseDynamicVariables = (
  variables: Record<string, string | number | boolean> | undefined
): Partial<LocationContextDynamicVariables> | null => {
  if (!variables) {
    return null
  }

  const readString = (key: keyof LocationContextDynamicVariables) => {
    const value = variables[key]
    if (value === undefined || value === null) {
      return undefined
    }

    return String(value)
  }

  const parsed: Partial<LocationContextDynamicVariables> = {
    location_address: readString("location_address"),
    location_lat: readString("location_lat"),
    location_lng: readString("location_lng"),
    noise_score: readString("noise_score"),
    noise_band: readString("noise_band"),
    confidence_score: readString("confidence_score"),
    confidence_band: readString("confidence_band"),
    dominant_sources: readString("dominant_sources"),
    time_slot: readString("time_slot"),
    context_session_id: readString("context_session_id"),
  }

  const hasValues = Object.values(parsed).some(
    (value) => value !== undefined && value.length > 0
  )

  if (!hasValues) {
    return null
  }

  return parsed
}

export const buildLocationContextPrompt = (context: LocationContext) => {
  const dominantSources =
    context.dominantSources.length > 0
      ? context.dominantSources.map(formatSourceLabel).join(", ")
      : "none identified"

  const warnings =
    context.warnings.length > 0
      ? context.warnings.slice(0, 3).join(" ")
      : "none"

  return [
    "You are ssh.ldn, a concise London noise analyst helping someone understand a specific address.",
    "Answer only using the trusted location context below.",
    "If the question is outside this context, say you only have data for the analysed location.",
    "Keep spoken answers short: two to four sentences unless the user asks for detail.",
    "",
    "Location context:",
    `- Search address: ${context.address}`,
    `- Normalized address: ${context.normalizedAddress}`,
    `- Coordinates: ${context.latitude.toFixed(5)}, ${context.longitude.toFixed(5)}`,
    `- Coordinate precision: ${context.coordinatePrecision.replaceAll("_", " ")}`,
    `- Time profile: ${formatTimeSlotLabel(context.timeSlot)} (${encodeNoiseTimeSlot(context.timeSlot)})`,
    `- Noise score: ${context.noiseScore ?? "unavailable"}`,
    `- Noise band: ${context.noiseBand ?? "unavailable"}`,
    `- Confidence score: ${context.confidenceScore ?? "unavailable"}`,
    `- Confidence band: ${context.confidenceBand ?? "unavailable"}`,
    `- Dominant sources: ${dominantSources}`,
    `- Notes: ${warnings}`,
  ].join("\n")
}

export const buildVoiceFirstMessage = (context: LocationContext) => {
  const scoreLabel =
    context.noiseScore !== null && context.noiseBand
      ? ` The noise score is ${context.noiseScore}, rated ${context.noiseBand}.`
      : " I do not have a score for this spot yet."

  return `I am ready to talk about ${context.normalizedAddress}.${scoreLabel} What would you like to know about noise here?`
}
