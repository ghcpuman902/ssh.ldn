import type { DefraMapKind } from "@/lib/map/defra-layers";

/**
 * The colours the Round 4 WMS styles actually paint (road, rail and airport,
 * day and night), quietest first. It is a diverging ramp: white and cool
 * greens for quiet, then tan → orange → red → purple for loud. The order comes
 * from which bands touch in real tiles.
 */
export const DEFRA_ROUND4_PALETTE = [
  [255, 255, 255],
  [160, 186, 191],
  [184, 214, 209],
  [206, 228, 204],
  [226, 242, 191],
  [243, 198, 131],
  [232, 126, 77],
  [205, 70, 62],
  [161, 26, 77],
  [117, 8, 92],
  [67, 10, 74],
] as const;

/**
 * Relative 0–1 loudness per palette band, rising at every step. White is the
 * lowest painted class (below the quietest mapped level), so it counts as
 * quiet: 0. The quiet bands get small values that the per-source silence
 * floors below can still drop; from tan (the warm side of the ramp) up it
 * roughly follows the server's dB presence curve.
 */
export const DEFRA_ROUND4_INTENSITY = [
  0, 0.05, 0.1, 0.16, 0.24, 0.36, 0.5, 0.64, 0.78, 0.9, 1,
] as const;

/** Ignore faint or mostly transparent pixels that are not visible on the map. */
const DEFRA_MIN_COVERAGE_ALPHA = 88;

/**
 * Tiles are flat palette colours, so anything further away is not a band.
 * Leaves room for the rounding a canvas adds when it unpremultiplies alpha.
 */
const DEFRA_MAX_BAND_COLOR_DISTANCE_SQ = 2_500;

/** Index into DEFRA_ROUND4_PALETTE of the nearest band, or -1 if none is close. */
export const nearestDefraRound4Band = (
  red: number,
  green: number,
  blue: number
) => {
  let best = -1;
  let bestDistance = DEFRA_MAX_BAND_COLOR_DISTANCE_SQ;
  DEFRA_ROUND4_PALETTE.forEach(([bandRed, bandGreen, bandBlue], index) => {
    const distance =
      (red - bandRed) ** 2 + (green - bandGreen) ** 2 + (blue - bandBlue) ** 2;
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
};

/**
 * Convert a DEFRA Round 4 tile pixel into a relative 0–1 loudness. Alpha only
 * gates coverage: each WMS style paints at one flat alpha (road and rail 179,
 * airport 128), which says nothing about loudness.
 */
export const defraRasterPixelToIntensity = ({
  red,
  green,
  blue,
  alpha,
}: {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}) => {
  if (alpha < DEFRA_MIN_COVERAGE_ALPHA) return 0;

  const band = nearestDefraRound4Band(red, green, blue);
  return band < 0 ? 0 : DEFRA_ROUND4_INTENSITY[band];
};

/** Drop sub-threshold transport intensity so silent areas stay silent in audio/UI. */
export const TRANSPORT_INTENSITY_SILENCE_FLOOR: Record<DefraMapKind, number> = {
  road: 0.1,
  rail: 0.16,
  airport: 0.08,
};

export const sanitizeTransportRasterIntensity = (
  intensity: number,
  kind: DefraMapKind
) =>
  intensity < TRANSPORT_INTENSITY_SILENCE_FLOOR[kind] ? 0 : intensity;
