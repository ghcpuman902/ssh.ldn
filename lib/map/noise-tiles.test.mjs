import assert from "node:assert/strict"
import { test } from "node:test"

import { NOISE_GRID_BOUNDS, bakedLayerName } from "./noise-tiles.ts"

test("period maps to the baked layer name used by the bake (Lden/Lday/Leve/Lnight)", () => {
  assert.equal(bakedLayerName("road", "all"), "road_Lden")
  assert.equal(bakedLayerName("road", "day"), "road_Lday")
  assert.equal(bakedLayerName("rail", "evening"), "rail_Leve")
  assert.equal(bakedLayerName("airport", "night"), "airport_Lnight")
})

test("grid bounds cover the London grid", () => {
  const [w, s, e, n] = NOISE_GRID_BOUNDS
  assert.ok(w < -0.5 && e > 0.3 && s < 51.3 && n > 51.7)
})
