// Run with: pnpm test (node --test). Node 24 strips the TypeScript types.
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

import {
  createNoiseGrid,
  createNoiseGridReader,
  handleNoisePointRequest,
  MAX_POINTS,
  osgb36ToBng,
  wgs84ToBng,
} from "./noise-grid.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const LAYERS = ["road", "rail", "airport"].flatMap((s) =>
  ["Lden", "Lday", "Leve", "Lnight"].map((p) => `${s}_${p}`)
)

// Tiny synthetic archive: 8 x 8 cells of 10 m, 4-cell chunks (2 x 2 chunks).
// Chunk 0 has data, chunks 1-3 are empty. Airport layers are absent.
const buildArchive = ({ binaryIndex = false } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), "noise-grid-"))
  const C = 4
  const plane = C * C
  const raw = new Uint8Array(LAYERS.length * 2 * plane)
  LAYERS.forEach((name, li) => {
    for (let cell = 0; cell < plane; cell++) {
      raw[li * 2 * plane + cell] = cell === 5 ? 0 : 100 + li * 4 + cell // dB*2
      raw[(li * 2 + 1) * plane + cell] = cell === 5 ? 0 : (li % 9) + 1
    }
  })
  const gz = gzipSync(raw)
  writeFileSync(path.join(dir, "data.bin"), gz)
  const index = {
    format: "ssh-ldn-noise-points",
    version: 1,
    crs: "EPSG:27700",
    originE: 500000,
    originN: 200000,
    cellMeters: 10,
    chunkCells: C,
    cols: 2,
    rows: 2,
    gridCols: 8,
    gridRows: 8,
    layers: LAYERS,
    layersPresent: LAYERS.filter((l) => !l.startsWith("airport")),
    offsets: [0, gz.length, gz.length, gz.length],
    lengths: [gz.length, 0, 0, 0],
    attribution: "test attribution",
  }
  if (binaryIndex) {
    // Version 2: offsets and lengths live in index.bin (uint32 LE pairs).
    const bin = new DataView(new ArrayBuffer(index.offsets.length * 8))
    index.offsets.forEach((offset, i) => {
      bin.setUint32(i * 8, offset, true)
      bin.setUint32(i * 8 + 4, index.lengths[i], true)
    })
    writeFileSync(path.join(dir, "index.bin"), new Uint8Array(bin.buffer))
    delete index.offsets
    delete index.lengths
    index.version = 2
    index.indexBin = "index.bin"
  }
  writeFileSync(path.join(dir, "index.json"), JSON.stringify(index))
  return dir
}

test("OSGB36 -> BNG matches the Ordnance Survey worked example to 1 mm", () => {
  // OS 'A guide to coordinate systems in Great Britain', annex C:
  // 52°39'27.2531"N 1°43'4.5177"E -> E 651409.903, N 313177.270
  const lat = 52 + 39 / 60 + 27.2531 / 3600
  const lng = 1 + 43 / 60 + 4.5177 / 3600
  const { easting, northing } = osgb36ToBng(lat, lng)
  assert.ok(Math.abs(easting - 651409.903) < 0.001, `E ${easting}`)
  assert.ok(Math.abs(northing - 313177.27) < 0.001, `N ${northing}`)
})

test("WGS84 -> BNG within 5 m of PROJ (Helmert) at London points", () => {
  const cases = [
    [51.500729, -0.124625, 530268.08, 179643.9],
    [51.4723, -0.4897, 504994.59, 175896.39],
    [51.4643, -0.1704, 527192.28, 175512.46],
    [51.5256, -0.0875, 532772.47, 182476.3],
  ]
  for (const [lat, lng, e, n] of cases) {
    const r = wgs84ToBng(lat, lng)
    assert.ok(Math.hypot(r.easting - e, r.northing - n) < 5, `${lat},${lng}`)
  }
})

