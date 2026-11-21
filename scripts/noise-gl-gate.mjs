#!/usr/bin/env node
// GPU gate for the WebGL noise layer (lib/map/noise-grid-gl-layer.ts).
//
// Usage:
//   node scripts/noise-gl-gate.mjs <gate page URL> <point API origin> [n=200] [cdp=http://127.0.0.1:9333]
// e.g.
//   node scripts/noise-gl-gate.mjs \
//     "http://localhost:3999/dev/noise-gl-gate?z=16&lat=51.5072&lng=-0.1276&layer=road_Lden&base=http://localhost:3077" \
//     http://localhost:3999 200
//
// Needs a running Chrome with remote debugging (the shared agent Chrome on
// 9333: `agent-chrome start`), the dev server, and the point API. It opens
// the page in a new tab over the DevTools protocol, waits for
// window.__noiseGate.ready, then:
//
// 1. Picks N random CSS pixel positions (seeded, repeatable) at least 2 px from
//    the canvas edge whose 3 x 3 neighbourhood is one flat colour, so the
//    pixel is not on a 1-px band boundary (a pixel centre within a fraction of
//    a pixel of a cell edge is not a fair test of which cell it shows).
// 2. Reads that device pixel's RGBA (gl.readPixels on the preserved drawing
//    buffer) and the lng/lat of its centre (map.unproject).
// 3. Asks /api/noise/point (POST, 50 points a call) for the band of the 10 m
//    cell under each lng/lat.
// 4. Expected colour = the page's palette entry for that band (straight
//    alpha, `info().palette`, the same palette_derived.json colours the map
//    uses), composited over the page's opaque clear colour exactly as the
//    shader + MapLibre blend do it (premultiplied, gl.ONE /
//    gl.ONE_MINUS_SRC_ALPHA), with a = alpha / 255 * opacity:
//      expected_c = round(c * a + clear_c * (1 - a))   for c in r, g, b
//    A pixel passes when every channel is within 2 of expected (8-bit
//    rounding of the palette texture and the blend). Band 0 with an alpha-0
//    palette entry (airport) expects the clear colour.
// 5. Prints pass/fail counts and the first failures; exit code 1 unless 100%.
//
// Flags (after the positional args):
//   --perturb=shift   negative control: query the point API 1 cell (10 m) east and 10 m north of each pixel
//   --perturb=rotate  negative control: rotate each sample point 1.5 degrees about the view centre
//                     Both must FAIL clearly; they prove the gate can see a 1-cell or 1.5-degree misalignment.
//   --subpixel        sample a random point inside each pixel (not its centre) and keep edge pixels too.
//                     A mismatch is "sub-pixel" when the pixel still equals the band at its own centre: a
//                     pixel can show one cell only, so a point in the same pixel but the next cell differs.
//   --snap            with --subpixel: apply the UI tap snap (lib/map/noise-tap-snap.ts). Where a CSS pixel is
//                     >= SNAP_MIN_PIXEL_METERS (5 m, MapLibre z <= ~13.3) the reading is the cell under the
//                     device pixel's centre, so readout == drawn band must be 100% with no sub-pixel cases.
//
// Local-sources layers (local_<slot>, roadlocal_<slot>; lib/map/noise-tiles.ts) have no point API values:
// for them step 3 reads the value with the app's own grid reader (createNoiseGridReader, the readout's
// code path) in the page. The shader and the reader share only the chunk bytes, so this still proves the
// drawn cell is the cell under the point; scripts/noise-bake (box verify_local.py) checks the values.

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"))
const [pageUrl, apiOrigin, nArg = "200", cdp = "http://127.0.0.1:9333"] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const PERTURB = flags.find((f) => f.startsWith("--perturb="))?.split("=")[1] ?? null
const SUBPIXEL = flags.includes("--subpixel")
const SNAP = flags.includes("--snap")
const SNAP_MIN_PIXEL_METERS = 5 // mirror of lib/map/noise-grid-gl-math.ts
if (!pageUrl || !apiOrigin) {
  console.error("usage: node scripts/noise-gl-gate.mjs <gate page URL> <point API origin> [n] [cdp]")
  process.exit(2)
}
const N = Number(nArg)
const TOLERANCE = 2

