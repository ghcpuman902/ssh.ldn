import {
  NOISE_TILE_MAX_ZOOM,
  NOISE_TILE_MIN_ZOOM,
} from "@/lib/map/config";
import {
  DEFRA_MAP_LAYERS,
  type DefraMapKind,
  type DefraNoisePeriod,
  resolveDefraWmsConfig,
} from "@/lib/map/defra-layers";
import { xyzToWebMercatorBbox } from "@/lib/map/web-mercator";
import { readLocalNoiseTile } from "@/lib/server/local-noise-tile";

/** local = disk only; live = WMS only; auto = disk then WMS (default). */
const tileSource = (): "local" | "live" | "auto" => {
  const value = process.env.NOISE_TILE_SOURCE?.toLowerCase();
  if (value === "local" || value === "live" || value === "auto") return value;
  return "auto";
};

const TILE_SIZE = 256;

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

  if (source !== "live") {
    const local = await readLocalNoiseTile({ kind, period, z, x, y });
    if (local) return local;
    if (source === "local") {
      throw new Error(`Local noise tile missing: ${kind}/${period}/${z}/${x}/${y}`);
    }
  }

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

  return buffer;
};
