import assert from "node:assert/strict"
import { test } from "node:test"

import {
  COARSE_MIN_LEVEL,
  createIdlePrefetcher,
  planPrefetch,
  prefetchBudget,
} from "./noise-prefetch.ts"
import { gridChunkUrl } from "./noise-grid-gl-math.ts"

// Same geometry as the published grid index; every chunk present except a few airport ones.
const LEVELS = {
  0: { cols: 24, rows: 20 },
  1: { cols: 12, rows: 10 },
  2: { cols: 6, rows: 5 },
  3: { cols: 3, rows: 3 },
  4: { cols: 2, rows: 2 },
  5: { cols: 1, rows: 1 },
}
const LAYERS = ["road", "rail", "airport"].flatMap((k) => ["Lden", "Lday", "Leve", "Lnight"].map((p) => `${k}_${p}`))
const index = {
  originE: 502005,
  originN: 203005,
  cellMeters: 10,
  chunkCells: 256,
  levels: LEVELS,
  layers: Object.fromEntries(
    LAYERS.map((layer) => [
      layer,
      Object.fromEntries(
        Object.entries(LEVELS).map(([k, L]) => [
          k,
          Array.from({ length: L.cols * L.rows }, (_, i) => i).filter((i) => !layer.startsWith("airport") || k !== "0" || i % 3 === 0),
        ])
      ),
    ])
  ),
}

const base = "https://blob.test/noise/h"
// Charing Cross, in level-0 cells
const CENTRE = { col: 2804, row: 2258 }
const plan = (budget, centre = CENTRE, extra = {}) =>
  planPrefetch({
    urlFor: (layer, level, id, cols) => gridChunkUrl(base, layer, level, id, cols),
    index,
    centre,
    budget,
    ...extra,
  })
const levelOf = (url) => Number(url.split("/").slice(-2)[0])

test("budget: Save-Data and 2G get nothing, Safari (no connection API) gets a 5 km ring, fast links 20 km", () => {
  assert.equal(prefetchBudget({ saveData: true }).allowed, false)
  assert.equal(prefetchBudget({ effectiveType: "2g" }).allowed, false)
  assert.deepEqual(prefetchBudget(undefined), { allowed: true, ringsKm: [5] })
  assert.deepEqual(prefetchBudget({ effectiveType: "4g" }).ringsKm, [5, 10, 20])
  assert.deepEqual(plan({ allowed: false, ringsKm: [] }), [])
})

test("plan: coarse levels (all 12 layers, coarsest first) come before any 10 m chunk, and rings grow outward", () => {
  const urls = plan(prefetchBudget({ effectiveType: "4g" }))
  const levels = urls.map(levelOf)
  const firstFine = levels.indexOf(0)
  assert.ok(firstFine > 0)
  assert.ok(levels.slice(0, firstFine).every((l) => l >= COARSE_MIN_LEVEL))
  assert.ok(levels.slice(0, firstFine).every((l, i, a) => i === 0 || a[i - 1] >= l), "coarsest first")
  assert.ok(levels.slice(firstFine).every((l) => l === 0))
  assert.ok(!levels.includes(1))
  assert.equal(new Set(urls).size, urls.length)
  for (const layer of LAYERS) assert.ok(urls.some((u) => u.includes(`/grid/${layer}/5/0_0.gz`)), layer)
  assert.ok(urls.every((u) => u.startsWith(`${base}/grid/`) && u.endsWith(".gz")))
})

test("plan: only chunks that have a file", () => {
  const urls = plan({ allowed: true, ringsKm: [20] }).filter((u) => levelOf(u) === 0 && u.includes("/airport_"))
  for (const u of urls) {
    const [x, y] = u.split("/").pop().replace(".gz", "").split("_").map(Number)
    assert.equal((y * 24 + x) % 3, 0, u)
  }
})

test("plan: 10 m order starts at the user's current view, not a fixed centre", () => {
  const near = (centre) => plan({ allowed: true, ringsKm: [5] }, centre).filter((u) => levelOf(u) === 0)[0]
  assert.match(near(CENTRE), /\/0\/10_8\.gz$/)
  assert.notEqual(near(CENTRE), near({ col: 5000, row: 1000 }))
})

test("plan: a 20 km budget fetches many more 10 m chunks than 5 km", () => {
  const n5 = plan({ allowed: true, ringsKm: [5] }).filter((u) => levelOf(u) === 0).length
  const n20 = plan({ allowed: true, ringsKm: [5, 10, 20] }).filter((u) => levelOf(u) === 0).length
  assert.ok(n5 > 0 && n20 > n5 * 4)
})

test("plan: skips URLs the view already loaded", () => {
  const all = plan({ allowed: true, ringsKm: [5] })
  const skip = new Set(all.slice(0, 10))
  assert.equal(plan({ allowed: true, ringsKm: [5] }, undefined, { skip }).length, all.length - 10)
})

const deferred = () => {
  const queue = []
  return { schedule: (task) => queue.push(task), run: () => queue.splice(0).forEach((t) => t()), queue }
}

test("prefetcher: nothing is fetched before start, at most 2 at a time, low priority", async () => {
  const calls = []
  const pending = []
  const d = deferred()
  const p = createIdlePrefetcher({
    schedule: d.schedule,
    fetchImpl: (url, init) => {
      calls.push({ url, priority: init.priority })
      return new Promise((resolve) => pending.push(() => resolve({ arrayBuffer: async () => new ArrayBuffer(1) })))
    },
  })
  d.run()
  assert.equal(calls.length, 0)
  p.start(["a", "b", "c", "d"])
  d.run()
  assert.equal(calls.length, 2)
  assert.equal(p.inFlight, 2)
  assert.ok(calls.every((c) => c.priority === "low"))
  pending.shift()()
  await new Promise((r) => setTimeout(r, 0))
  d.run()
  assert.equal(calls.length, 3)
})

test("prefetcher: abort (a pan) empties the queue and aborts in-flight requests at once", async () => {
  const signals = []
  const d = deferred()
  const p = createIdlePrefetcher({
    schedule: d.schedule,
    fetchImpl: (url, init) => {
      signals.push(init.signal)
      return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))
    },
  })
  p.start(["a", "b", "c", "d", "e"])
  d.run()
  assert.equal(signals.length, 2)
  p.abort()
  assert.equal(p.pending, 0)
  assert.ok(signals.every((s) => s.aborted))
  await new Promise((r) => setTimeout(r, 0))
  d.run()
  assert.equal(signals.length, 2, "no new request after abort")
  assert.equal(p.inFlight, 0)
})
