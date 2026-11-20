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

const [pageUrl, apiOrigin, nArg = "200", cdp = "http://127.0.0.1:9333"] = process.argv.slice(2)
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
    if (flat) samples.push({ x, y, ...centre })
  }
  if (samples.length < N) console.warn(`only ${samples.length} flat pixels found in ${tries} tries`)

  // 3: bands from the point API
  const [source, period] = info.layer.split("_")
  for (let i = 0; i < samples.length; i += 50) {
    const batch = samples.slice(i, i + 50)
    const res = await fetch(`${apiOrigin.replace(/\/+$/, "")}/api/noise/point`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: batch.map((s) => ({ lat: s.lat, lng: s.lng })) }),
    })
    if (!res.ok) throw new Error(`point API ${res.status}`)
    const body = await res.json()
    body.results.forEach((r, k) => {
      batch[k].inCoverage = r.inCoverage
      batch[k].band = r[source]?.[period]?.band ?? 0
    })
    if (i + 50 < samples.length) await new Promise((r) => setTimeout(r, 1100)) // stay under 60 a minute
  }

  // 4: compare
  const expectedFor = (band) => {
    const [r, g, b, a8] = info.palette[band] ?? [0, 0, 0, 0]
    const a = (a8 / 255) * info.opacity
    return [r, g, b].map((c, i) => Math.round(c * a + info.clearRgb[i] * (1 - a)))
  }
  let pass = 0
  const failures = []
  for (const s of samples) {
    const expected = s.inCoverage ? expectedFor(s.band) : [...info.clearRgb]
    const ok = expected.every((v, i) => Math.abs(v - s.rgba[i]) <= TOLERANCE)
    if (ok) pass++
    else failures.push({ x: s.x, y: s.y, lat: s.lat, lng: s.lng, band: s.band, expected, got: s.rgba.slice(0, 3) })
  }
  console.log(`${pass}/${samples.length} pixels match the point API band`)
  for (const f of failures.slice(0, 20)) console.log("FAIL", JSON.stringify(f))
  await closeTab()
  process.exit(samples.length > 0 && pass === samples.length ? 0 : 1)
} catch (error) {
  console.error(error)
  await closeTab()
  process.exit(1)
}
