import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { test } from "node:test"

import { createNoiseCellReader, wgs84ToBng } from "./noise-cell-reader.ts"
import {
  MESH_ZOOM_LEVEL0,
  bngToLngLat,
  buildMesh,
  cellBoxFor,
  cellLookup,
  chunksForCellBox,
  gridChunkUrl,
  gridLevelFor,
  gridMercatorBox,
  interpolateMesh,
  lngLatToMercator,
  mercatorToLngLat,
  meshCell,
  meshCorner,
  meshRangeFor,
  meshZoomForLevel,
  pixelMetersAt,
  translateMat4,
} from "./noise-grid-gl-math.ts"

// Deterministic PRNG so the gates are repeatable.
const prng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const GRID = {
  originE: 502005,
  originN: 203005,
  cellMeters: 10,
  chunkCells: 256,
  gridCols: 6000,
  gridRows: 5000,
  levels: {
    0: { cellMeters: 10, cols: 24, rows: 20, levelCols: 6000, levelRows: 5000 },
    1: { cellMeters: 20, cols: 12, rows: 10, levelCols: 3000, levelRows: 2500 },
    2: { cellMeters: 40, cols: 6, rows: 5, levelCols: 1500, levelRows: 1250 },
    3: { cellMeters: 80, cols: 3, rows: 3, levelCols: 750, levelRows: 625 },
    4: { cellMeters: 160, cols: 2, rows: 2, levelCols: 375, levelRows: 313 },
    5: { cellMeters: 320, cols: 1, rows: 1, levelCols: 188, levelRows: 157 },
  },
}

const cornerCache = (meshZoom) => {
  const cache = new Map()
  return (i, j) => {
    const key = `${i},${j}`
    let c = cache.get(key)
    if (!c) cache.set(key, (c = meshCorner(i, j, meshZoom, GRID, wgs84ToBng)))
    return c
  }
}

const exactCell = (lat, lng) => {
  const { easting, northing } = wgs84ToBng(lat, lng)
  return { col: (easting - GRID.originE) / 10, row: (GRID.originN - northing) / 10 }
}

test("wgs84ToBng matches pyproj (EPSG:4326 -> 27700) to 1 cm", () => {
  const ref = JSON.parse(readFileSync(path.resolve("_agent/shader/pyproj-ref.json"), "utf8")).slice(0, 10)
  assert.equal(ref.length, 10)
  for (const p of ref) {
    const r = wgs84ToBng(p.lat, p.lng)
    assert.ok(Math.hypot(r.easting - p.e, r.northing - p.n) < 0.01, `${p.lat},${p.lng}`)
  }
})

test("mercator <-> lng/lat round-trips", () => {
  for (const [lng, lat] of [[-0.1276, 51.5072], [0.3, 51.3], [-0.5, 51.7]]) {
    const m = lngLatToMercator(lng, lat)
    const back = mercatorToLngLat(m.x, m.y)
    assert.ok(Math.abs(back.lng - lng) < 1e-12 && Math.abs(back.lat - lat) < 1e-12)
  }
})

// Test A: the GPU's per-triangle affine Mercator -> BNG against the exact transform.
const SPOTS = {
  "grid NW": { lat: 51.701, lng: -0.537 },
  "grid NE": { lat: 51.69, lng: 0.338 },
  "grid SW": { lat: 51.27, lng: -0.528 },
  "grid SE": { lat: 51.268, lng: 0.33 },
  "centre London": { lat: 51.5072, lng: -0.1276 },
  Heathrow: { lat: 51.47, lng: -0.4543 },
  Thamesmead: { lat: 51.5016, lng: 0.1167 },
}

test("A: mesh interpolation (float32, as on the GPU) vs wgs84ToBng < 0.1 m on tiles z10-z18", () => {
  const rnd = prng(42)
  const corner = cornerCache(MESH_ZOOM_LEVEL0)
  let max = 0
  for (const spot of Object.values(SPOTS)) {
    for (const z of [10, 12, 14, 16, 18]) {
      const n = 2 ** z
      const m = lngLatToMercator(spot.lng, spot.lat)
      const tx = Math.floor(m.x * n)
      const ty = Math.floor(m.y * n)
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]
      for (let k = 0; k < 16; k++) pts.push([rnd(), rnd()])
      for (const [u, v] of pts) {
        const x = (tx + u) / n
        const y = (ty + v) / n
        const { lng, lat } = mercatorToLngLat(x, y)
        const got = interpolateMesh(x, y, MESH_ZOOM_LEVEL0, corner)
        const want = exactCell(lat, lng)
        max = Math.max(max, Math.hypot(got.col - want.col, got.row - want.row) * 10)
      }
    }
  }
  assert.ok(max < 0.1, `max affine error ${max} m`)
})

