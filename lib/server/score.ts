import {
  buildEvidenceBundle,
  buildEvidenceBundleFromCoordinates,
} from "@/lib/server/bundle"
import {
  computeLocalNoiseSourceScore,
  isLocalNoiseAmenity,
} from "@/lib/map/venue-time"
import {
  DEFAULT_NOISE_TIME_SLOT,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time"

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const normalizeDb = (value: number | null, min = 45, max = 80) => {
  if (value === null) {
    return 0
  }
  return clamp(((value - min) / (max - min)) * 100, 0, 100)
}

const bandFromScore = (score: number) => {
  if (score >= 75) {
    return "Transport-dominated"
  }
  if (score >= 55) {
    return "High noise risk"
  }
  if (score >= 35) {
    return "Mixed"
  }
  return "Low risk"
}

const PLANNING_RADIUS_METERS = 300
const PLANNING_RECENCY_YEARS = 2
const PLANNING_MILLIS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

type PlanningApplicationLike = {
  distanceMeters: number | null
  decisionDate: string | null
  status: string | null
}

const isPlanningApplicationActive = (
  application: PlanningApplicationLike,
  now: number
) => {
  const statusLower = application.status?.toLowerCase() ?? ""
  if (
    !application.status ||
    /pending|undecided|submitted|awaiting|progress/.test(statusLower)
  ) {
    return true
  }

  if (!application.decisionDate) {
    return true
  }

  const decisionTime = Date.parse(application.decisionDate)
  if (Number.isNaN(decisionTime)) {
    return true
  }

  const ageYears = (now - decisionTime) / PLANNING_MILLIS_PER_YEAR
  return ageYears <= PLANNING_RECENCY_YEARS
}

/** Nearby construction/development activity is a plausible near-term noise source. */
const computePlanningScore = (applications: PlanningApplicationLike[]) => {
  const now = Date.now()

  const contribution = applications.reduce((total, application) => {
    if (
      application.distanceMeters === null ||
      application.distanceMeters > PLANNING_RADIUS_METERS
    ) {
      return total
    }

    const proximityWeight =
      1 - application.distanceMeters / PLANNING_RADIUS_METERS
    const activityWeight = isPlanningApplicationActive(application, now)
      ? 1
      : 0.4

    return total + proximityWeight * activityWeight * 35
  }, 0)

  return clamp(contribution, 0, 100)
}

export type ScoreInput = {
  testPointId?: string
  lat?: number
  lng?: number
  floor?: number
  facing?: string
  timeSlot?: NoiseTimeSlot
}

export const scoreFromBundle = async ({
  testPointId,
  lat,
  lng,
  floor = 0,
  facing = "unknown",
  timeSlot = DEFAULT_NOISE_TIME_SLOT,
}: ScoreInput) => {
  const bundle =
    testPointId !== undefined
      ? await buildEvidenceBundle(testPointId)
      : lat !== undefined && lng !== undefined
        ? await buildEvidenceBundleFromCoordinates(lat, lng)
        : null

  if (!bundle) {
    return null
  }

  const road = bundle.sources.road.roadLden as number | null
  const rail = bundle.sources.rail.railLden as number | null
  const airport = bundle.sources.airport.airportLden as number | null

  const localNoiseFeatures = bundle.sources.osm.features.filter((feature) =>
    isLocalNoiseAmenity(feature.amenity)
  )
  const localNoiseScoreInputs = localNoiseFeatures.map((feature) => ({
    amenity: feature.amenity,
    openingHours: feature.openingHours,
    distanceMeters: feature.distanceMeters,
  }))
  const localNoiseDayScore = computeLocalNoiseSourceScore(
    localNoiseScoreInputs,
    { week: timeSlot.week, part: "day" }
  )
  const localNoiseNightScore = computeLocalNoiseSourceScore(
    localNoiseScoreInputs,
    { week: timeSlot.week, part: "night" }
  )
  const localNoiseScore =
    timeSlot.part === "day" ? localNoiseDayScore : localNoiseNightScore

  const roadScore = normalizeDb(road)
  const railScore = normalizeDb(rail)
  const airportScore = normalizeDb(airport, 40, 65)
  const trafficScore = bundle.sources.dft.aadfTotal
    ? Math.min(100, bundle.sources.dft.aadfTotal / 500)
    : 0
  const planningApplications = bundle.sources.planning.applications
  const planningScore = computePlanningScore(planningApplications)
  const floorAdj = clamp(1 - Math.max(floor - 1, 0) * 0.03, 0.7, 1)

  const weighted =
    0.3 * roadScore +
    0.22 * railScore +
    0.13 * airportScore +
    0.15 * localNoiseScore +
    0.1 * trafficScore +
    0.1 * planningScore

  const noiseScore = Math.round(clamp(weighted * floorAdj, 0, 100))
  const confidenceScore = Math.round(
    clamp(
      55 +
        (road !== null ? 10 : 0) +
        (rail !== null ? 10 : 0) +
        (floor > 0 ? 10 : 0) +
        (facing !== "unknown" ? 5 : 0) +
        (localNoiseFeatures.length > 0 ? 5 : 0) +
        (planningApplications.length > 0 ? 5 : 0),
      0,
      100
    )
  )

  const contributors = [
    { source: "road", weight: 0.3, score: Math.round(roadScore) },
    { source: "rail", weight: 0.22, score: Math.round(railScore) },
    { source: "airport", weight: 0.13, score: Math.round(airportScore) },
    { source: "nightlife", weight: 0.15, score: Math.round(localNoiseScore) },
    { source: "traffic", weight: 0.1, score: Math.round(trafficScore) },
    { source: "planning", weight: 0.1, score: Math.round(planningScore) },
  ].sort((a, b) => b.score - a.score)

  return {
    testPointId: bundle.testPointId,
    latitude: bundle.latitude,
    longitude: bundle.longitude,
    floor,
    facing,
    timeSlot,
    noiseScore,
    noiseBand: bandFromScore(noiseScore),
    confidenceScore,
    confidenceBand:
      confidenceScore >= 75 ? "High" : confidenceScore >= 55 ? "Medium" : "Low",
    contributors,
    timeProfile: {
      day: Math.round(
        Math.max(
          normalizeDb(bundle.sources.road.roadLday as number | null),
          localNoiseDayScore
        )
      ),
      evening: Math.round(
        normalizeDb(bundle.sources.road.roadEvening as number | null)
      ),
      night: Math.round(
        Math.max(
          normalizeDb(bundle.sources.road.roadLnight as number | null),
          normalizeDb(bundle.sources.rail.railLnight as number | null),
          localNoiseNightScore
        )
      ),
    },
    dominantSources: contributors.slice(0, 2).map((item) => item.source),
    evidenceRows: bundle.sources.osm.features.slice(0, 8),
    caveats: bundle.warnings,
    recommendedChecks: [
      "Visit during the active period if nearby venues, hospitals, or rail metrics are elevated.",
      "Confirm floor and street-facing orientation before relying on the score.",
    ],
  }
}

export const explainFromScore = async (input: ScoreInput) => {
  const score = await scoreFromBundle(input)
  if (!score) {
    return null
  }

  const dominant = score.dominantSources.join(" and ")
  const summary = `${score.noiseBand} location with noise score ${score.noiseScore}/100. Dominant contributors: ${dominant}.`

  return {
    testPointId: score.testPointId,
    summary,
    why: `Official DEFRA baselines and nearby OSM features indicate ${dominant} as the main exposure drivers for this coordinate.`,
    whenItMatters:
      score.timeProfile.night > score.timeProfile.day
        ? "Night-time risk is higher than daytime; evenings and late visits are most revealing."
        : "Daytime transport exposure dominates; rush-hour visits are most revealing.",
    confidenceExplanation: `Confidence is ${score.confidenceBand.toLowerCase()} (${score.confidenceScore}/100) because floor=${input.floor ?? 0}, facing=${input.facing ?? "unknown"}, and source coverage vary.`,
    recommendedChecks: score.recommendedChecks,
    sourceCitations: [
      "DEFRA strategic noise mapping (Round 4)",
      "OpenStreetMap Overpass local context",
      "DfT road traffic count points",
      "planning.data.gov.uk / London Planning Datahub",
    ],
  }
}
