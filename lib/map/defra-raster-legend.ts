const DEFRA_RASTER_BANDS = [
  { rgb: [0, 176, 80], intensity: 0.2 },
  { rgb: [146, 208, 80], intensity: 0.35 },
  { rgb: [255, 255, 0], intensity: 0.5 },
  { rgb: [255, 192, 0], intensity: 0.65 },
  { rgb: [255, 0, 0], intensity: 0.82 },
  { rgb: [112, 48, 160], intensity: 1 },
] as const

const colorDistance = (
  [redA, greenA, blueA]: readonly [number, number, number],
  [redB, greenB, blueB]: readonly [number, number, number]
) =>
  (redA - redB) ** 2 + (greenA - greenB) ** 2 + (blueA - blueB) ** 2

/** Convert DEFRA categorical raster colors into a relative 0-1 loudness. */
export const defraRasterPixelToIntensity = ({
  red,
  green,
  blue,
  alpha,
}: {
  red: number
  green: number
  blue: number
  alpha: number
}) => {
  if (alpha < 24) return 0

  const color = [red, green, blue] as const
  const nearest = DEFRA_RASTER_BANDS.reduce((best, band) =>
    colorDistance(color, band.rgb) < colorDistance(color, best.rgb) ? band : best
  )

  return nearest.intensity * (alpha / 255)
}
