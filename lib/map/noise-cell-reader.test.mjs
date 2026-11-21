import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { createNoiseCellReader, wgs84ToBng } from "./noise-cell-reader.ts"
import { createNoiseGrid, createNoiseGridReader, wgs84ToBng as serverBng } from "../server/noise-grid.ts"

test("browser BNG transform equals the point API's", () => {
  for (let i = 0; i < 2000; i++) {
    const lat = 51.27 + Math.random() * 0.43
    const lng = -0.53 + Math.random() * 0.87
    const a = wgs84ToBng(lat, lng)
    const b = serverBng(lat, lng)
    assert.ok(Math.abs(a.easting - b.easting) < 1e-6 && Math.abs(a.northing - b.northing) < 1e-6)
  }
})

// A fetch over a local folder that honours Range like Blob does (206).
const files = new Map()
const read = (dir, url) => {
  const p = path.join(dir, String(url).split("/").pop())
  if (!files.has(p)) files.set(p, readFileSync(p))
  return files.get(p)
}
const localFetch = (dir) => async (url, init) => {
  const file = read(dir, url)
  const range = init?.headers?.Range
  if (!range) return new Response(file, { status: 200 })
  const [, s, e] = /bytes=(\d+)-(\d+)/.exec(range)
  return new Response(file.subarray(Number(s), Number(e) + 1), { status: 206 })
}

const archive = path.resolve("_agent/day2/points32")
test("cell reader returns the point API's band at every sampled point", { skip: !existsSync(path.join(archive, "index.bin")) }, async () => {
  const reader = createNoiseCellReader("https://cdn.example/noise/abc/points", localFetch(archive))
  const grid = createNoiseGrid(createNoiseGridReader(archive))
  let compared = 0
  for (let i = 0; i < 1000; i++) {
    const lat = 51.3 + Math.random() * 0.38
    const lng = -0.5 + Math.random() * 0.8
    const api = await grid.lookup(lat, lng)
    for (const source of ["road", "rail", "airport"]) for (const period of ["Lden", "Lnight"]) {
      const band = await reader.bandAt(lat, lng, `${source}_${period}`)
      assert.equal(band ?? 0, api[source]?.[period]?.band ?? 0, `${source}_${period} at ${lat},${lng}`)
      compared++
    }
  }
  assert.equal(compared, 6000)
})

test("cell reader falls back when a server ignores Range", async () => {
  if (!existsSync(path.join(archive, "index.bin"))) return
  const full = async (url) => new Response(read(archive, url), { status: 200 })
  const reader = createNoiseCellReader("https://x/points", full)
  const grid = createNoiseGrid(createNoiseGridReader(archive))
  const api = await grid.lookup(51.5072, -0.1276)
  assert.equal(await reader.bandAt(51.5072, -0.1276, "road_Lden"), api.road.Lden.band)
})

// Day 2 step 3 gate, redone: the 120 comparisons that were 108/120 with z13 tile pixels.
test("gate: 20 fixture points x 6 layers match the point API exactly", { skip: !existsSync(path.join(archive, "index.bin")) }, async () => {
  const fixture = JSON.parse(readFileSync(path.resolve("lib/server/__fixtures__/noise-grid-gate.json"), "utf8"))
  const reader = createNoiseCellReader("https://cdn.example/points", localFetch(archive))
  const grid = createNoiseGrid(createNoiseGridReader(archive))
  let same = 0
  const picks = fixture.points.filter((_, i) => i % 2 === 0).slice(0, 20)
  for (const p of picks) {
    const api = await grid.lookupBng(p.easting, p.northing)
    // the browser starts from lat/lng, so go BNG -> WGS84 by Newton steps on the forward transform
    let lat = 51.5, lng = -0.1
    for (let i = 0; i < 8; i++) {
      const c = wgs84ToBng(lat, lng), dl = wgs84ToBng(lat + 1e-5, lng), dg = wgs84ToBng(lat, lng + 1e-5)
      const a = (dl.easting - c.easting) / 1e-5, b = (dg.easting - c.easting) / 1e-5
      const cc = (dl.northing - c.northing) / 1e-5, d = (dg.northing - c.northing) / 1e-5
      const de = p.easting - c.easting, dn = p.northing - c.northing, det = a * d - b * cc
      lat += (d * de - b * dn) / det
      lng += (-cc * de + a * dn) / det
    }
    for (const source of ["road", "rail", "airport"]) for (const period of ["Lden", "Lnight"]) {
      if (((await reader.bandAt(lat, lng, `${source}_${period}`)) ?? 0) === (api[source]?.[period]?.band ?? 0)) same++
    }
  }
  assert.equal(same, 120)
})

// Public Blob answers CORS preflight (OPTIONS) with 405, so a cross-origin
// fetch must stay "simple": a single `Range: bytes=a-b` is CORS-safelisted;
// any other request header triggers a preflight and the fetch fails
// (checked in Chromium and WebKit from http://localhost:3078, 20 Nov 2026).
test("cell reader sends only a CORS-safelisted Range header (no preflight)", { skip: !existsSync(path.join(archive, "index.bin")) }, async () => {
  const seen = []
  const inner = localFetch(archive)
  const spy = async (url, init) => {
    seen.push(Object.entries(init?.headers ?? {}))
    return inner(url, init)
  }
  const reader = createNoiseCellReader("https://cdn.example/noise/abc/points", spy)
  await reader.bandAt(51.5072, -0.1276, "road_Lden")
  assert.ok(seen.length >= 3)
  for (const headers of seen) {
    for (const [name, value] of headers) {
      assert.equal(name.toLowerCase(), "range")
      assert.match(value, /^bytes=\d+-\d+$/)
    }
  }
})
