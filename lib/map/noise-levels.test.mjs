import assert from "node:assert/strict"
import { test } from "node:test"

import { fetchNoiseLevels, parseNoiseLevels } from "./noise-levels.ts"

const body = {
  results: [
    {
      road: { Lden: { db: 62.5, band: 4 }, Lday: { db: 61, band: 3 }, Leve: { db: 60, band: 3 }, Lnight: { db: 55.5, band: 6 } },
      rail: { Lden: { db: null, band: 0 }, Lday: { db: null, band: 0 }, Leve: { db: null, band: 0 }, Lnight: { db: null, band: 0 } },
      airport: null,
    },
  ],
}

test("parseNoiseLevels keeps road, rail and airport apart and maps missing data to null", () => {
  const levels = parseNoiseLevels(body)
  assert.equal(levels.road.Lden, 62.5)
  assert.equal(levels.road.Lnight, 55.5)
  assert.equal(levels.rail.Lday, null)
  assert.equal(levels.airport.Lden, null)
  assert.equal(parseNoiseLevels({ results: [] }), null)
})

test("fetchNoiseLevels makes one same-origin call to the point API", async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => body }
  }
  const levels = await fetchNoiseLevels({ latitude: 51.5, longitude: -0.12 })
  assert.deepEqual(calls, ["/api/noise/point?lat=51.5&lng=-0.12"])
  assert.equal(levels.road.Lday, 61)
})
