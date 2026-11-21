/**
 * Night glow per DEFRA colour index, [r, g, b, alpha 0-1]. Index = DEFRA
 * Round 4 colour = 5 dB step (30, 35, ... 80+ dB): DEFRA's day and night ramps
 * share a colour per step, so equal dB gets equal glow. Alpha is absolute (the
 * source tile's own alpha is ignored at night; see night-glow-tiles.ts).
 * Every entry is distinct, and each is at least as visible on the night
 * basemap as the same dB is on the day map, and brighter the louder it is
 * (night-glow-palette.test.mjs).
 *
 * Self-contained (no imports) so node --test can load it.
 */
export const DEFRA_NIGHT_GLOW: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [150, 156, 170, 0.12], // below DEFRA's threshold: the grey wash
  [84, 96, 150, 0.36], // 35 dB: slate
  [50, 160, 140, 0.32], // 40: teal
  [150, 124, 58, 0.4], // 45: dim amber
  [196, 132, 50, 0.48], // 50: amber
  [232, 132, 44, 0.62], // 55: orange
  [250, 110, 50, 0.8], // 60: red-orange
  [255, 84, 84, 0.9], // 65: hot red
  [255, 112, 170, 0.93], // 70: magenta
  [255, 172, 218, 0.95], // 75: pale pink
  [255, 236, 246, 0.97], // 80+: white-hot
]
