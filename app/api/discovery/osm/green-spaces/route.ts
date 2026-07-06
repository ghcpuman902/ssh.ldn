import { type NextRequest } from "next/server";

import { osmGridCellBbox } from "@/lib/map/osm-grid";
import { getGreenSpacesGeoJsonForCell } from "@/lib/server/osm-green-spaces";

export const GET = async (request: NextRequest) => {
  const row = request.nextUrl.searchParams.get("row");
  const col = request.nextUrl.searchParams.get("col");

  if (row === null || col === null) {
    return Response.json({ error: "row and col are required" }, { status: 400 });
  }

  const parsedRow = Number(row);
  const parsedCol = Number(col);

  if (!Number.isInteger(parsedRow) || !Number.isInteger(parsedCol)) {
    return Response.json({ error: "row and col must be integers" }, { status: 400 });
  }

  try {
    const cell = osmGridCellBbox(parsedRow, parsedCol);
    const geojson = await getGreenSpacesGeoJsonForCell(cell);
    return Response.json(geojson);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OSM green spaces lookup failed",
      },
      { status: 502 },
    );
  }
};
