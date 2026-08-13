import type { AnalyseState } from "@/components/map/map-analyse-panel"
import { getNoiseContributorMeta } from "@/lib/map/noise-contributor-meta"
import {
  encodeNoiseTimeSlot,
  formatNoiseAnalysisSlot,
  formatNoiseTimeSlot,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time"
import type { NoiseSlotScoreCell } from "@/lib/map/noise-slot-profile"

export type LocationContributor = {
  source: string
  weight: number
  score: number
}

export type LocationTimeProfile = NoiseSlotScoreCell[]

export type LocationPlanningApplication = {
  reference: string | null
  description: string | null
  status: string | null
  decisionDate: string | null
  distanceMeters: number | null
  planningAuthority: string | null
}

export type LocationContext = {
  address: string
  inputAddress: string
  primaryAddress: string
  normalizedAddress: string
  postcode: string | null
  latitude: number
  longitude: number
  coordinatePrecision: string
  noiseScore: number | null
  noiseBand: string | null
  confidenceScore: number | null
  confidenceBand: string | null
  dominantSources: string[]
  contributors: LocationContributor[]
  timeProfile: LocationTimeProfile | null
  planningApplications: LocationPlanningApplication[]
  caveats: string[]
  recommendedChecks: string[]
  timeSlot: NoiseTimeSlot
  warnings: string[]
}

export type LocationContextDynamicVariables = {
  location_address: string
  location_search_address: string
  location_geocode_address: string
  location_postcode: string
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

export const resolvePrimaryAddress = (
  searchAddress: string,
  inputAddress: string,
  normalizedAddress: string
) => {
  const candidates = [searchAddress, inputAddress, normalizedAddress]
    .map((value) => value.trim())
    .filter(Boolean)

  const uniqueCandidates = [...new Set(candidates)]

  return uniqueCandidates.reduce(
    (longest, current) => (current.length > longest.length ? current : longest),
    uniqueCandidates[0] ?? searchAddress
  )
}

export const enrichLocationContext = (
  context: LocationContext
): LocationContext => {
  const inputAddress = context.inputAddress ?? context.address

  return {
    ...context,
    inputAddress,
    primaryAddress:
      context.primaryAddress ??
      resolvePrimaryAddress(
        context.address,
        inputAddress,
        context.normalizedAddress
      ),
    postcode: context.postcode ?? null,
    contributors: context.contributors ?? [],
    timeProfile: context.timeProfile ?? null,
    planningApplications: context.planningApplications ?? [],
    caveats: context.caveats ?? [],
    recommendedChecks: context.recommendedChecks ?? [],
  }
}

export const locationContextFromAnalyse = (
  state: Extract<AnalyseState, { status: "analysing" }>,
  timeSlot: NoiseTimeSlot
): LocationContext | null => {
  if (state.geocode.status !== "done") {
    return null
  }

  const geocode = state.geocode.data
  const score = state.score.status === "done" ? state.score.data : null
  const planningApplications =
    state.planning.status === "done" ? state.planning.data : []
  const inputAddress = geocode.inputAddress
  const normalizedAddress = geocode.normalizedAddress

  return enrichLocationContext({
    address: state.address,
    inputAddress,
    primaryAddress: resolvePrimaryAddress(
      state.address,
      inputAddress,
      normalizedAddress
    ),
    normalizedAddress,
    postcode: geocode.postcode,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
    coordinatePrecision: geocode.coordinatePrecision,
    noiseScore: score?.noiseScore ?? null,
    noiseBand: score?.noiseBand ?? null,
    confidenceScore: score?.confidenceScore ?? null,
    confidenceBand: score?.confidenceBand ?? null,
    dominantSources: score?.dominantSources ?? [],
    contributors:
      score?.contributors.map((contributor) => ({
        source: contributor.source,
        weight: contributor.weight,
        score: contributor.score,
      })) ?? [],
    timeProfile: score?.timeProfile ?? null,
    planningApplications: planningApplications.map((application) => ({
      reference: application.reference,
      description: application.description,
      status: application.status,
      decisionDate: application.decisionDate,
      distanceMeters: application.distanceMeters,
      planningAuthority: application.planningAuthority,
    })),
    caveats: score?.caveats ?? [],
    recommendedChecks: score?.recommendedChecks ?? [],
    timeSlot,
    warnings: geocode.warnings,
  })
}

export const toDynamicVariables = (
  context: LocationContext,
  contextSessionId: string
): LocationContextDynamicVariables => {
  const enriched = enrichLocationContext(context)

  return {
    location_address: enriched.primaryAddress,
    location_search_address: enriched.address,
    location_geocode_address: enriched.normalizedAddress,
    location_postcode: enriched.postcode ?? "unknown",
    location_lat: enriched.latitude.toFixed(5),
    location_lng: enriched.longitude.toFixed(5),
    noise_score:
      enriched.noiseScore !== null ? String(enriched.noiseScore) : "unknown",
    noise_band: enriched.noiseBand ?? "unknown",
    confidence_score:
      enriched.confidenceScore !== null
        ? String(enriched.confidenceScore)
        : "unknown",
    confidence_band: enriched.confidenceBand ?? "unknown",
    dominant_sources:
      enriched.dominantSources.length > 0
        ? enriched.dominantSources.map(formatSourceLabel).join(", ")
        : "none identified",
    time_slot: formatNoiseTimeSlot(enriched.timeSlot),
    context_session_id: contextSessionId,
  }
}

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
    location_search_address: readString("location_search_address"),
    location_geocode_address: readString("location_geocode_address"),
    location_postcode: readString("location_postcode"),
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
  const enriched = enrichLocationContext(context)
  const dominantSources =
    enriched.dominantSources.length > 0
      ? enriched.dominantSources.map(formatSourceLabel).join(", ")
      : "none identified"

  const contributorLines =
    enriched.contributors.length > 0
      ? enriched.contributors.map(
          (contributor) =>
            `  - ${getNoiseContributorMeta(contributor.source).label}: contributes ${contributor.score}% of the noise (weighting ${contributor.weight})`
        )
      : ["  - No per-source breakdown available"]

  const timeProfileLine = enriched.timeProfile?.length
    ? `- Noise by time: ${enriched.timeProfile
        .map(
          (cell) =>
            `${formatNoiseAnalysisSlot(cell)} ${cell.score}`
        )
        .join("; ")}`
    : "- Noise by time of day: unavailable"

  const planningLines =
    enriched.planningApplications.length > 0
      ? enriched.planningApplications.map((application) => {
          const details = [
            application.description ??
              application.reference ??
              "Planning application",
            application.status ? `status ${application.status}` : null,
            application.distanceMeters !== null
              ? `${application.distanceMeters}m away`
              : null,
            application.planningAuthority,
          ]
            .filter(Boolean)
            .join(" · ")
          return `  - ${details}`
        })
      : ["  - None found nearby"]

  const caveatLines =
    enriched.caveats.length > 0
      ? enriched.caveats.map((caveat) => `  - ${caveat}`)
      : ["  - None"]

  const recommendedCheckLines =
    enriched.recommendedChecks.length > 0
      ? enriched.recommendedChecks.map((check) => `  - ${check}`)
      : ["  - None"]

  const warnings =
    enriched.warnings.length > 0 ? enriched.warnings.join(" ") : "none"

  return [
    "You are ssh-ldn, a concise London noise analyst helping someone understand a specific address.",
    "The location context below is the complete noise analysis for this address. Answer questions using it.",
    "The noise sources — aircraft (airport), road, rail, local venues, and traffic — and their percentage contributions are all part of this analysis, so explain any of them when asked (for example, aircraft/airport noise, rail noise, or how noisy it is at night).",
    "Only decline if a question is genuinely unrelated to this location or its noise (for example, general trivia); then say you only have the noise analysis for this address.",
    "When the user asks about the address, property, or where this is, always give the full property address from Primary address below.",
    "Do not answer with only the postcode unless they specifically ask for the postcode.",
    "Keep spoken answers extremely short: one sentence by default, two only when necessary.",
    "This voice mode is designed for screen-reader users. If they ask to stop, tell them to press Escape or the Stop voice mode button to return to normal screen-reader navigation.",
    "You may use ElevenLabs v3 audio tags sparingly for emphasis, for example [thoughtful] or [reassuring], but do not overuse them.",
    "",
    "Location context:",
    `- Primary address: ${enriched.primaryAddress}`,
    `- Search address: ${enriched.address}`,
    `- Geocode match: ${enriched.normalizedAddress}`,
    `- Postcode: ${enriched.postcode ?? "unknown"}`,
    `- Coordinates: ${enriched.latitude.toFixed(5)}, ${enriched.longitude.toFixed(5)}`,
    `- Coordinate precision: ${enriched.coordinatePrecision.replaceAll("_", " ")}`,
    `- Time slot analysed: ${formatNoiseTimeSlot(enriched.timeSlot)} (${encodeNoiseTimeSlot(enriched.timeSlot)})`,
    `- Noise score: ${enriched.noiseScore ?? "unavailable"}`,
    `- Noise band: ${enriched.noiseBand ?? "unavailable"}`,
    `- Confidence score: ${enriched.confidenceScore ?? "unavailable"}`,
    `- Confidence band: ${enriched.confidenceBand ?? "unavailable"}`,
    `- Dominant sources: ${dominantSources}`,
    "- Noise source breakdown:",
    ...contributorLines,
    timeProfileLine,
    "- Nearby planning applications:",
    ...planningLines,
    "- Caveats:",
    ...caveatLines,
    "- Recommended checks:",
    ...recommendedCheckLines,
    `- Notes: ${warnings}`,
  ].join("\n")
}

export const buildVoiceFirstMessage = (context: LocationContext) => {
  const enriched = enrichLocationContext(context)
  const scoreLabel =
    enriched.noiseScore !== null && enriched.noiseBand
      ? ` The noise score is ${enriched.noiseScore}, rated ${enriched.noiseBand}.`
      : " I do not have a score for this spot yet."

  return `Ready for ${enriched.primaryAddress}.${scoreLabel} Ask a quick question, or press Escape to stop.`
}
