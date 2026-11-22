import assert from "node:assert/strict"
import { gzipSync } from "node:zlib"
import { test } from "node:test"

import { createNoiseGridReader, wgs84ToBng } from "./noise-cell-reader.ts"
import {
  energySumDb,
  localLayerName,
  roadBandOf,
  roadLayerForSlot,
  roadLocalLayerName,
} from "./noise-tiles.ts"

test("local layer names and the road layer each slot adds to", () => {
  assert.equal(localLayerName("weekend-night"), "local_weekend-night")
  assert.equal(roadLocalLayerName("weekday-day"), "roadlocal_weekday-day")
  assert.equal(roadLayerForSlot("weekday-night"), "road_Lnight")
  assert.equal(roadLayerForSlot("weekend-day"), "road_Lday")
})

test("roadBandOf: DEFRA road bands, the rule bake_local.py uses", () => {
  // Day: band 1 = 40-45 dB ... band 9 = 80+; night: band 1 = 35-40 ... band 10 = 80+.
  assert.equal(roadBandOf(39.5, false), 0)
  assert.equal(roadBandOf(40, false), 1)
  assert.equal(roadBandOf(44.99, false), 1)
  assert.equal(roadBandOf(57.5, false), 4)
  assert.equal(roadBandOf(95, false), 9)
  assert.equal(roadBandOf(34.5, true), 0)
  assert.equal(roadBandOf(35, true), 1)
  assert.equal(roadBandOf(57.5, true), 5)
  assert.equal(roadBandOf(90, true), 10)
})

test("energySumDb adds levels as energy", () => {
  assert.equal(energySumDb(null, 0), null)
  assert.equal(energySumDb(60, null), 60)
  assert.ok(Math.abs(energySumDb(60, 60) - 63.0103) < 1e-3)
  assert.ok(Math.abs(energySumDb(60, 50) - 60.4139) < 1e-3)
})

test("createNoiseGridReader reads the level-0 cell under a point from the drawn chunks", async () => {
  const lat = 51.5185, lng = -0.059
  const { easting, northing } = wgs84ToBng(lat, lng)
  const E0 = 502005, N0 = 203005
  const col = Math.floor((easting - E0) / 10), row = Math.floor((N0 - northing) / 10)
  const cx = Math.floor(col / 256), cy = Math.floor(row / 256)
  const chunk = new Uint8Array(256 * 256)
  chunk[(row % 256) * 256 + (col % 256)] = 117 // 58.5 dB
  chunk[(row % 256) * 256 + ((col + 1) % 256)] = 3
  const index = {
    originE: E0, originN: N0, cellMeters: 10, chunkCells: 256, gridCols: 6000, gridRows: 5000,
    levels: { 0: { cols: 24 } },
    layers: { "local_weekday-night": { 0: [cy * 24 + cx] }, "roadlocal_weekday-night": { 0: [] } },
  }
  const fetched = []
  const fetchImpl = async (url) => {
    fetched.push(url)
    if (url.endsWith("/index.json")) return new Response(JSON.stringify(index))
    return new Response(gzipSync(chunk))
  }
  const r = createNoiseGridReader("https://blob.example/noise/abc/grid", fetchImpl)
  assert.equal(await r.valueAt(lat, lng, "local_weekday-night"), 117)
  // An absent chunk is empty without a fetch; an unknown layer is null.
  assert.equal(await r.valueAt(lat, lng, "roadlocal_weekday-night"), 0)
  assert.equal(await r.valueAt(lat, lng, "nope"), null)
  assert.ok(fetched.includes(`https://blob.example/noise/abc/grid/local_weekday-night/0/${cx}_${cy}.gz`))
  assert.equal(fetched.filter((u) => u.endsWith(".gz")).length, 1)
  // Outside the grid.
  assert.equal(await r.valueAt(52.5, -1.5, "local_weekday-night"), null)
})
