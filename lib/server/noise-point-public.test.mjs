// The point API must stay reachable for agents (DESIGN section 8): listed in
// the proxy's public prefixes, in llms.txt and robots, and not behind BotID.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (f) => readFileSync(path.join(root, f), "utf8")

test("proxy.ts lists /api/noise/point as public", () => {
  assert.match(read("proxy.ts"), /PUBLIC_API_PREFIXES = \[[^\]]*"\/api\/noise\/point"/s)
})
test("llms.txt and robots advertise it", () => {
  assert.match(read("lib/llms-content.ts"), /api\/noise\/point\?lat=/)
  assert.match(read("app/robots.ts"), /"\/api\/noise\/point"/)
})
test("BotID does not protect the route (it would block agents)", () => {
  assert.doesNotMatch(read("instrumentation-client.ts"), /api\/noise\/point/)
  assert.doesNotMatch(read("app/api/noise/point/route.ts"), /enforceBotProtection|checkBotId/)
})
