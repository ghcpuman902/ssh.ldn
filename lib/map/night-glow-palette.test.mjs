import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { DEFRA_NIGHT_GLOW } from "./night-glow-palette.ts"

// DEFRA Round 4 colours, quietest first (lib/map/defra-raster-legend.ts).
const DAY = [
  [255, 255, 255], [160, 186, 191], [184, 214, 209], [206, 228, 204], [226, 242, 191], [243, 198, 131],
  [232, 126, 77], [205, 70, 62], [161, 26, 77], [117, 8, 92], [67, 10, 74],
]
const derived = JSON.parse(readFileSync(new URL("../../scripts/noise-bake/palette_derived.json", import.meta.url), "utf8"))
// Basemap grounds: lib/map/basemap-style.ts night background, and the light map's land.
const NIGHT_BG = [10, 12, 17]
const DAY_BG = [242, 240, 235]
// Road layer: DEFRA alpha 179 x default opacity 0.62 by day; night x1.35 (capped 0.95), glow alpha absolute.
const DAY_ALPHA = (179 / 255) * 0.62
const NIGHT_OPACITY = Math.min(0.62 * 1.35, 0.95)

const over = (c, a, bg) => c.map((v, i) => v * a + bg[i] * (1 - a))
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test("night glow: one entry per DEFRA colour, all visible", () => {
  assert.equal(DEFRA_NIGHT_GLOW.length, DAY.length)
  for (const [, , , a] of DEFRA_NIGHT_GLOW) assert.ok(a > 0 && a <= 1)
})

test("night glow: equal dB is at least as visible at night as by day", () => {
  // Same colour index = same 5 dB step in DEFRA's day and night ramps.
  for (let i = 0; i < DAY.length; i++) {
    const day = contrast(over(DAY[i], DAY_ALPHA, DAY_BG), DAY_BG)
    const g = DEFRA_NIGHT_GLOW[i]
    const night = contrast(over(g.slice(0, 3), g[3] * NIGHT_OPACITY, NIGHT_BG), NIGHT_BG)
    assert.ok(night >= day, `index ${i}: night contrast ${night.toFixed(2)} < day ${day.toFixed(2)}`)
  }
})

test("night glow: louder is brighter, and no two bands tie", () => {
  const shown = DEFRA_NIGHT_GLOW.map((g) => over(g.slice(0, 3), g[3] * NIGHT_OPACITY, NIGHT_BG))
  for (let i = 1; i < shown.length; i++) assert.ok(lum(shown[i]) > lum(shown[i - 1]), `index ${i} not brighter`)
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const d = Math.hypot(...shown[i].map((v, k) => v - shown[j][k]))
      assert.ok(d >= 15, `indices ${i} and ${j} are only ${d.toFixed(1)} apart`)
    }
  }
})

test("night glow: road_Lnight and road_Lday colours map to the same 5 dB step", () => {
  // Lnight band k is 30+5k dB and DEFRA colour k; Lday band k is 35+5k dB and colour k+1.
  const idx = (rgb) => DAY.findIndex((c) => c.every((v, i) => v === rgb[i]))
  for (const [band, { rgba }] of Object.entries(derived.road_Lnight)) if (+band > 0) assert.equal(idx(rgba), +band)
  for (const [band, { rgba }] of Object.entries(derived.road_Lday)) if (+band > 0) assert.equal(idx(rgba), +band + 1)
})
