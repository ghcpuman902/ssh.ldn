import { type NextRequest } from "next/server";

import {
  isDefraMapKind,
  isDefraNoisePeriod,
} from "@/lib/map/defra-layers";
import { parseTileParams } from "@/lib/map/web-mercator";
import { fetchDefraWmsTile } from "@/lib/server/defra-wms-tile";

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ kind: string; z: string; x: string; y: string }> }
) => {
  const { kind, z, x, y } = await context.params;
  const periodParam = request.nextUrl.searchParams.get("period") ?? "day";
  const period = isDefraNoisePeriod(periodParam) ? periodParam : "day";

  if (!isDefraMapKind(kind)) {
    return new Response("Unknown layer kind", { status: 404 });
  }

  const tile = parseTileParams(z, x, y.replace(/\.png$/i, ""));
  if (!tile) {
    return new Response("Invalid tile coordinates", { status: 400 });
  }

  try {
    const buffer = await fetchDefraWmsTile({
      kind,
      period,
      z: tile.z,
      x: tile.x,
      y: tile.y,
    });

    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "DEFRA tile proxy failed",
      { status: 502 }
    );
  }
};
