// Day 2 step 7 (offline part): 20 real venues, the old sampler input (DEFRA's own z12 PNG, as the live proxy served it)
// versus the new one (baked z13 WebP), through the real legend and silence floors, plus the point API's dB.
// Usage: node scripts/noise-bake/compare-venues.mjs <tiles-merc dir> <points archive dir>
import { createRequire } from "node:module"
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createNoiseGrid, createNoiseGridReader } from "../../lib/server/noise-grid.ts"
import { lngLatToTilePixel } from "../../lib/map/web-mercator.ts"
import { defraRasterPixelToIntensity } from "../../lib/map/defra-raster-legend.ts"

const require = createRequire(import.meta.url)
const pd = path.resolve("node_modules/.pnpm")
const sharp = require(path.join(pd, readdirSync(pd).find((d) => d.startsWith("sharp@")), "node_modules/sharp"))
const [tilesDir, archiveDir] = process.argv.slice(2)
const grid = createNoiseGrid(createNoiseGridReader(archiveDir))
const FLOOR = { road: 0.1, rail: 0.16, airport: 0.08 }
const SUFFIX = { day: "Lday", night: "Lnight" }

const dir = path.resolve("data/osm-static/nightlife")
const venues = []
for (const f of readdirSync(dir)) {
  const j = JSON.parse(readFileSync(path.join(dir, f), "utf8"))
  for (const ft of j.features ?? []) {
    const [lng, lat] = ft.geometry.coordinates
    if (lat > 51.44 && lat < 51.58 && lng > -0.26 && lng < 0.06 && ft.properties.name) venues.push({ name: ft.properties.name, amenity: ft.properties.amenity, lat, lng })
  }
}
venues.sort((a, b) => (a.name + a.lat).localeCompare(b.name + b.lat))
const picks = Array.from({ length: 20 }, (_, i) => venues[Math.floor((i + 0.5) * venues.length / 20)])

const cache = new Map()
const px = async (file, tile) => {
  if (!existsSync(file)) return null
  if (!cache.has(file)) cache.set(file, sharp(file).ensureAlpha().raw().toBuffer())
  const data = await cache.get(file)
  const i = (tile.pixelY * 256 + tile.pixelX) * 4
  return { red: data[i], green: data[i + 1], blue: data[i + 2], alpha: data[i + 3] }
}
const level = (p, kind) => {
  if (!p) return null
  const v = defraRasterPixelToIntensity(p)
  return v < FLOOR[kind] ? 0 : v
}
const rows = []
for (const v of picks) {
  const res = await grid.lookup(v.lat, v.lng)
  const row = { venue: v.name, amenity: v.amenity, lat: +v.lat.toFixed(5), lng: +v.lng.toFixed(5) }
  for (const period of ["day", "night"]) for (const kind of ["road", "rail", "airport"]) {
    const t12 = lngLatToTilePixel({ longitude: v.lng, latitude: v.lat, z: 12, tileSize: 256 })
    const t13 = lngLatToTilePixel({ longitude: v.lng, latitude: v.lat, z: 13, tileSize: 256 })
    const old = level(await px(path.resolve("data/noise/tiles", kind, period, "12", String(t12.x), `${t12.y}.png`), t12), kind)
    const next = level(await px(path.join(tilesDir, `${kind}_${SUFFIX[period]}`, "13", String(t13.x), `${t13.y}.webp`), t13), kind)
    row[`${kind}_${period}`] = { old, new: next, db: res[kind]?.[SUFFIX[period]]?.db ?? null }
  }
  rows.push(row)
}
const cells = rows.flatMap((r) => Object.entries(r).filter(([k]) => /_(day|night)$/.test(k)).map(([, c]) => c)).filter((c) => c.old !== null)
const same = cells.filter((c) => c.old === c.new).length
const diff1 = cells.filter((c) => c.old !== c.new && Math.abs(c.old - c.new) <= 0.15).length
console.log(JSON.stringify({ venues: rows.length, comparisons: cells.length, identicalIntensity: same, withinOneBandStep: diff1, larger: cells.length - same - diff1 }))
for (const r of rows) {
  console.log(r.venue.padEnd(28).slice(0, 28), ["road", "rail", "airport"].map((k) => `${k[0]}:${["day", "night"].map((p) => { const c = r[`${k}_${p}`]; return `${c.old ?? "-"}>${c.new ?? "-"}` }).join("/")}`).join("  "))
}
writeFileSync("_agent/day2/evidence/step7-venues-old-vs-new.json", JSON.stringify(rows, null, 1))
