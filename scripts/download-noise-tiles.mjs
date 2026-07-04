#!/usr/bin/env node
/**
 * Pre-download DEFRA WMS noise tiles for Greater London into data/noise/tiles/.
 *
 * Usage:
 *   pnpm download-noise-tiles
 *   pnpm download-noise-tiles -- --min-zoom 10 --max-zoom 11 --kinds road,rail
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TILE_ROOT = path.join(ROOT, "data/noise/tiles");
const MANIFEST_PATH = path.join(ROOT, "data/noise/manifest.json");

const LONDON_BOUNDS = { west: -0.52, south: 51.28, east: 0.24, north: 51.72 };

const DEFRA_DATASETS = {
  road: {
    datasetId: "562c9d56-7c2d-4d42-83bb-578d6e97a517",
    wmsByPeriod: {
      day: {
        layer: "Road_Noise_Lday_England_Round_4_All",
        style: "Road_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
      },
      night: {
        layer: "Road_Noise_Lnight_England_Round_4_All",
        style: "Road_Noise_Mapping_Style_LNGT_L06H(-70)",
      },
      evening: {
        layer: "Road_Noise_Leve_England_Round_4_All",
        style: "Road_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
      },
      all: {
        layer: "Road_Noise_Lden_England_Round_4_All",
        style: "Road_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
      },
    },
  },
  rail: {
    datasetId: "3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947",
    wmsByPeriod: {
      day: {
        layer: "Rail_Noise_Lday_England_Round_4_All",
        style: "Rail_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
      },
      night: {
        layer: "Rail_Noise_Lnight_England_Round_4_All",
        style: "Rail_Noise_Mapping_Style_LNGT_L06H(-70)",
      },
      evening: {
        layer: "Rail_Noise_Leve_England_Round_4_All",
        style: "Rail_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
      },
      all: {
        layer: "Rail_Noise_Lden_England_Round_4_All",
        style: "Rail_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
      },
    },
  },
  airport: {
    datasetId: "dac9cba4-abe7-43bd-b8e9-8a83da52edd8",
    wmsByPeriod: {
      day: { layer: "Airport_Noise_ALL_Lday", style: "" },
      night: { layer: "Airport_Noise_ALL_Lnight", style: "" },
      evening: { layer: "Airport_Noise_ALL_Leve", style: "" },
      all: { layer: "Airport_Noise_ALL_Lden", style: "" },
    },
  },
};

const TILE_SIZE = 256;
const SCALE = 40075016.686;
const HALF = SCALE / 2;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
  };

  return {
    minZoom: Number(get("--min-zoom", "10")),
    maxZoom: Number(get("--max-zoom", "12")),
    kinds: get("--kinds", "road,rail,airport").split(",").filter(Boolean),
    periods: get("--periods", "day,night,evening,all").split(",").filter(Boolean),
    delayMs: Number(get("--delay-ms", "120")),
  };
};

const lngLatToTile = (lng, lat, z) => {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
};

const tileRangeForBounds = (bounds, z) => {
  const topLeft = lngLatToTile(bounds.west, bounds.north, z);
  const bottomRight = lngLatToTile(bounds.east, bounds.south, z);
  return {
    minX: topLeft.x,
    maxX: bottomRight.x,
    minY: topLeft.y,
    maxY: bottomRight.y,
  };
};

const xyzToWebMercatorBbox = (z, x, y) => {
  const n = 2 ** z;
  const minX = (x / n) * SCALE - HALF;
  const maxX = ((x + 1) / n) * SCALE - HALF;
  const maxY = HALF - (y / n) * SCALE;
  const minY = HALF - ((y + 1) / n) * SCALE;
  return { minX, minY, maxX, maxY };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildWmsUrl = (datasetId, wms, z, x, y) => {
  const { minX, minY, maxX, maxY } = xyzToWebMercatorBbox(z, x, y);
  const url = new URL(
    `https://environment.data.gov.uk/geoservices/datasets/${datasetId}/wms`
  );
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("LAYERS", wms.layer);
  url.searchParams.set("CRS", "EPSG:3857");
  url.searchParams.set("BBOX", `${minX},${minY},${maxX},${maxY}`);
  url.searchParams.set("WIDTH", String(TILE_SIZE));
  url.searchParams.set("HEIGHT", String(TILE_SIZE));
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "TRUE");
  if (wms.style) url.searchParams.set("STYLES", wms.style);
  return url.toString();
};

const tilePath = (kind, period, z, x, y) =>
  path.join(TILE_ROOT, kind, period, String(z), String(x), `${y}.png`);

const downloadTile = async (kind, period, z, x, y, delayMs) => {
  const outPath = tilePath(kind, period, z, x, y);
  await mkdir(path.dirname(outPath), { recursive: true });

  try {
    const { access } = await import("node:fs/promises");
    await access(outPath);
    return { status: "skipped" };
  } catch {
    // not cached yet
  }

  const dataset = DEFRA_DATASETS[kind];
  if (!dataset) throw new Error(`Unknown kind: ${kind}`);
  const wms = dataset.wmsByPeriod[period];
  if (!wms) throw new Error(`Unknown period: ${period}`);

  const response = await fetch(buildWmsUrl(dataset.datasetId, wms, z, x, y), {
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return { status: "failed", error: `HTTP ${response.status}` };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const header = buffer.subarray(0, 32).toString("utf8");
  if (header.startsWith("<?xml") || header.startsWith("<ServiceException")) {
    return { status: "failed", error: "WMS error XML" };
  }

  await writeFile(outPath, buffer);
  if (delayMs > 0) await sleep(delayMs);
  return { status: "downloaded" };
};

const main = async () => {
  const { minZoom, maxZoom, kinds, periods, delayMs } = parseArgs();
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `Downloading DEFRA noise tiles for London z${minZoom}-${maxZoom} (${kinds.join(", ")})`
  );

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const range = tileRangeForBounds(LONDON_BOUNDS, z);

    for (const kind of kinds) {
      for (const period of periods) {
        for (let x = range.minX; x <= range.maxX; x += 1) {
          for (let y = range.minY; y <= range.maxY; y += 1) {
            const result = await downloadTile(kind, period, z, x, y, delayMs);
            if (result.status === "downloaded") downloaded += 1;
            if (result.status === "skipped") skipped += 1;
            if (result.status === "failed") {
              failed += 1;
              console.warn(`Failed ${kind}/${period}/${z}/${x}/${y}: ${result.error}`);
            }
          }
        }
      }
    }
  }

  const manifest = {
    version: 1,
    description:
      "Local DEFRA noise tile cache for Greater London. Regenerate with pnpm download-noise-tiles.",
    downloadedAt: new Date().toISOString(),
    bbox: LONDON_BOUNDS,
    zoomRange: { min: minZoom, max: maxZoom },
    kinds,
    periods,
    tileCount: downloaded + skipped,
    stats: { downloaded, skipped, failed },
    credits: [
      {
        id: "defra-road-noise-r4",
        licence: "Open Government Licence v3.0",
        datasetUrl:
          "https://environment.data.gov.uk/dataset/562c9d56-7c2d-4d42-83bb-578d6e97a517",
      },
      {
        id: "defra-rail-noise-r4",
        licence: "Open Government Licence v3.0",
        datasetUrl:
          "https://environment.data.gov.uk/dataset/3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947",
      },
      {
        id: "defra-airport-noise-r4",
        licence: "Open Government Licence v3.0",
        datasetUrl:
          "https://environment.data.gov.uk/dataset/dac9cba4-abe7-43bd-b8e9-8a83da52edd8",
      },
    ],
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Done: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