test("A: measured max error per mesh zoom (the reason for MESH_ZOOM_LEVEL0)", () => {
  const rnd = prng(7)
  const pts = Array.from({ length: 4000 }, () => ({ lat: 51.27 + rnd() * 0.43, lng: -0.53 + rnd() * 0.87 }))
  const errors = {}
  for (const mz of [14, 15, 16, 17]) {
    const corner = cornerCache(mz)
    let max = 0
    for (const p of pts) {
      const m = lngLatToMercator(p.lng, p.lat)
      const got = interpolateMesh(m.x, m.y, mz, corner)
      const want = exactCell(p.lat, p.lng)
      max = Math.max(max, Math.hypot(got.col - want.col, got.row - want.row) * 10)
    }
    errors[mz] = max
  }
  console.log("max affine error (m) by mesh zoom", errors)
  // Measured: z14 11 cm, z15 2.8 cm, z16 7 mm, z17 1.8 mm.
  assert.ok(errors[MESH_ZOOM_LEVEL0] < 0.01)
  assert.ok(errors[14] > errors[16])
})

test("level rule: exact 10 m cells from MapLibre zoom 12 in London, max-band pyramid below", () => {
  const lat = 51.5
  assert.equal(gridLevelFor(pixelMetersAt(12, lat), 5), 0)
  assert.equal(gridLevelFor(pixelMetersAt(18, lat), 5), 0)
  assert.equal(gridLevelFor(pixelMetersAt(11.95, lat), 5), 1)
  assert.equal(gridLevelFor(pixelMetersAt(11, lat), 5), 1)
  assert.equal(gridLevelFor(pixelMetersAt(10, lat), 5), 2)
  assert.equal(gridLevelFor(pixelMetersAt(9, lat), 5), 3)
  assert.equal(gridLevelFor(pixelMetersAt(5, lat), 5), 5)
  // MapLibre zoom 12 = the old 256 px tile z13, 11.9 m per CSS pixel
  assert.ok(Math.abs(pixelMetersAt(12, 51.5) - 11.9) < 0.1)
  assert.equal(meshZoomForLevel(0), MESH_ZOOM_LEVEL0)
})

test("cell lookup mirrors the shader's chunk and texel maths", () => {
  assert.equal(cellLookup(-1, 0, 0, GRID), null)
  assert.equal(cellLookup(6000, 0, 0, GRID), null)
  assert.deepEqual(cellLookup(0, 0, 0, GRID), { chunkX: 0, chunkY: 0, chunkId: 0, texel: 0 })
  assert.deepEqual(cellLookup(257, 513, 0, GRID), { chunkX: 1, chunkY: 2, chunkId: 2 * 24 + 1, texel: 1 * 256 + 1 })
  // level 2: cell (1029, 2050) -> level cell (257, 512) -> chunk (1, 2) of a 6-wide level
  assert.deepEqual(cellLookup(1029, 2050, 2, GRID), { chunkX: 1, chunkY: 2, chunkId: 13, texel: 0 * 256 + 1 })
})

test("view chunks: nearest first, 1-chunk margin, clipped to the level", () => {
  const box = { minCol: 2600, minRow: 2600, maxCol: 2700, maxRow: 2700 }
  const ids = chunksForCellBox(box, 0, GRID, 1)
  assert.equal(ids[0], 10 * 24 + 10)
  assert.equal(ids.length, 9)
  assert.equal(chunksForCellBox({ minCol: 0, minRow: 0, maxCol: 10, maxRow: 10 }, 0, GRID, 1).length, 4)
  assert.equal(chunksForCellBox(box, 5, GRID, 1).length, 1)
  const c = cellBoxFor([{ lng: -0.1276, lat: 51.5072 }], GRID, wgs84ToBng)
  // Charing Cross is about E 530047, N 180422
  assert.ok(c.minCol > 2780 && c.minCol < 2830 && c.minRow > 2230 && c.minRow < 2280, JSON.stringify(c))
  assert.equal(gridChunkUrl("https://b/noise/h", "road_Lden", 0, 2 * 24 + 1, 24), "https://b/noise/h/grid/road_Lden/0/1_2.gz")
})

