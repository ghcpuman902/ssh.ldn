/**
 * Merge hashed osm-cache overlays into data/osm-static/{ns}/{row}-{col}.json.
 * Map cell routes serve these files only — no Overpass at request time.
 *
 *   pnpm snapshot-osm-cells
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CACHE_ROOT = path.join(ROOT, "data/osm-cache");
const OUT_ROOT = path.join(ROOT, "data/osm-static");
const WEST = -0.57;
const SOUTH = 51.24;
const EAST = 0.36;
const NORTH = 51.73;
const CELL_DEG = 0.04;

const NAMESPACES = ["nightlife", "rail-lines", "rail-stations", "green-spaces"];

const maxCol = Math.floor((EAST - WEST) / CELL_DEG);
const maxRow = Math.floor((NORTH - SOUTH) / CELL_DEG);

const cellOfPoint = (lng, lat) => {
  if (lng < WEST || lng > EAST || lat < SOUTH || lat > NORTH) return null;
  return {
    row: Math.floor((lat - SOUTH) / CELL_DEG),
    col: Math.floor((lng - WEST) / CELL_DEG),
  };
};

const flattenCoords = (value, into) => {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number") {
    into.push(value);
    return;
  }
  for (const item of value) flattenCoords(item, into);
};

const cellsForFeature = (feature) => {
  const coords = [];
  flattenCoords(feature.geometry?.coordinates, coords);
  const keys = new Set();

  for (const [lng, lat] of coords) {
    const cell = cellOfPoint(lng, lat);
    if (!cell) continue;
    keys.add(`${cell.row}-${cell.col}`);
  }

  return keys;
};

const featureId = (feature) =>
  feature.properties?.featureId ?? feature.id ?? JSON.stringify(feature.geometry);

const snapshotNamespace = async (namespace) => {
  const cacheDir = path.join(CACHE_ROOT, namespace);
  const outDir = path.join(OUT_ROOT, namespace);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(cacheDir).catch(() => [])).filter((name) =>
    name.endsWith(".json")
  );
  const unique = new Map();
  let meta = null;

  for (const name of files) {
    const json = JSON.parse(await readFile(path.join(cacheDir, name), "utf8"));
    if (!meta && json.meta) meta = json.meta;
    for (const feature of json.features ?? []) {
      unique.set(featureId(feature), feature);
    }
  }

  const buckets = new Map();
  for (const feature of unique.values()) {
    for (const key of cellsForFeature(feature)) {
      const list = buckets.get(key);
      if (list) list.push(feature);
      else buckets.set(key, [feature]);
    }
  }

  let bytes = 0;
  for (const [key, features] of buckets) {
    const body = JSON.stringify({
      type: "FeatureCollection",
      features,
      meta: {
        source: "repo-snapshot",
        filter: meta?.filter,
        featureCount: features.length,
        retrievedAt: meta?.retrievedAt,
        cell: key,
      },
    });
    await writeFile(path.join(outDir, `${key}.json`), body);
    bytes += Buffer.byteLength(body);
  }

  return {
    namespace,
    sourceFiles: files.length,
    uniqueFeatures: unique.size,
    cellsWritten: buckets.size,
    gridCells: (maxRow + 1) * (maxCol + 1),
    bytes,
  };
};

const manifest = [];

for (const namespace of NAMESPACES) {
  const entry = await snapshotNamespace(namespace);
  manifest.push(entry);
  console.log(
    `${entry.namespace}: ${entry.uniqueFeatures} features → ${entry.cellsWritten} cells, ${(entry.bytes / 1024 / 1024).toFixed(1)} MB`
  );
}

await writeFile(
  path.join(OUT_ROOT, "manifest.json"),
  `${JSON.stringify(
    {
      description:
        "Static OSM map cells. Discovery cell APIs stream these files; do not fetch Overpass at request time.",
      snapshottedAt: new Date().toISOString(),
      grid: {
        west: WEST,
        south: SOUTH,
        east: EAST,
        north: NORTH,
        cellDeg: CELL_DEG,
      },
      namespaces: manifest,
    },
    null,
    2
  )}\n`
);
