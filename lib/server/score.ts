import { buildEvidenceBundle, buildEvidenceBundleFromCoordinates } from "@/lib/server/bundle";
import {
  computeNightlifeScore,
  isNightlifeAmenity,
} from "@/lib/map/venue-time";
import {
  DEFAULT_NOISE_TIME_SLOT,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeDb = (value: number | null, min = 45, max = 80) => {
  if (value === null) {
    return 0;
  }
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
};

const bandFromScore = (score: number) => {
  if (score >= 75) {
    return "Transport-dominated";
  }
  if (score >= 55) {
    return "High night risk";
  }
  if (score >= 35) {
    return "Mixed";
  }
  return "Low risk";
};

export type ScoreInput = {
  testPointId?: string;
  lat?: number;
  lng?: number;
  floor?: number;
  facing?: string;
  timeSlot?: NoiseTimeSlot;
};

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
        : null;

  if (!bundle) {
    return null;
  }

  const road = bundle.sources.road.roadLden as number | null;
  const rail = bundle.sources.rail.railLden as number | null;
  const airport = bundle.sources.airport.airportLden as number | null;

  const nightlifeFeatures = bundle.sources.osm.features.filter((feature) =>
    isNightlifeAmenity(feature.amenity)
  );
  const nightlifeScore = computeNightlifeScore(
    nightlifeFeatures.map((feature) => ({
      amenity: feature.amenity,
      openingHours: feature.openingHours,
      distanceMeters: feature.distanceMeters,
    })),
    timeSlot
  );

  const roadScore = normalizeDb(road);
  const railScore = normalizeDb(rail);
  const airportScore = normalizeDb(airport, 40, 65);
  const floorAdj = clamp(1 - Math.max(floor - 1, 0) * 0.03, 0.7, 1);

  const weighted =
    0.35 * roadScore +
    0.25 * railScore +
    0.15 * airportScore +
    0.15 * nightlifeScore +
    0.1 * (bundle.sources.dft.aadfTotal ? Math.min(100, bundle.sources.dft.aadfTotal / 500) : 0);

  const noiseScore = Math.round(clamp(weighted * floorAdj, 0, 100));
  const confidenceScore = Math.round(
    clamp(
      55 +
        (road !== null ? 10 : 0) +
        (rail !== null ? 10 : 0) +
        (floor > 0 ? 10 : 0) +
        (facing !== "unknown" ? 5 : 0) +
        (nightlifeFeatures.length > 0 ? 5 : 0),
      0,
      100
    )
  );

  const contributors = [
    { source: "road", weight: 0.35, score: Math.round(roadScore) },
    { source: "rail", weight: 0.25, score: Math.round(railScore) },
    { source: "airport", weight: 0.15, score: Math.round(airportScore) },
    { source: "nightlife", weight: 0.15, score: Math.round(nightlifeScore) },
    {
      source: "traffic",
      weight: 0.1,
      score: Math.round(
        bundle.sources.dft.aadfTotal
          ? Math.min(100, bundle.sources.dft.aadfTotal / 500)
          : 0
      ),
    },
  ].sort((a, b) => b.score - a.score);

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
      day: Math.round(normalizeDb(bundle.sources.road.roadLday as number | null)),
      evening: Math.round(
        normalizeDb(bundle.sources.road.roadEvening as number | null)
      ),
      night: Math.round(
        Math.max(
          normalizeDb(bundle.sources.road.roadLnight as number | null),
          normalizeDb(bundle.sources.rail.railLnight as number | null),
          nightlifeScore
        )
      ),
    },
    dominantSources: contributors.slice(0, 2).map((item) => item.source),
    evidenceRows: bundle.sources.osm.features.slice(0, 8),
    caveats: bundle.warnings,
    recommendedChecks: [
      "Visit after 22:00 if nightlife or rail night metrics are elevated.",
      "Confirm floor and street-facing orientation before relying on the score.",
    ],
  };
};

export const explainFromScore = async (input: ScoreInput) => {
  const score = await scoreFromBundle(input);
  if (!score) {
    return null;
  }

  const dominant = score.dominantSources.join(" and ");
  const summary = `${score.noiseBand} location with noise score ${score.noiseScore}/100. Dominant contributors: ${dominant}.`;

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
  };
};
