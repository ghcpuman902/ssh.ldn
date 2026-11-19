import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BAKED_TILE_BOUNDS,
  BAKED_TILE_MAX_ZOOM,
  BAKED_TILE_MIN_ZOOM,
  bakedLayerName,
  bakedTileTemplate,
  bakedTileUrl,
} from "./noise-tiles.ts"

test("period maps to the baked layer name used by the bake (Lden/Lday/Leve/Lnight)", () => {
  assert.equal(bakedLayerName("road", "all"), "road_Lden")
  assert.equal(bakedLayerName("road", "day"), "road_Lday")
  assert.equal(bakedLayerName("rail", "evening"), "rail_Leve")
  assert.equal(bakedLayerName("airport", "night"), "airport_Lnight")
})

test("tile URLs live under the content-hashed base and keep MapLibre's template", () => {
  const base = "https://x.public.blob.vercel-storage.com/noise/abc123"
  assert.equal(
    bakedTileTemplate(base, "road", "night"),
    `${base}/tiles/road_Lnight/{z}/{x}/{y}.webp`
  )
  assert.equal(
    bakedTileUrl(base, "rail", "day", 13, 4090, 2720),
    `${base}/tiles/rail_Lday/13/4090/2720.webp`
  )
})

test("baked zoom range and bounds match the bake (z8-13, London grid)", () => {
  assert.equal(BAKED_TILE_MIN_ZOOM, 8)
  assert.equal(BAKED_TILE_MAX_ZOOM, 13)
  const [w, s, e, n] = BAKED_TILE_BOUNDS
  assert.ok(w < -0.5 && e > 0.3 && s < 51.3 && n > 51.7)
})
