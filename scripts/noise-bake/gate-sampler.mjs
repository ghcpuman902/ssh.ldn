// Gate (day 2 step 3): the tile sampler's band equals the point API's band.
// Usage: node scripts/noise-bake/gate-sampler.mjs <tiles-merc dir> <points archive dir> [zoom=13]
// Uses the real lngLatToTilePixel and the real palette matcher from lib/map,
// reads the baked WebP tiles with sharp, and the archive with the real loader.
import { createRequire } from "node:module"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { createNoiseGrid, createNoiseGridReader, wgs84ToBng } from "../../lib/server/noise-grid.ts"
import { lngLatToTilePixel } from "../../lib/map/web-mercator.ts"
import { DEFRA_ROUND4_PALETTE, nearestDefraRound4Band } from "../../lib/map/defra-raster-legend.ts"

const require = createRequire(import.meta.url)
const pnpmDir = path.resolve("node_modules/.pnpm")
const sharpDir = readdirSync(pnpmDir).find((d) => d.startsWith("sharp@"))
const sharp = require(path.join(pnpmDir, sharpDir, "node_modules/sharp"))

const [tilesDir, archiveDir, zoomArg] = process.argv.slice(2)
const z = Number(zoomArg ?? 13)
const grid = createNoiseGrid(createNoiseGridReader(archiveDir))
const palette = JSON.parse(readFileSync(path.resolve("scripts/noise-bake/palette_derived.json"), "utf8"))
const fixture = JSON.parse(readFileSync(path.resolve("lib/server/__fixtures__/noise-grid-gate.json"), "utf8"))

// Invert wgs84ToBng by Newton steps (the repo has only the forward transform).
const bngToWgs84 = (e, n) => {
  let lat = 51.5, lng = -0.1
  for (let i = 0; i < 8; i++) {
    const c = wgs84ToBng(lat, lng)
    const dl = wgs84ToBng(lat + 1e-5, lng), dg = wgs84ToBng(lat, lng + 1e-5)
    const a = (dl.easting - c.easting) / 1e-5, b = (dg.easting - c.easting) / 1e-5
    const cc = (dl.northing - c.northing) / 1e-5, d = (dg.northing - c.northing) / 1e-5
    const de = e - c.easting, dn = n - c.northing, det = a * d - b * cc
    lat += (d * de - b * dn) / det
    lng += (-cc * de + a * dn) / det
  }
  return { lat, lng }
}
// palette index (DEFRA_ROUND4_PALETTE) -> band for one layer, from the DEFRA-derived mapping
const paletteIndexToBand = (layer) => {
  const out = new Map()
  for (const [band, v] of Object.entries(palette[layer])) {
    const i = DEFRA_ROUND4_PALETTE.findIndex((c) => c[0] === v.rgba[0] && c[1] === v.rgba[1] && c[2] === v.rgba[2])
    if (Number(band) > 0) out.set(i, Number(band))
  }
  return out
}
const tileCache = new Map()
const readTile = async (layer, x, y) => {
  const key = `${layer}/${z}/${x}/${y}`
  if (!tileCache.has(key)) {
    const file = path.join(tilesDir, layer, String(z), String(x), `${y}.webp`)
    tileCache.set(key, sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }))
  }
  return tileCache.get(key)
}

const picks = fixture.points.filter((_, i) => i % 2 === 0).slice(0, 20)
const periods = ["Lden", "Lnight"]
const rows = []
for (const p of picks) {
  const { lat, lng } = bngToWgs84(p.easting, p.northing)
  const api = await grid.lookupBng(...Object.values(wgs84ToBng(lat, lng)).slice(0, 2))
  for (const source of ["road", "rail", "airport"]) for (const period of periods) {
    const layer = `${source}_${period}`
    const tile = lngLatToTilePixel({ longitude: lng, latitude: lat, z, tileSize: 256 })
    const { data } = await readTile(layer, tile.x, tile.y)
    const i = (tile.pixelY * 256 + tile.pixelX) * 4
    const alpha = data[i + 3]
    const idx = alpha < 88 ? -1 : nearestDefraRound4Band(data[i], data[i + 1], data[i + 2])
    const samplerBand = idx < 0 ? 0 : paletteIndexToBand(layer).get(idx) ?? -99
    const apiBand = api[source]?.[period]?.band ?? 0
    // A z13 pixel is 11.9 m and shows the cell under its centre, so near a band
    // edge it may show a neighbouring 10 m cell. Record whether the sampler's
    // band is one of the API's bands within one cell of the point.
    const { easting, northing } = wgs84ToBng(lat, lng)
    const around = new Set()
    for (const dE of [-10, 0, 10]) for (const dN of [-10, 0, 10]) {
      const r = await grid.lookupBng(easting + dE, northing + dN)
      around.add(r[source]?.[period]?.band ?? 0)
    }
    rows.push({ layer, lat: +lat.toFixed(6), lng: +lng.toFixed(6), samplerBand, apiBand, ok: samplerBand === apiBand, withinOneCell: around.has(samplerBand) })
  }
}
const bad = rows.filter((r) => !r.ok)
console.log(JSON.stringify({ zoom: z, points: picks.length, comparisons: rows.length, mismatches: bad.length, mismatchesNotWithinOneCell: bad.filter((r) => !r.withinOneCell).length, offByMoreThanOneBand: bad.filter((r) => Math.abs(r.samplerBand - r.apiBand) > 1).length, nonzeroBandComparisons: rows.filter((r) => r.apiBand > 0).length }))
for (const r of bad) console.log("MISMATCH", JSON.stringify(r))
process.exit(bad.some((r) => !r.withinOneCell) ? 1 : 0)
