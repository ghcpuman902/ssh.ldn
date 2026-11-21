#!/usr/bin/env node
// Per-venue activity (0-1 share of each time slot the venue is open) for the
// local-sources grid bake (bake_local.py). Same OSM features and the same
// opening-hours model as the POI density tiles (scripts/generate-poi-density-tiles.mjs).
//
// Run: node scripts/noise-bake/local_activity.mjs > local_activity.json
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { wgs84ToBng } from "../../lib/map/noise-cell-reader.ts"
import { DENSITY_SLOTS, REACH_METERS, WEIGHTS, activityForSlot } from "../generate-poi-density-tiles.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const { features } = JSON.parse(await readFile(path.join(ROOT, "data/poi-density/features.json"), "utf8"))
const out = features.map((f) => ({
  id: f.id,
  amenity: f.amenity,
  lat: f.latitude,
  lng: f.longitude,
  // BNG with the app's own transform, so baked cells line up with the cells the app reads.
  ...(({ easting, northing }) => ({ e: easting, n: northing }))(wgs84ToBng(f.latitude, f.longitude)),
  activity: Object.fromEntries(DENSITY_SLOTS.map((slot) => [slot, activityForSlot(f, slot)])),
}))
process.stdout.write(JSON.stringify({ slots: DENSITY_SLOTS, reachMeters: REACH_METERS, weights: WEIGHTS, features: out }))
