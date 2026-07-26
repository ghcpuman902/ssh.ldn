import { type NextRequest } from "next/server";

import { osmGridCellBbox } from "@/lib/map/osm-grid";
import { osmCellCacheHeaders } from "@/lib/server/http-cache";
import {
  getRailLinesGeoJsonForCell,
  getRailStationsGeoJsonForCell,
} from "@/lib/server/osm-rail-visual";

export const GET = async (request: NextRequest) => {
  const row = request.nextUrl.searchParams.get("row");
  const col = request.nextUrl.searchParams.get("col");
  const layer = request.nextUrl.searchParams.get("layer") ?? "lines";

  if (row === null || col === null) {
    return Response.json({ error: "row and col are required" }, { status: 400 });
  }

  const parsedRow = Number(row);
  const parsedCol = Number(col);

  if (!Number.isInteger(parsedRow) || !Number.isInteger(parsedCol)) {
    return Response.json({ error: "row and col must be integers" }, { status: 400 });
  }

  const namespace = layer === "stations" ? "rail-stations" : "rail-lines";

  try {
    const cell = osmGridCellBbox(parsedRow, parsedCol);
    const geojson =
      layer === "stations"
        ? await getRailStationsGeoJsonForCell(cell)
        : await getRailLinesGeoJsonForCell(cell);

    return Response.json(geojson, {
      headers: osmCellCacheHeaders(namespace),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "OSM rail visual lookup failed",
      },
      { status: 502 },
    );
  }
};
