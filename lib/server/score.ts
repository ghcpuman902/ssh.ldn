import {
  getPlanningNoiseRelevance,
  type PlanningNoiseRelevance,
} from "@/lib/map/planning-application-meta"
import {
  buildEvidenceBundle,
  buildEvidenceBundleFromCoordinates,
} from "@/lib/server/bundle"
import {
  computeLocalNoiseSlotScores,
  isLocalNoiseAmenity,
} from "@/lib/map/venue-time"
import {
  DEFAULT_NOISE_TIME_SLOT,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time"
import {
  buildContributors,
  combineLoudness,
  dbToPresence,
  planningScoreNudge,
  presenceToScore,
} from "@/lib/map/noise-score-model"
import {
  buildSlotScoreCells,
  maxScoreForPart,
} from "@/lib/map/noise-slot-profile"
import { parsePlanningDate } from "@/lib/server/planning"
import {
  presentPlanningApplications,
} from "@/lib/server/planning-urls"

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

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
  decisionType: string | null
  applicationTypeFull: string | null
  developmentType: string | null
  description: string | null
}

const PLANNING_NOISE_RELEVANCE_WEIGHT: Record<PlanningNoiseRelevance, number> = {
  low: 0.35,
  medium: 0.7,
  high: 1,
}

const getPlanningActivityWeight = (
  application: PlanningApplicationLike,
  now: number
) => {
  const statusLower = [
    application.status,
    application.decisionType,
  ]
    .map((value) => value?.toLowerCase() ?? "")
    .join(" ")

  if (/refused|rejected|withdrawn|closed|not required|lapsed/.test(statusLower)) {
    return 0.15
  }

  if (
    !application.status ||
    /pending|undecided|submitted|awaiting|progress|received|opinion issued/.test(
      statusLower
    )
  ) {
    return 1
  }

  const decisionTime = parsePlanningDate(application.decisionDate)
  if (decisionTime === null) {
    return 0.85
  }

  const ageYears = (now - decisionTime) / PLANNING_MILLIS_PER_YEAR
  return ageYears <= PLANNING_RECENCY_YEARS ? 0.85 : 0.35
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
    const activityWeight = getPlanningActivityWeight(application, now)
    const relevanceWeight = PLANNING_NOISE_RELEVANCE_WEIGHT[
      getPlanningNoiseRelevance({
        status: application.status,
        decisionType: application.decisionType,
        applicationTypeFull: application.applicationTypeFull,
        developmentType: application.developmentType,
        description: application.description,
      })
    ]

    return total + proximityWeight * activityWeight * relevanceWeight * 35
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
  const localBySlot = computeLocalNoiseSlotScores(
    localNoiseFeatures.map((feature) => ({
      amenity: feature.amenity,
      openingHours: feature.openingHours,
      distanceMeters: feature.distanceMeters,
    }))
  )
  const nightlifeOverall = Math.max(0, ...Object.values(localBySlot))

  const scoreFromDb = (
    kind: "road" | "rail" | "airport",
    db: number | null
  ) => presenceToScore(kind, dbToPresence(db, kind))

  const roadDayScore = scoreFromDb("road", bundle.sources.road.roadLday as number | null)
  const roadEveningScore = scoreFromDb(
    "road",
    bundle.sources.road.roadEvening as number | null
  )
  const roadNightScore = scoreFromDb(
    "road",
    bundle.sources.road.roadLnight as number | null
  )
  const railDayScore = scoreFromDb("rail", bundle.sources.rail.railLday as number | null)
  const railEveningScore = scoreFromDb(
    "rail",
    bundle.sources.rail.railEvening as number | null
  )
  const railNightScore = scoreFromDb(
    "rail",
    bundle.sources.rail.railLnight as number | null
  )
  const airportDayScore = scoreFromDb(
    "airport",
    bundle.sources.airport.airportLday as number | null
  )
  const airportEveningScore = scoreFromDb(
    "airport",
    bundle.sources.airport.airportEvening as number | null
  )
  const airportNightScore = scoreFromDb(
    "airport",
    bundle.sources.airport.airportLnight as number | null
  )

  const timeProfile = buildSlotScoreCells({
    transportByPart: {
      day: {
        road: roadDayScore,
        rail: railDayScore,
        airport: airportDayScore,
      },
      evening: {
        road: roadEveningScore,
        rail: railEveningScore || railDayScore,
        airport: airportEveningScore || airportDayScore,
      },
      night: {
        road: roadNightScore,
        rail: railNightScore,
        airport: airportNightScore,
      },
    },
    localBySlot,
  })

  const roadScore = presenceToScore("road", dbToPresence(road, "road"))
  const railScore = presenceToScore("rail", dbToPresence(rail, "rail"))
  const airportScore = presenceToScore("airport", dbToPresence(airport, "airport"))
  const trafficScore = bundle.sources.dft.aadfTotal
    ? Math.min(100, bundle.sources.dft.aadfTotal / 500)
    : 0
  const planningApplications = bundle.sources.planning.applications
  const planningScore = computePlanningScore(planningApplications)
  const floorAdj = clamp(1 - Math.max(floor - 1, 0) * 0.03, 0.7, 1)

  const scoreByKind = {
    road: roadScore,
    rail: railScore,
    airport: airportScore,
    nightlife: nightlifeOverall,
  }

  const acousticScore = combineLoudness(scoreByKind)
  const noiseScore = Math.round(
    clamp(
      (acousticScore + planningScoreNudge(planningScore)) * floorAdj,
      0,
      100
    )
  )
  const confidenceScore = Math.round(
    clamp(
      55 +
        (road !== null ? 10 : 0) +
        (rail !== null ? 10 : 0) +
        (airport !== null && airport >= 45 ? 10 : 0) +
        (trafficScore > 0 ? 5 : 0) +
        (floor > 0 ? 10 : 0) +
        (facing !== "unknown" ? 5 : 0) +
        (localNoiseFeatures.length > 0 ? 5 : 0) +
        (planningApplications.length > 0 ? 5 : 0),
      0,
      100
    )
  )

  const contributors = [
    ...buildContributors(scoreByKind),
    { source: "planning", weight: 0, score: Math.round(planningScore) },
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
    timeProfile,
    dominantSources: contributors.slice(0, 2).map((item) => item.source),
    evidenceRows: bundle.sources.osm.features.slice(0, 8),
    planningApplications: presentPlanningApplications(planningApplications),
    caveats: bundle.warnings,
    recommendedChecks: [
      "Visit at the loudest time in the profile if nearby venues, hospitals, or rail metrics are elevated.",
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
      maxScoreForPart(score.timeProfile, "night") >
      maxScoreForPart(score.timeProfile, "day")
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