test("loader reads cells, empty chunks, absent layers and out-of-grid points", async () => {
  const grid = createNoiseGrid(createNoiseGridReader(buildArchive()))
  // Cell (row 0, col 1) in chunk 0 -> cell index 1
  const a = await grid.lookupBng(500015, 199995)
  assert.equal(a.inCoverage, true)
  assert.deepEqual(a.road.Lden, { db: (100 + 0 + 1) / 2, band: 1 })
  assert.deepEqual(a.rail.Lnight, { db: (100 + 7 * 4 + 1) / 2, band: 8 })
  assert.equal(a.airport.Lden, null)
  // Cell index 5 is no data
  const b = await grid.lookupBng(500015, 199985)
  assert.deepEqual(b.road.Lday, { db: null, band: 0 })
  // Empty chunk 3 (row 4+, col 4+)
  const c = await grid.lookupBng(500055, 199945)
  assert.deepEqual(c.road.Lden, { db: null, band: 0 })
  // Outside the grid
  const d = await grid.lookupBng(499990, 199995)
  assert.equal(d.inCoverage, false)
  assert.equal(d.road, null)
})

test("loader reads a version 2 archive whose offsets live in index.bin", async () => {
  const grid = createNoiseGrid(
    createNoiseGridReader(buildArchive({ binaryIndex: true }))
  )
  const a = await grid.lookupBng(500015, 199995)
  assert.deepEqual(a.road.Lden, { db: (100 + 0 + 1) / 2, band: 1 })
  const c = await grid.lookupBng(500055, 199945)
  assert.deepEqual(c.road.Lden, { db: null, band: 0 })
})

test("handler: GET single point, GET list, POST, validation", async () => {
  const grid = createNoiseGrid(createNoiseGridReader(buildArchive()))
  const ok = await handleNoisePointRequest(
    new Request("http://x/api/noise/point?lat=51.5&lng=-0.12"),
    grid
  )
  assert.equal(ok.status, 200)
  assert.match(ok.headers.get("cache-control"), /s-maxage/)
  const body = await ok.json()
  assert.equal(body.attribution, "test attribution")
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].inCoverage, false)

  const list = await handleNoisePointRequest(
    new Request("http://x/api/noise/point?points=51.5,-0.12;51.51,-0.13"),
    grid
  )
  assert.equal((await list.json()).results.length, 2)

  const post = await handleNoisePointRequest(
    new Request("http://x/api/noise/point", {
      method: "POST",
      body: JSON.stringify({ points: [{ lat: 51.5, lng: -0.1 }] }),
    }),
    grid
  )
  assert.equal(post.status, 200)
  assert.equal(post.headers.get("cache-control"), "no-store")

  for (const url of [
    "http://x/api/noise/point",
    "http://x/api/noise/point?lat=abc&lng=1",
    "http://x/api/noise/point?lat=95&lng=1",
    "http://x/api/noise/point?points=1,2;foo",
  ]) {
    assert.equal(
      (await handleNoisePointRequest(new Request(url), grid)).status,
      400,
      url
    )
  }
  const tooMany = Array.from({ length: MAX_POINTS + 1 }, () => ({
    lat: 51.5,
    lng: 0,
  }))
  const big = await handleNoisePointRequest(
    new Request("http://x/api/noise/point", {
      method: "POST",
      body: JSON.stringify({ points: tooMany }),
    }),
    grid
  )
  assert.equal(big.status, 400)
})

test("handler returns 503 when the grid is missing", async () => {
  const grid = createNoiseGrid(createNoiseGridReader("/nonexistent/noise-grid"))
  const res = await handleNoisePointRequest(
    new Request("http://x/api/noise/point?lat=51.5&lng=-0.12"),
    grid
  )
  assert.equal(res.status, 503)
})

// Gate: 50 exact DEFRA GetFeatureInfo readings vs the baked London grid.
// Runs only when the baked data is present (it is not committed).
const fixture = path.join(here, "__fixtures__", "noise-grid-gate.json")
const base =
  process.env.NOISE_GRID_BASE ??
  path.join(here, "..", "..", "_agent", "defra-fetch", "baked", "points")
test(
  "gate: baked grid within 0.5 dB of 50 exact DEFRA readings",
  {
    skip:
      !existsSync(path.join(base, "index.json")) && "baked grid not present",
  },
  async () => {
    const { tolerance, points } = JSON.parse(readFileSync(fixture, "utf8"))
    const grid = createNoiseGrid(createNoiseGridReader(base))
    const misses = []
    for (const p of points) {
      const r = await grid.lookupBng(p.easting, p.northing)
      const [source, period] = p.layer.split("_")
      const got = r[source]?.[period]?.db ?? 0
      const err = Math.abs(got - p.exactDb)
      if (err > tolerance) misses.push({ ...p, got, err })
    }
    assert.deepEqual(misses, [])
  }
)
