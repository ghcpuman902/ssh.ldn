import type { DefraMapKind } from "@/lib/map/defra-layers";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Below this raster intensity, aircraft noise is treated as outside contours. */
export const AIRPORT_CONTOUR_THRESHOLD = 0.12;

/**
 * Aircraft contours are sparse but extreme — the same DEFRA colour band should
 * read louder than road/rail because exposure is intermittent yet high impact.
 */
export const boostAirportRasterIntensity = (intensity: number) => {
  if (intensity <= 0.04) return 0;
  return clamp(intensity ** 0.68 * 1.22, 0, 1);
};

/**
 * Convex map from a normalized 0–1 aircraft "presence" to a 0–100 score. Shared
 * by the raster (client preview) and dB (server) paths so both agree on shape.
 */
const presenceToAirportScore = (presence: number) => {
  if (presence < 0.08) return 0;
  const normalized = (presence - 0.08) / 0.92;
  return clamp(6 + normalized ** 0.48 * 94, 0, 100);
};

/**
 * RASTER path (client preview): DEFRA tile colour intensity → 0–100.
 * Road/rail are continuous so they stay linear; aircraft gets the convex curve.
 */
export const transportIntensityToScore = (
  intensity: number,
  kind: DefraMapKind
) => {
  if (kind !== "airport") {
    return clamp(intensity, 0, 1) * 100;
  }

  return presenceToAirportScore(boostAirportRasterIntensity(intensity));
};

/**
 * dB path (server): DEFRA airport Lden in decibels → 0–100. Uses the real
 * published contour range rather than reinterpreting a raster-tuned curve.
 */
export const airportDbToScore = (db: number | null) => {
  if (db === null) return 0;
  const presence = clamp((db - 45) / (72 - 45), 0, 1);
  return presenceToAirportScore(presence);
};

/** Raster colour intensity → 0–1 zone strength (dominance driver). */
export const airportZoneStrengthFromRaster = (rasterIntensity: number) =>
  clamp(
    (rasterIntensity - AIRPORT_CONTOUR_THRESHOLD) /
      (1 - AIRPORT_CONTOUR_THRESHOLD),
    0,
    1
  );

/** Airport Lden dB → 0–1 zone strength. DEFRA airport contours run ~51–69 dB. */
export const airportZoneStrengthFromDb = (db: number | null) => {
  if (db === null) return 0;
  return clamp((db - 51) / (69 - 51), 0, 1);
};

const BASE_BLEND_WEIGHTS = {
  road: 0.36,
  rail: 0.26,
  airport: 0.06,
  nightlife: 0.32,
} as const;

export type TransportBlendWeights = Record<keyof typeof BASE_BLEND_WEIGHTS, number>;

/**
 * Airport weight rises sharply with zone strength; the others scale down.
 * `airportZoneStrength` is a unitless 0–1 value the caller derives in its own
 * units (raster intensity or dB) so this stays scale-agnostic.
 */
export const computeTransportBlendWeights = (
  airportZoneStrength: number
): TransportBlendWeights => {
  const zoneStrength = clamp(airportZoneStrength, 0, 1);
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
  airportZoneStrength,
}: {
  roadScore: number;
  railScore: number;
  airportScore: number;
  localScore: number;
  airportZoneStrength: number;
}) => {
  const weights = computeTransportBlendWeights(airportZoneStrength);
  const weightedBase =
    weights.road * roadScore +
    weights.rail * railScore +
    weights.airport * airportScore +
    weights.nightlife * localScore;

  const dominance = clamp(clamp(airportZoneStrength, 0, 1) ** 0.72, 0, 1);
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
  airportZoneStrength,
}: {
  roadScore: number;
  railScore: number;
  airportScore: number;
  localScore: number;
  airportZoneStrength: number;
}) => {
  const weights = computeTransportBlendWeights(airportZoneStrength);

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
