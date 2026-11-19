// Gate (day 2 step 3): baked tiles look like DEFRA's own styled tiles.
// Usage: node scripts/noise-bake/compare-defra-tiles.mjs <tiles-merc dir> [zoom=13]
// Compares every locally cached DEFRA PNG (data/noise/tiles/<kind>/<period>/<z>) with the baked WebP.
// DEFRA paints below-threshold cells white at alpha 179 and the bake leaves them transparent, so white counts as empty.
import { createRequire } from "node:module"
import { readdirSync, existsSync } from "node:fs"
import path from "node:path"
const require = createRequire(import.meta.url)
const pnpmDir = path.resolve("node_modules/.pnpm")
const sharp = require(path.join(pnpmDir, readdirSync(pnpmDir).find((d) => d.startsWith("sharp@")), "node_modules/sharp"))
const [tilesDir, zArg] = process.argv.slice(2)
const z = Number(zArg ?? 13)
const SUFFIX = { day: "Lday", night: "Lnight", evening: "Leve", all: "Lden" }
const raw = async (f) => (await sharp(f).ensureAlpha().raw().toBuffer())
const out = []
for (const kind of ["road", "rail", "airport"]) for (const period of ["day", "night"]) {
  const dir = path.resolve("data/noise/tiles", kind, period, String(z))
  if (!existsSync(dir)) continue
  let tiles = 0, painted = 0, same = 0, onlyDefra = 0, onlyBaked = 0, differ = 0
  for (const x of readdirSync(dir)) for (const f of readdirSync(path.join(dir, x))) {
    const y = f.replace(".png", "")
    const baked = path.join(tilesDir, `${kind}_${SUFFIX[period]}`, String(z), x, `${y}.webp`)
    if (!existsSync(baked)) continue
    const a = await raw(path.join(dir, x, f)), b = await raw(baked)
    tiles++
    for (let i = 0; i < a.length; i += 4) {
      const defraEmpty = a[i + 3] === 0 || (a[i] === 255 && a[i + 1] === 255 && a[i + 2] === 255)
      const bakedEmpty = b[i + 3] === 0
      if (defraEmpty && bakedEmpty) continue
      painted++
      if (defraEmpty) onlyBaked++
      else if (bakedEmpty) onlyDefra++
      else if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) same++
      else differ++
    }
  }
  out.push({ kind, period, z, tiles, paintedPixels: painted, sameColourPct: +(100 * same / painted).toFixed(1), differentColourPct: +(100 * differ / painted).toFixed(1), onlyDefraPct: +(100 * onlyDefra / painted).toFixed(1), onlyBakedPct: +(100 * onlyBaked / painted).toFixed(1) })
}
for (const r of out) console.log(JSON.stringify(r))
