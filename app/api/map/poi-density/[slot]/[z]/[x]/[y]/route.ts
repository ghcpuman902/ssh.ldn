import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  POI_DENSITY_TILE_MAX_ZOOM,
  POI_DENSITY_TILE_MIN_ZOOM,
} from "@/lib/map/config";
import { isPoiDensitySlot } from "@/lib/map/poi-density";
import { parseTileParams } from "@/lib/map/web-mercator";
import { tileCacheHeaders } from "@/lib/server/http-cache";

const TILE_ROOT = path.join(process.cwd(), "public/poi-density/tiles");
const EMPTY_TILE_PATH = path.join(
  process.cwd(),
  "public/poi-density/empty.png"
);

const PNG_HEADERS = tileCacheHeaders("poi-density");

/**
 * Sparse generator only writes tiles with density. MapLibre still requests the
 * full viewport grid — serve a transparent PNG for empty cells instead of 404.
 */
export const GET = async (
  _request: Request,
  context: {
    params: Promise<{ slot: string; z: string; x: string; y: string }>;
  }
) => {
  const { slot, z, x, y } = await context.params;

  if (!isPoiDensitySlot(slot)) {
    return new Response("Unknown density slot", { status: 404 });
  }

  const tile = parseTileParams(z, x, y.replace(/\.png$/i, ""));
  if (!tile) {
    return new Response("Invalid tile coordinates", { status: 400 });
  }

  if (
    tile.z < POI_DENSITY_TILE_MIN_ZOOM ||
    tile.z > POI_DENSITY_TILE_MAX_ZOOM
  ) {
    return new Response("Zoom out of range", { status: 404 });
  }

  const tilePath = path.join(
    TILE_ROOT,
    slot,
    String(tile.z),
    String(tile.x),
    `${tile.y}.png`
  );

  try {
    const buffer = await readFile(/* turbopackIgnore: true */ tilePath);
    return new Response(buffer, { headers: PNG_HEADERS });
  } catch {
    try {
      const empty = await readFile(/* turbopackIgnore: true */ EMPTY_TILE_PATH);
      return new Response(empty, { headers: PNG_HEADERS });
    } catch {
      return new Response("Empty tile unavailable", { status: 404 });
    }
  }
};
