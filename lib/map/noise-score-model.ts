import type { DefraMapKind } from "@/lib/map/defra-layers";

export type NoiseScoreKind = "road" | "rail" | "airport" | "nightlife";

export type NoiseScoreByKind = Record<NoiseScoreKind, number>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Lp exponent for loudness combine — one loud source keeps its score; co-present sources add a bonus. */
export const LOUDNESS_EXPONENT = 4;

type ScoreCurveConfig = {
  scoreFloor: number;
  scoreBase: number;
  scoreCurve: number;
};

export const NOISE_SCORE_CONFIG: Record<
  Exclude<NoiseScoreKind, "nightlife">,
  ScoreCurveConfig
> = {
  road: { scoreFloor: 0, scoreBase: 0, scoreCurve: 1 },
  rail: { scoreFloor: 0.16, scoreBase: 4, scoreCurve: 0.75 },
  airport: { scoreFloor: 0.1, scoreBase: 4, scoreCurve: 1.7 },
};

/**
 * Aircraft contours are sparse but extreme — boost raster intensity for the
 * audio preview path only (not used in score presence after sanitization).
 */
export const boostAirportRasterIntensity = (intensity: number) => {
  if (intensity <= 0.04) return 0;
  return clamp(intensity ** 0.68 * 1.22, 0, 1);
};

const normalizeDbToPresence = (
  db: number | null,
  min = 45,
  max = 80
): number => {
  if (db === null) return 0;
  return clamp((db - min) / (max - min), 0, 1);
};

/** dB adapters (server path). */
export const roadDbToPresence = (db: number | null) =>
  normalizeDbToPresence(db, 45, 78);

export const railDbToPresence = (db: number | null) =>
  normalizeDbToPresence(db, 45, 80);

export const airportDbToPresence = (db: number | null) =>
  normalizeDbToPresence(db, 45, 72);

/** Raster adapters (client preview path). */
export const roadRasterToPresence = (intensity: number) =>
  clamp(intensity, 0, 1);

export const railRasterToPresence = (intensity: number) =>
  clamp(intensity, 0, 1);

export const airportRasterToPresence = (intensity: number) =>
  boostAirportRasterIntensity(intensity);

export const rasterToPresence = (intensity: number, kind: DefraMapKind) => {
  if (kind === "airport") return airportRasterToPresence(intensity);
  if (kind === "rail") return railRasterToPresence(intensity);
  return roadRasterToPresence(intensity);
};

export const dbToPresence = (db: number | null, kind: DefraMapKind) => {
  if (kind === "airport") return airportDbToPresence(db);
  if (kind === "rail") return railDbToPresence(db);
  return roadDbToPresence(db);
};

/**
 * Map normalized 0–1 presence to a 0–100 per-source score.
 * Nightlife is supplied directly as a score (not re-curved).
 */
export const presenceToScore = (
  kind: Exclude<NoiseScoreKind, "nightlife">,
  presence: number
): number => {
  const config = NOISE_SCORE_CONFIG[kind];
  if (presence < config.scoreFloor) return 0;

  const normalized = (presence - config.scoreFloor) / (1 - config.scoreFloor);
  return clamp(
    config.scoreBase + normalized ** config.scoreCurve * (100 - config.scoreBase),
    0,
    100
  );
};

export const transportPresenceToScore = (
  kind: DefraMapKind,
  presence: number
) => presenceToScore(kind, presence);

/**
 * Combine per-source scores by loudness (Lp norm). A single loud source is not
 * diluted by absent sources; multiple loud sources add a diminishing bonus.
 */
export const combineLoudness = (
  scoreByKind: NoiseScoreByKind,
  exponent = LOUDNESS_EXPONENT
): number => {
  const scores = Object.values(scoreByKind).map((score) =>
    clamp(score, 0, 100)
  );
  const active = scores.filter((score) => score > 0);
  if (active.length === 0) return 0;

  const sumPowered = active.reduce(
    (total, score) => total + (score / 100) ** exponent,
    0
  );

  return clamp(100 * sumPowered ** (1 / exponent), 0, 100);
};

/** Energy-share weights for contributor breakdown (sums to 1 over active sources). */
export const computeEnergyShares = (
  scoreByKind: NoiseScoreByKind,
  exponent = LOUDNESS_EXPONENT
): Record<NoiseScoreKind, number> => {
  const entries = Object.entries(scoreByKind) as Array<[NoiseScoreKind, number]>;
  const powered = entries.map(([kind, score]) => ({
    kind,
    value: score > 0 ? (clamp(score, 0, 100) / 100) ** exponent : 0,
  }));
  const total = powered.reduce((sum, item) => sum + item.value, 0);

  return entries.reduce(
    (weights, [kind]) => {
      const item = powered.find((entry) => entry.kind === kind);
      weights[kind] =
        total > 0 && item ? item.value / total : 0;
      return weights;
    },
    {} as Record<NoiseScoreKind, number>
  );
};

export const buildContributors = (
  scoreByKind: NoiseScoreByKind,
  exponent = LOUDNESS_EXPONENT
) => {
  const weights = computeEnergyShares(scoreByKind, exponent);

  return (Object.keys(scoreByKind) as NoiseScoreKind[])
    .map((source) => ({
      source,
      weight: weights[source],
      score: Math.round(scoreByKind[source]),
    }))
    .sort((left, right) => right.score - left.score);
};

/** Small additive nudge for nearby future disruption (not part of loudness combine). */
export const planningScoreNudge = (planningScore: number) =>
  clamp(planningScore * 0.06, 0, 6);