let seed = 20261120
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// --- minimal DevTools protocol client --------------------------------------
const target = await (await fetch(`${cdp}/json/new?${encodeURI("about:blank")}`, { method: "PUT" })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})
let nextId = 1
const waiting = new Map()
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id)
    waiting.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    waiting.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}

const closeTab = async () => {
  ws.close()
  await fetch(`${cdp}/json/close/${target.id}`).catch(() => undefined)
}

try {
  await send("Page.enable")
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await send("Page.navigate", { url: pageUrl })
  // Wait for the page script to define the gate, then for every chunk in view.
  const started = Date.now()
  while (!(await evaluate("Boolean(window.__noiseGate)"))) {
    if (Date.now() - started > 60_000) throw new Error("window.__noiseGate never appeared")
    await new Promise((r) => setTimeout(r, 250))
  }
  await evaluate("window.__noiseGate.ready")
  const info = await evaluate("window.__noiseGate.info()")
  console.log(`layer ${info.layer} zoom ${info.zoom} level ${info.level} ${info.width}x${info.height} opacity ${info.opacity}`)
  if (info.level !== 0) {
    // Below MapLibre zoom 12 the map shows the max-band pyramid on purpose, not the cell under the pixel.
    throw new Error(`level ${info.level}: use ?z=12 or more, where the layer draws the exact 10 m cells`)
  }

  // 1-2: candidate pixels away from band boundaries
  const samples = []
  let tries = 0
  while (samples.length < N && tries < N * 50) {
    tries++
    const x = 2 + Math.floor(rnd() * (info.width - 4))
    const y = 2 + Math.floor(rnd() * (info.height - 4))
    const block = await evaluate(`(() => {
      const g = window.__noiseGate, out = []
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(g.samplePixel(${x} + dx, ${y} + dy))
      return out
    })()`)
    const centre = block[4]
    const flat = block.every((s) => s.rgba.every((v, i) => v === centre.rgba[i]))
    if (SUBPIXEL) {
      // Linear map of the pixel from its neighbours' centres; offset in [-0.5, 0.5) on each axis.
      const u = rnd() - 0.5, v = rnd() - 0.5, right = block[5], down = block[7]
      samples.push({ x, y, ...centre, centreLat: centre.lat, centreLng: centre.lng,
        lat: centre.lat + u * (right.lat - centre.lat) + v * (down.lat - centre.lat),
        lng: centre.lng + u * (right.lng - centre.lng) + v * (down.lng - centre.lng), edge: !flat })
    } else if (flat) samples.push({ x, y, ...centre })
  }
  if (samples.length < N) console.warn(`only ${samples.length} flat pixels found in ${tries} tries`)

  // Negative controls move the queried point, not the pixel.
  if (PERTURB) {
    const view = await evaluate("window.__noiseGate.samplePixel(" + Math.floor(info.width / 2) + "," + Math.floor(info.height / 2) + ")")
    const mLat = 111320, mLng = 111320 * Math.cos((view.lat * Math.PI) / 180), th = (1.5 * Math.PI) / 180
    for (const s of samples) {
      if (PERTURB === "shift") { s.lat += 10 / mLat; s.lng += 10 / mLng }
      else if (PERTURB === "rotate") {
        const dx = (s.lng - view.lng) * mLng, dy = (s.lat - view.lat) * mLat
        s.lng = view.lng + (dx * Math.cos(th) - dy * Math.sin(th)) / mLng
        s.lat = view.lat + (dx * Math.sin(th) + dy * Math.cos(th)) / mLat
      } else throw new Error("unknown --perturb " + PERTURB)
    }
  }

  // 3: bands from the point API (or, for local-sources layers, the app's grid reader)
  const [source, period] = info.layer.split("_")
  const queries = SUBPIXEL
    ? samples.flatMap((s) => [{ s, key: "band", lat: s.lat, lng: s.lng }, { s, key: "centreBand", lat: s.centreLat, lng: s.centreLng }])
    : samples.map((s) => ({ s, key: "band", lat: s.lat, lng: s.lng }))
  const GRID_READER = /^(local|roadlocal)_/.test(info.layer)
  if (GRID_READER) {
    const values = await evaluate(`Promise.all(${JSON.stringify(queries.map((q) => [q.lat, q.lng]))}.map(([a, b]) => window.__noiseGate.readValue(a, b)))`)
    queries.forEach((q, k) => {
      if (q.key === "band") q.s.inCoverage = values[k] !== null
      q.s[q.key] = values[k] ?? 0
    })
    console.log("reader: app grid reader (createNoiseGridReader)")
  }
  for (let i = 0; i < (GRID_READER ? 0 : queries.length); i += 50) {
    const batch = queries.slice(i, i + 50)
    const res = await fetch(`${apiOrigin.replace(/\/+$/, "")}/api/noise/point`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: batch.map((s) => ({ lat: s.lat, lng: s.lng })) }),
    })
    if (!res.ok) throw new Error(`point API ${res.status}`)
    const body = await res.json()
    body.results.forEach((r, k) => {
      const q = batch[k]
      if (q.key === "band") q.s.inCoverage = r.inCoverage
      q.s[q.key] = r[source]?.[period]?.band ?? 0
    })
    if (i + 50 < queries.length) await new Promise((r) => setTimeout(r, 1100)) // stay under 60 a minute
  }

  // 4: compare
  const expectedFor = (band) => {
    const [r, g, b, a8] = info.palette[band] ?? [0, 0, 0, 0]
    const a = (a8 / 255) * info.opacity
    return [r, g, b].map((c, i) => Math.round(c * a + info.clearRgb[i] * (1 - a)))
  }
  const matches = (band, rgba) => expectedFor(band).every((v, i) => Math.abs(v - rgba[i]) <= TOLERANCE)
  const pixelMeters = (78271.516964 * Math.cos((samples[0]?.lat ?? 51.5) * Math.PI / 180)) / 2 ** info.zoom
  const snapping = SNAP && pixelMeters >= SNAP_MIN_PIXEL_METERS
  if (SNAP) console.log(`snap ${snapping ? "ON" : "off"} (CSS pixel ${pixelMeters.toFixed(2)} m)`)
  if (snapping) for (const s of samples) s.band = s.centreBand
  let pass = 0, subpixel = 0, edges = 0
  const failures = []
  for (const s of samples) {
    const expected = s.inCoverage ? expectedFor(s.band) : [...info.clearRgb]
    const ok = expected.every((v, i) => Math.abs(v - s.rgba[i]) <= TOLERANCE)
    if (s.edge) edges++
    if (ok) pass++
    else if (SUBPIXEL && matches(s.centreBand, s.rgba)) subpixel++
    else failures.push({ x: s.x, y: s.y, lat: s.lat, lng: s.lng, band: s.band, expected, got: s.rgba.slice(0, 3) })
  }
  const mode = PERTURB ? `NEGATIVE CONTROL ${PERTURB}: ` : SUBPIXEL ? (snapping ? "SUBPIXEL+SNAP: " : "SUBPIXEL: ") : ""
  const pct = ((100 * pass) / samples.length).toFixed(1)
  console.log(`${mode}${pass}/${samples.length} pixels match the ${GRID_READER ? "grid reader value" : "point API band"} (${pct}%)` +
    (SUBPIXEL ? `; ${subpixel} sub-pixel cell-edge cases; ${failures.length} unexplained; ${edges} samples on band edges` : ""))
  for (const f of failures.slice(0, PERTURB ? 3 : 20)) console.log("FAIL", JSON.stringify(f))
  await closeTab()
  const clean = snapping ? pass === samples.length : SUBPIXEL ? failures.length === 0 : pass === samples.length
  process.exit(samples.length > 0 && clean ? 0 : 1)
} catch (error) {
  console.error(error)
  await closeTab()
  process.exit(1)
}
