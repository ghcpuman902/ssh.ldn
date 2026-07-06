import type { DefraMapKind } from "@/lib/map/defra-layers";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Below this raster intensity, aircraft noise is treated as outside contours. */
export const AIRPORT_CONTOUR_THRESHOLD = 0.12;

/** Inside this intensity, aircraft begins to dominate the blended score. */
export const AIRPORT_DOMINANCE_THRESHOLD = 0.32;

/**
 * Aircraft contours are sparse but extreme — the same DEFRA colour band should
 * read louder than road/rail because exposure is intermittent yet high impact.
 */
export const boostAirportRasterIntensity = (intensity: number) => {
  if (intensity <= 0.04) return 0;
  return clamp(intensity ** 0.68 * 1.22, 0, 1);
};

export const transportIntensityToScore = (
  intensity: number,
  kind: DefraMapKind
) => {
  if (kind !== "airport") {
    return clamp(intensity, 0, 1) * 100;
  }

  const boosted = boostAirportRasterIntensity(intensity);
  if (boosted < 0.08) return 0;

  const normalized = (boosted - 0.08) / 0.92;
  return clamp(6 + normalized ** 0.48 * 94, 0, 100);
};

export const airportZoneStrength = (rawIntensity: number) =>
  clamp(
    (rawIntensity - AIRPORT_CONTOUR_THRESHOLD) /
      (1 - AIRPORT_CONTOUR_THRESHOLD),
    0,
    1
  );

const BASE_BLEND_WEIGHTS = {
  road: 0.36,
  rail: 0.26,
  airport: 0.06,
  nightlife: 0.32,
} as const;

export type TransportBlendWeights = Record<keyof typeof BASE_BLEND_WEIGHTS, number>;

/** Airport weight rises sharply once a contour is sampled; others scale down. */
export const computeTransportBlendWeights = (
  airportRawIntensity: number
): TransportBlendWeights => {
  const zoneStrength = airportZoneStrength(airportRawIntensity);
  const airportWeight = clamp(
    BASE_BLEND_WEIGHTS.airport + zoneStrength ** 0.6 * 0.62,
    BASE_BLEND_WEIGHTS.airport,
    0.68
  );
  const scale = (1 - airportWeight) / (1 - BASE_BLEND_WEIGHTS.airport);

  return {
    road: BASE_BLEND_WEIGHTS.road * scale,
    rail: BASE_BLEND_WEIGHTS.rail * scale,
    airport: airportWeight,
    nightlife: BASE_BLEND_WEIGHTS.nightlife * scale,
  };
};

/**
 * Blend transport + local scores. Aircraft inside a contour can dominate even
 * when road/rail are moderate nearby.
 */
export const blendTransportNoiseScore = ({
  roadScore,
  railScore,
  airportScore,
  localScore,
  airportRawIntensity,
}: {
  roadScore: number;
  railScore: number;
  airportScore: number;
  localScore: number;
  airportRawIntensity: number;
}) => {
  const weights = computeTransportBlendWeights(airportRawIntensity);
  const weightedBase =
    weights.road * roadScore +
    weights.rail * railScore +
    weights.airport * airportScore +
    weights.nightlife * localScore;

  const dominance = clamp(airportZoneStrength(airportRawIntensity) ** 0.72, 0, 1);
  if (dominance <= 0) {
    return clamp(weightedBase, 0, 100);
  }

  return clamp(
    weightedBase * (1 - dominance * 0.42) + airportScore * dominance * 0.88,
    0,
    100
  );
};

export const buildTransportContributors = ({
  roadScore,
  railScore,
  airportScore,
  localScore,
  airportRawIntensity,
}: {
  roadScore: number;
  railScore: number;
  airportScore: number;
  localScore: number;
  airportRawIntensity: number;
}) => {
  const weights = computeTransportBlendWeights(airportRawIntensity);

  return [
    { source: "road", weight: weights.road, score: Math.round(roadScore) },
    { source: "rail", weight: weights.rail, score: Math.round(railScore) },
    {
      source: "airport",
      weight: weights.airport,
      score: Math.round(airportScore),
    },
    {
      source: "nightlife",
      weight: weights.nightlife,
      score: Math.round(localScore),
    },
  ].sort((left, right) => right.score - left.score);
};
