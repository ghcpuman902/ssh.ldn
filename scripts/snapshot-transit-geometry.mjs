/**
 * Copy unique-track centreline artefacts from TfL-Components into data/transit/.
 * Runtime map routes serve these files only — no TfL / Overpass, and no copy of
 * the unique-track algorithm (that lives in TfL-Components).
 *
 *   pnpm snapshot-transit
 *
 * Looks for:
 *   ../tfl-components/data/geography/unique-track
 * Override with UNIQUE_TRACK_DIR if the sibling repo sits elsewhere.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const MODES = ["tube", "overground", "elizabeth", "dlr", "tram"]
const DEFAULT_SOURCE = path.resolve(
  ROOT,
  "../tfl-components/data/geography/unique-track"
)
const SOURCE_ROOT = process.env.UNIQUE_TRACK_DIR
  ? path.resolve(process.env.UNIQUE_TRACK_DIR)
  : DEFAULT_SOURCE
const OUT_ROOT = path.join(ROOT, "data/transit")

const fileBytes = async (filePath) => (await stat(filePath)).size

const snapshotMode = async (mode, sourceManifest) => {
  const sourceDir = path.join(SOURCE_ROOT, mode)
  const fullSrc = path.join(sourceDir, "full.json")
  const previewSrc = path.join(sourceDir, "preview.json")
  const fullRaw = await readFile(fullSrc, "utf8")
  const previewRaw = await readFile(previewSrc, "utf8")
  const full = JSON.parse(fullRaw)
  const preview = JSON.parse(previewRaw)

  const outDir = path.join(OUT_ROOT, mode)
  await mkdir(outDir, { recursive: true })
  await copyFile(fullSrc, path.join(outDir, "full.json"))
  await copyFile(previewSrc, path.join(outDir, "preview.json"))

  const sourceEntry = sourceManifest.modes?.find((entry) => entry.mode === mode)

  return {
    mode,
    source: path.relative(ROOT, fullSrc),
    stations: full.stations?.features?.length ?? 0,
    fullLines: full.lines?.features?.length ?? 0,
    previewLines: preview.lines?.features?.length ?? 0,
    fullBytes: Buffer.byteLength(fullRaw),
    previewBytes: Buffer.byteLength(previewRaw),
    lineSource: "osm-unique-track-centreline",
    uniqueTrackSnapshottedAt: sourceManifest.snapshottedAt ?? null,
    uniqueTrackFullLines: sourceEntry?.fullLines ?? null,
    uniqueTrackPreviewLines: sourceEntry?.previewLines ?? null,
    uniqueTrackFullBytes: sourceEntry?.fullBytes ?? (await fileBytes(fullSrc)),
    uniqueTrackPreviewBytes:
      sourceEntry?.previewBytes ?? (await fileBytes(previewSrc)),
  }
}

const sourceManifest = JSON.parse(
  await readFile(path.join(SOURCE_ROOT, "manifest.json"), "utf8")
)

const manifest = []

for (const mode of MODES) {
  const entry = await snapshotMode(mode, sourceManifest)
  manifest.push(entry)
  console.log(
    `${mode}: full ${entry.fullLines} lines ${(entry.fullBytes / 1024).toFixed(0)} KB, preview ${entry.previewLines} lines ${(entry.previewBytes / 1024).toFixed(0)} KB, ${entry.stations} stations`
  )
}

await writeFile(
  path.join(OUT_ROOT, "manifest.json"),
  `${JSON.stringify(
    {
      description:
        "Static unique-track centreline geometry copied from TfL-Components. Map API streams these files; do not fetch TfL at request time. Refresh with pnpm snapshot-transit while the sibling repo is present.",
      snapshottedAt: new Date().toISOString(),
      source: {
        kind: "tfl-components-unique-track-centreline",
        directory: path.relative(ROOT, SOURCE_ROOT),
        description: sourceManifest.description,
        snapshottedAt: sourceManifest.snapshottedAt,
      },
      modes: manifest,
    },
    null,
    2
  )}\n`
)
