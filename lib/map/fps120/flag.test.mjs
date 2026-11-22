import assert from "node:assert/strict"
import test from "node:test"

import { nextSampleDelay, readFps120Flags } from "./flag.ts"

const memory = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
}

test("fps120 is off by default", () => {
  assert.deepEqual(readFps120Flags("", memory()), { controller: false, meter: false })
  assert.deepEqual(readFps120Flags("?lat=1", null), { controller: false, meter: false })
})

test("?fps120=1 sticks until ?fps120=0", () => {
  const s = memory()
  assert.deepEqual(readFps120Flags("?fps120=1", s), { controller: true, meter: true })
  assert.deepEqual(readFps120Flags("", s), { controller: true, meter: true })
  assert.deepEqual(readFps120Flags("?fps120=0", s), { controller: false, meter: false })
  assert.deepEqual(readFps120Flags("", s), { controller: false, meter: false })
})

test("?fpsmeter=1 shows the meter without the controller", () => {
  assert.deepEqual(readFps120Flags("?fpsmeter=1", memory()), { controller: false, meter: true })
})

test("samples land on the 120 Hz grid of the last frame", () => {
  const I = 1000 / 120
  assert.ok(Math.abs(nextSampleDelay(100, 100, I) - I) < 1e-9)
  assert.ok(Math.abs(nextSampleDelay(103, 100, I) - (I - 3)) < 1e-9)
  // Too close to a tick: skip to the next one.
  assert.ok(Math.abs(nextSampleDelay(108, 100, I) - (2 * I - 8)) < 1e-9)
})
