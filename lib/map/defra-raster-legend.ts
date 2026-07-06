import type { DefraMapKind } from "@/lib/map/defra-layers";

const DEFRA_RASTER_BANDS = [
  { rgb: [0, 176, 80], intensity: 0.2 },
  { rgb: [146, 208, 80], intensity: 0.35 },
  { rgb: [255, 255, 0], intensity: 0.5 },
  { rgb: [255, 192, 0], intensity: 0.65 },
  { rgb: [255, 0, 0], intensity: 0.82 },
  { rgb: [112, 48, 160], intensity: 1 },
] as const;

/** Ignore faint or mostly transparent pixels that are not visible on the map. */
const DEFRA_MIN_COVERAGE_ALPHA = 88;

/** Reject pixels whose colour is too far from any DEFRA noise band. */
const DEFRA_MAX_BAND_COLOR_DISTANCE_SQ = 14_000;

/** Lowest contour band needs stronger opacity to avoid basemap bleed false positives. */
const DEFRA_MIN_ALPHA_FOR_QUIET_BAND = 176;

/** DEFRA bands are vivid; desaturated pixels are basemap bleed, not noise coverage. */
const DEFRA_MIN_COLOR_SATURATION_SPREAD = 36;

const colorDistanceSq = (
  [redA, greenA, blueA]: readonly [number, number, number],
  [redB, greenB, blueB]: readonly [number, number, number]
) =>
  (redA - redB) ** 2 + (greenA - greenB) ** 2 + (blueA - blueB) ** 2;

const nearestDefraBand = (color: readonly [number, number, number]) =>
  DEFRA_RASTER_BANDS.reduce((best, band) =>
    colorDistanceSq(color, band.rgb) < colorDistanceSq(color, best.rgb)
      ? band
      : best
  );

/** Convert DEFRA categorical raster colors into a relative 0-1 loudness. */
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

  const saturationSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (saturationSpread < DEFRA_MIN_COLOR_SATURATION_SPREAD) return 0;

  const color = [red, green, blue] as const;
  const nearest = nearestDefraBand(color);
  const distanceSq = colorDistanceSq(color, nearest.rgb);

  if (distanceSq > DEFRA_MAX_BAND_COLOR_DISTANCE_SQ) return 0;
  if (
    nearest.intensity <= DEFRA_RASTER_BANDS[0].intensity &&
    alpha < DEFRA_MIN_ALPHA_FOR_QUIET_BAND
  ) {
    return 0;
  }

  return nearest.intensity * (alpha / 255);
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