test("mesh buffers: per-square integer base, float32 locals within a few dozen cells, 2 triangles each", () => {
  const box = gridMercatorBox(GRID, wgs84ToBng)
  const c = lngLatToMercator(-0.1276, 51.5072)
  const d = 0.0001
  const range = meshRangeFor({ x0: c.x - d, y0: c.y - d, x1: c.x + d, y1: c.y + d }, box, 16)
  const mesh = buildMesh(range, cornerCache(16), c)
  assert.equal(mesh.quads, (range.i1 - range.i0) * (range.j1 - range.j0))
  assert.equal(mesh.indices.length, mesh.quads * 6)
  for (let k = 0; k < mesh.local.length; k++) assert.ok(mesh.local[k] >= 0 && mesh.local[k] < 64)
  for (let q = 0; q < mesh.quads; q++) {
    for (let v = 1; v < 4; v++) {
      assert.equal(mesh.base[(q * 4 + v) * 2], mesh.base[q * 8])
      assert.equal(mesh.base[(q * 4 + v) * 2 + 1], mesh.base[q * 8 + 1])
    }
  }
  assert.equal(meshRangeFor({ x0: 0, y0: 0, x1: 0.1, y1: 0.1 }, box, 16), null)
  // matrix * translate in float64
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  assert.deepEqual(Array.from(translateMat4(I, 2, 3)).slice(12), [2, 3, 0, 1])
})

// Test B: the fragment maths on the CPU against the points archive reader.
const local = path.resolve("_agent/shader/noise-local")
const haveLocal = existsSync(path.join(local, "grid/index.json")) && existsSync(path.join(local, "points/index.bin"))

const localFetch = (dir) => {
  const files = new Map()
  return async (url, init) => {
    const p = path.join(dir, String(url).split("/").pop())
    if (!files.has(p)) files.set(p, readFileSync(p))
    const file = files.get(p)
    const range = init?.headers?.Range
    if (!range) return new Response(file, { status: 200 })
    const [, s, e] = /bytes=(\d+)-(\d+)/.exec(range)
    return new Response(file.subarray(Number(s), Number(e) + 1), { status: 206 })
  }
}

test("B: shader maths on the local level-0 grid == points archive band, 2,000 random central points", { skip: !haveLocal }, async () => {
  const index = JSON.parse(readFileSync(path.join(local, "grid/index.json"), "utf8"))
  const reader = createNoiseCellReader("https://cdn.example/points", localFetch(path.join(local, "points")))
  const corner = cornerCache(MESH_ZOOM_LEVEL0)
  const chunks = new Map()
  const chunk = (layer, id) => {
    const key = `${layer}/${id}`
    if (!chunks.has(key)) {
      const present = index.layers[layer]["0"].includes(id)
      const rel = gridChunkUrl("", layer, 0, id, index.levels["0"].cols)
      chunks.set(key, present ? gunzipSync(readFileSync(path.join(local, rel))) : null)
    }
    return chunks.get(key)
  }
  const rnd = prng(2026)
  const layers = ["road_Lden", "rail_Lnight", "airport_Lden"]
  let same = 0
  let total = 0
  let nonZero = 0
  for (let n = 0; n < 2000; n++) {
    // Central 10 km: E 525000-535000, N 175000-185000; avoid exact cell centres.
    let e = 525000 + rnd() * 10000
    let nn = 175000 + rnd() * 10000
    if (Math.abs(((e - 502005) % 10) - 5) < 1e-6) e += 0.37
    if (Math.abs(((203005 - nn) % 10) - 5) < 1e-6) nn += 0.37
    // BNG -> WGS84; the GPU path starts from that lat/lng's Mercator position,
    // the archive reader from the lat/lng itself.
    const { lng, lat } = bngToLngLat(e, nn, wgs84ToBng)
    const m = lngLatToMercator(lng, lat)
    const cell = meshCell(interpolateMesh(m.x, m.y, MESH_ZOOM_LEVEL0, corner))
    const look = cellLookup(cell.col, cell.row, 0, index)
    assert.ok(look)
    for (const layer of layers) {
      const data = chunk(layer, look.chunkId)
      const gl = data ? data[look.texel] : 0
      const api = (await reader.bandAt(lat, lng, layer)) ?? 0
      if (gl === api) same++
      if (api) nonZero++
      total++
    }
  }
  assert.equal(total, 6000)
  assert.ok(nonZero > 1000, `only ${nonZero} non-zero bands sampled`)
  assert.equal(same, total, `${total - same} of ${total} differ`)
})
