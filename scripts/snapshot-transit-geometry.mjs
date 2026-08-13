/**
 * Snapshot transit geometry from local osm-cache into data/transit/.
 * Runtime map routes serve these files only — no TfL / Overpass.
 *
 *   pnpm snapshot-transit
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collapseTransitBundle,
  FULL_SIMPLIFY_DEG,
  PREVIEW_SIMPLIFY_DEG,
} from "./collapse-transit-geometry.mjs";

const ROOT = process.cwd();
const CACHE_ROOT = path.join(ROOT, "data/osm-cache");
const OUT_ROOT = path.join(ROOT, "data/transit");
const MODES = ["tube", "overground", "elizabeth", "dlr", "tram"];

const newestJson = async (dir) => {
  const entries = await readdir(dir).catch(() => []);
  const files = [];

  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const filePath = path.join(dir, name);
    const meta = await stat(filePath);
    files.push({ filePath, mtime: meta.mtimeMs, size: meta.size });
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files[0] ?? null;
};

const snapshotMode = async (mode) => {
  const cacheDir = path.join(CACHE_ROOT, `${mode}-geometry`);
  const newest = await newestJson(cacheDir);

  if (!newest) {
    throw new Error(`No osm-cache for ${mode} at ${cacheDir}`);
  }

  const raw = JSON.parse(await readFile(newest.filePath, "utf8"));
  const full = collapseTransitBundle(raw, FULL_SIMPLIFY_DEG);
  const preview = collapseTransitBundle(raw, PREVIEW_SIMPLIFY_DEG);

  const outDir = path.join(OUT_ROOT, mode);
  await mkdir(outDir, { recursive: true });

  const fullJson = JSON.stringify(full);
  const previewJson = JSON.stringify(preview);
  await writeFile(path.join(outDir, "full.json"), fullJson);
  await writeFile(path.join(outDir, "preview.json"), previewJson);

  return {
    mode,
    source: path.relative(ROOT, newest.filePath),
    stations: full.stations?.features?.length ?? 0,
    fullLines: full.lines?.features?.length ?? 0,
    previewLines: preview.lines?.features?.length ?? 0,
    fullBytes: Buffer.byteLength(fullJson),
    previewBytes: Buffer.byteLength(previewJson),
    lineSource: full.lines?.meta?.source ?? null,
  };
};

const manifest = [];

for (const mode of MODES) {
  const entry = await snapshotMode(mode);
  manifest.push(entry);
  console.log(
    `${mode}: full ${entry.fullLines} lines ${(entry.fullBytes / 1024).toFixed(0)} KB, preview ${entry.previewLines} lines ${(entry.previewBytes / 1024).toFixed(0)} KB, ${entry.stations} stations`
  );
}

await writeFile(
  path.join(OUT_ROOT, "manifest.json"),
  `${JSON.stringify(
    {
      description:
        "Static TfL/OSM transit geometry. Map API streams these files; do not fetch TfL at request time.",
      snapshottedAt: new Date().toISOString(),
      modes: manifest,
    },
    null,
    2
  )}\n`
);
