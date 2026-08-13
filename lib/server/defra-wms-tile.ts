import { getCache } from "@vercel/functions";

import {
  NOISE_TILE_MAX_ZOOM,
  NOISE_TILE_MIN_ZOOM,
  NOISE_TILE_PRECACHE_MAX_ZOOM,
} from "@/lib/map/config";
import {
  DEFRA_MAP_LAYERS,
  type DefraMapKind,
  type DefraNoisePeriod,
  resolveDefraWmsConfig,
} from "@/lib/map/defra-layers";
import { xyzToWebMercatorBbox } from "@/lib/map/web-mercator";
import {
  readLocalNoiseTile,
  writeLocalNoiseTile,
} from "@/lib/server/local-noise-tile";

/** local = disk only; live = WMS only; auto = disk then WMS (default). */
const tileSource = (): "local" | "live" | "auto" => {
  const value = process.env.NOISE_TILE_SOURCE?.toLowerCase();
  if (value === "local" || value === "live" || value === "auto") return value;
  return "auto";
};

const TILE_SIZE = 256;
const TILE_RUNTIME_TTL_SECONDS = 86_400;

const tileRuntimeKey = (
  kind: DefraMapKind,
  period: DefraNoisePeriod,
  z: number,
  x: number,
  y: number
) => `${kind}:${period}:${z}:${x}:${y}`;

const readTileRuntimeCache = async (key: string) => {
  try {
    const cached = await getCache({ namespace: "defra-tiles" }).get(key);
    if (typeof cached !== "string" || cached.length === 0) return null;

    const buffer = Buffer.from(cached, "base64");
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch {
    return null;
  }
};

const writeTileRuntimeCache = async (key: string, data: ArrayBuffer) => {
  try {
    await getCache({ namespace: "defra-tiles" }).set(
      key,
      Buffer.from(data).toString("base64"),
      {
        ttl: TILE_RUNTIME_TTL_SECONDS,
        tags: ["defra-tile"],
        name: key,
      }
    );
  } catch {
    // Runtime Cache unavailable locally — disk / WMS still serve the tile.
  }
};

export const fetchDefraWmsTile = async ({
  kind,
  period,
  z,
  x,
  y,
}: {
  kind: DefraMapKind;
  period: DefraNoisePeriod;
  z: number;
  x: number;
  y: number;
}) => {
  if (z < NOISE_TILE_MIN_ZOOM || z > NOISE_TILE_MAX_ZOOM) {
    throw new Error(
      `Noise tiles only available at z${NOISE_TILE_MIN_ZOOM}–${NOISE_TILE_MAX_ZOOM}`
    );
  }

  const source = tileSource();
  const runtimeKey = tileRuntimeKey(kind, period, z, x, y);

  if (source !== "live") {
    const local = await readLocalNoiseTile({ kind, period, z, x, y });
    if (local) return local;
    if (source === "local") {
      throw new Error(`Local noise tile missing: ${kind}/${period}/${z}/${x}/${y}`);
    }
  }

  const fromRuntime = await readTileRuntimeCache(runtimeKey);
  if (fromRuntime) return fromRuntime;

  const dataset = DEFRA_MAP_LAYERS[kind];
  const wms = resolveDefraWmsConfig(kind, period);
  const { minX, minY, maxX, maxY } = xyzToWebMercatorBbox(z, x, y);

  const url = new URL(
    `https://environment.data.gov.uk/geoservices/datasets/${dataset.datasetId}/wms`
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
  if (wms.style) {
    url.searchParams.set("STYLES", wms.style);
  }

  const response = await fetch(url, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`DEFRA WMS tile failed (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const header = new TextDecoder().decode(buffer.slice(0, 32));

  if (header.startsWith("<?xml") || header.startsWith("<ServiceException")) {
    throw new Error("DEFRA WMS returned error XML instead of PNG");
  }

  if (z > NOISE_TILE_PRECACHE_MAX_ZOOM) {
    void writeLocalNoiseTile({ kind, period, z, x, y }, buffer);
  }

  void writeTileRuntimeCache(runtimeKey, buffer);

  return buffer;
};
