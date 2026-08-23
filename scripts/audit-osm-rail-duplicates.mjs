/**
 * Audit committed OSM above-ground railway cells for true duplicates.
 *
 * Distinguishes:
 *   - the same OSM way id repeated across grid cells (expected; the client
 *     merges loaded cells by feature id)
 *   - the same OSM way id twice in one cell (generation bug)
 *   - identical or reversed coordinate sequences on different way ids
 *   - consecutive repeated coordinates inside a feature
 *   - exact repeated vertex-pairs across different features in one cell
 *
 * Does not treat nearby parallel tracks as duplicates.
 *
 *   node scripts/audit-osm-rail-duplicates.mjs
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const RAIL_DIR = path.join(ROOT, "data/osm-static/rail-lines")

const coordKey = (lng, lat) => `${lng.toFixed(7)},${lat.toFixed(7)}`

const sequenceKey = (coordinates, reversed = false) => {
  const points = reversed ? [...coordinates].reverse() : coordinates
  return points.map(([lng, lat]) => coordKey(lng, lat)).join(">")
}

const segmentKey = (a, b) => {
  const left = coordKey(a[0], a[1])
  const right = coordKey(b[0], b[1])
  return left < right ? `${left}|${right}` : `${right}|${left}`
}

const files = (await readdir(RAIL_DIR))
  .filter((name) => name.endsWith(".json"))
  .sort()

const idCells = new Map()
const identicalSeq = new Map()
const reversedSeq = new Map()
let intraCellIdDupes = 0
let consecutiveRepeats = 0
let intraCellExactSegments = 0
let totalFeatures = 0
const intraCellIdExamples = []
const consecutiveExamples = []
const identicalExamples = []
const reversedExamples = []
const segmentExamples = []

for (const name of files) {
  const json = JSON.parse(await readFile(path.join(RAIL_DIR, name), "utf8"))
  const features = json.features ?? []
  const idsInCell = new Map()
  const segmentsInCell = new Map()

  for (const feature of features) {
    totalFeatures += 1
    const id = String(feature.id ?? feature.properties?.featureId ?? "")
    const coordinates = feature.geometry?.coordinates ?? []

    const cells = idCells.get(id) ?? []
    cells.push(name)
    idCells.set(id, cells)

    idsInCell.set(id, (idsInCell.get(id) ?? 0) + 1)

    for (let i = 1; i < coordinates.length; i += 1) {
      const prev = coordinates[i - 1]
      const curr = coordinates[i]
      if (prev[0] === curr[0] && prev[1] === curr[1]) {
        consecutiveRepeats += 1
        if (consecutiveExamples.length < 8) {
          consecutiveExamples.push({ cell: name, id, index: i })
        }
      }
      if (i > 0) {
        const key = segmentKey(prev, curr)
        const owners = segmentsInCell.get(key) ?? []
        if (!owners.includes(id)) owners.push(id)
        segmentsInCell.set(key, owners)
      }
    }

    if (coordinates.length >= 2) {
      const forward = sequenceKey(coordinates)
      const backward = sequenceKey(coordinates, true)
      const forwardHits = identicalSeq.get(forward) ?? []
      forwardHits.push({ cell: name, id })
      identicalSeq.set(forward, forwardHits)
      const reverseHits = reversedSeq.get(backward) ?? []
      reverseHits.push({ cell: name, id })
      reversedSeq.set(backward, reverseHits)
    }
  }

  for (const [id, count] of idsInCell) {
    if (count > 1) {
      intraCellIdDupes += 1
      if (intraCellIdExamples.length < 8) {
        intraCellIdExamples.push({ cell: name, id, count })
      }
    }
  }

  for (const [key, owners] of segmentsInCell) {
    if (owners.length > 1) {
      intraCellExactSegments += 1
      if (segmentExamples.length < 8) {
        segmentExamples.push({ cell: name, segment: key, wayIds: owners })
      }
    }
  }
}

const crossCellIdRepeats = [...idCells.values()].filter(
  (cells) => new Set(cells).size > 1
).length

const identicalDifferentIds = []
for (const hits of identicalSeq.values()) {
  const ids = new Set(hits.map((hit) => hit.id))
  if (ids.size > 1) identicalDifferentIds.push(hits)
}

const reversedDifferentIds = []
for (const hits of reversedSeq.values()) {
  const ids = new Set(hits.map((hit) => hit.id))
  if (ids.size > 1) reversedDifferentIds.push(hits)
}

const report = {
  cells: files.length,
  totalFeatureCopies: totalFeatures,
  uniqueOsmWayIds: idCells.size,
  expectedCrossCellIdRepeats: crossCellIdRepeats,
  intraCellDuplicateWayIds: intraCellIdDupes,
  consecutiveRepeatedCoordinates: consecutiveRepeats,
  identicalCoordinateSequencesDifferentIds: identicalDifferentIds.length,
  reversedCoordinateSequencesDifferentIds: reversedDifferentIds.length,
  intraCellSharedExactSegmentsDifferentIds: intraCellExactSegments,
  examples: {
    intraCellIdDupes: intraCellIdExamples,
    consecutiveRepeats: consecutiveExamples,
    identicalSequences: identicalDifferentIds.slice(0, 5).map((hits) => hits),
    reversedSequences: reversedDifferentIds.slice(0, 5).map((hits) => hits),
    sharedSegments: segmentExamples,
  },
}

console.log(JSON.stringify(report, null, 2))
