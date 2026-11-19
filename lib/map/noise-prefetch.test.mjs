import assert from "node:assert/strict"
import { test } from "node:test"

import {
  COARSE_ZOOMS,
  createIdlePrefetcher,
  planPrefetch,
  prefetchBudget,
} from "./noise-prefetch.ts"
import {
  BAKED_TILE_BOUNDS,
  BAKED_TILE_MAX_ZOOM,
  bakedTileUrl,
} from "./noise-tiles.ts"

const base = "https://blob.test/noise/h"
const plan = (budget, centre = { lng: -0.1276, lat: 51.5072 }, extra = {}) =>
  planPrefetch({
    urlFor: (k, p, z, x, y) => bakedTileUrl(base, k, p, z, x, y),
    bounds: BAKED_TILE_BOUNDS,
    maxZoom: BAKED_TILE_MAX_ZOOM,
    centre,
    budget,
    ...extra,
  })
const zOf = (url) => Number(url.split("/").slice(-3)[0])

test("budget: Save-Data and 2G get nothing, Safari (no connection API) gets a 5 km ring, fast links 20 km", () => {
  assert.equal(prefetchBudget({ saveData: true }).allowed, false)
  assert.equal(prefetchBudget({ effectiveType: "2g" }).allowed, false)
  assert.deepEqual(prefetchBudget(undefined), { allowed: true, ringsKm: [5] })
  assert.deepEqual(prefetchBudget({ effectiveType: "4g" }).ringsKm, [5, 10, 20])
  assert.deepEqual(plan({ allowed: false, ringsKm: [] }), [])
})

test("plan: coarse zooms (all 12 layers) come before any z13 tile, and rings grow outward", () => {
  const urls = plan(prefetchBudget({ effectiveType: "4g" }))
  const zooms = urls.map(zOf)
  const firstZ13 = zooms.indexOf(13)
  assert.ok(firstZ13 > 0)
  assert.ok(zooms.slice(0, firstZ13).every((z) => COARSE_ZOOMS.includes(z)))
  assert.ok(zooms.slice(firstZ13).every((z) => z === 13))
  // 12 layers per tile position, no duplicates
  assert.equal(new Set(urls).size, urls.length)
  for (const kind of ["road", "rail", "airport"]) {
    for (const layer of ["Lden", "Lday", "Leve", "Lnight"]) {
      assert.ok(urls.some((u) => u.includes(`/${kind}_${layer}/8/`)), `${kind}_${layer} z8`)
    }
  }
})

test("plan: z13 order starts at the user's current view, not a fixed centre", () => {
  const near = (centre) => {
    const z13 = plan({ allowed: true, ringsKm: [5] }, centre).filter((u) => zOf(u) === 13)
    return z13[0]
  }
  assert.notEqual(near({ lng: -0.1276, lat: 51.5072 }), near({ lng: 0.2, lat: 51.6 }))
})

test("plan: ring sizes match the measured budget (5 km about 0.9 MB of road Lden-equivalent tiles, more with 20 km)", () => {
  const n5 = plan({ allowed: true, ringsKm: [5] }).filter((u) => zOf(u) === 13).length
  const n20 = plan({ allowed: true, ringsKm: [5, 10, 20] }).filter((u) => zOf(u) === 13).length
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
