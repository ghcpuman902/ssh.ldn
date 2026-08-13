import {
  DEFAULT_NOISE_TIME_SLOT,
  decodeNoiseTimeSlot,
  encodeNoiseTimeSlot,
} from "@/lib/map/noise-time"
import {
  maxScoreForPart,
  type NoiseSlotScoreCell,
} from "@/lib/map/noise-slot-profile"
import { geocodeAddress } from "@/lib/server/geocode"
import { scoreFromBundle, type ScoreInput } from "@/lib/server/score"

export type AddressNoiseReportInput = {
  address: string
  floor?: number
  facing?: string
  timeSlot?: string
}

export type AddressNoiseReport = {
  address: {
    input: string
    normalized: string
    postcode: string | null
    coordinatePrecision: string
  }
  coordinates: {
    latitude: number
    longitude: number
  }
  timeSlot: {
    week: string
    part: string
    encoded: string
  }
  score: {
    noiseScore: number
    noiseBand: string
    confidenceScore: number
    confidenceBand: string
    contributors: Array<{ source: string; weight: number; score: number }>
    timeProfile: NoiseSlotScoreCell[]
    dominantSources: string[]
  }
  explanation: {
    summary: string
    why: string
    whenItMatters: string
    confidenceExplanation: string
    recommendedChecks: string[]
    sourceCitations: string[]
  }
  caveats: string[]
  geocodeWarnings: string[]
}

export type AddressNoiseReportError = {
  error: string
  status: number
}

const buildExplanation = (
  score: NonNullable<Awaited<ReturnType<typeof scoreFromBundle>>>,
  scoreInput: ScoreInput
) => {
  const dominant = score.dominantSources.join(" and ")

  return {
    summary: `${score.noiseBand} location with noise score ${score.noiseScore}/100. Dominant contributors: ${dominant}.`,
    why: `Official DEFRA baselines and nearby OSM features indicate ${dominant} as the main exposure drivers for this coordinate.`,
    whenItMatters:
      maxScoreForPart(score.timeProfile, "night") >
      maxScoreForPart(score.timeProfile, "day")
        ? "Night-time risk is higher than daytime; evenings and late visits are most revealing."
        : "Daytime transport exposure dominates; rush-hour visits are most revealing.",
    confidenceExplanation: `Confidence is ${score.confidenceBand.toLowerCase()} (${score.confidenceScore}/100) because floor=${scoreInput.floor ?? 0}, facing=${scoreInput.facing ?? "unknown"}, and source coverage vary.`,
    recommendedChecks: score.recommendedChecks,
    sourceCitations: [
      "DEFRA strategic noise mapping (Round 4)",
      "OpenStreetMap Overpass local context",
      "DfT road traffic count points",
      "planning.data.gov.uk / London Planning Datahub",
    ],
  }
}

export const buildAddressNoiseReport = async (
  input: AddressNoiseReportInput
): Promise<AddressNoiseReport | AddressNoiseReportError> => {
  const address = input.address.trim()

  if (!address) {
    return { error: "address is required", status: 400 }
  }

  const decodedTimeSlot = input.timeSlot
    ? decodeNoiseTimeSlot(input.timeSlot)
    : DEFAULT_NOISE_TIME_SLOT

  if (input.timeSlot && !decodedTimeSlot) {
    return {
      error:
        "timeSlot must be weekday-day, weekday-night, weekend-day, or weekend-night",
      status: 400,
    }
  }

  let geocode

  try {
    geocode = await geocodeAddress({ address })
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Geocoding failed",
      status: 404,
    }
  }

  const scoreInput: ScoreInput = {
    lat: geocode.latitude,
    lng: geocode.longitude,
    floor: input.floor ?? 0,
    facing: input.facing ?? "unknown",
    timeSlot: decodedTimeSlot ?? DEFAULT_NOISE_TIME_SLOT,
  }

  const score = await scoreFromBundle(scoreInput)

  if (!score) {
    return { error: "Score failed for this address", status: 404 }
  }

  return {
    address: {
      input: geocode.inputAddress,
      normalized: geocode.normalizedAddress,
      postcode: geocode.postcode,
      coordinatePrecision: geocode.coordinatePrecision,
    },
    coordinates: {
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    },
    timeSlot: {
      week: score.timeSlot.week,
      part: score.timeSlot.part,
      encoded: encodeNoiseTimeSlot(score.timeSlot),
    },
    score: {
      noiseScore: score.noiseScore,
      noiseBand: score.noiseBand,
      confidenceScore: score.confidenceScore,
      confidenceBand: score.confidenceBand,
      contributors: score.contributors,
      timeProfile: score.timeProfile,
      dominantSources: score.dominantSources,
    },
    explanation: buildExplanation(score, scoreInput),
    caveats: score.caveats,
    geocodeWarnings: geocode.warnings,
  }
}

export const formatAddressNoiseReportText = (report: AddressNoiseReport) => {
  const lines = [
    report.explanation.summary,
    report.explanation.why,
    report.explanation.whenItMatters,
    report.explanation.confidenceExplanation,
    `Time slot: ${report.timeSlot.encoded}.`,
    `Address: ${report.address.normalized}.`,
    `Coordinates: ${report.coordinates.latitude}, ${report.coordinates.longitude}.`,
  ]

  if (report.caveats.length > 0) {
    lines.push(`Caveats: ${report.caveats.join(" ")}`)
  }

  return lines.join("\n")
}
