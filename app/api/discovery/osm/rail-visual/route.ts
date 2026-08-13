import { type NextRequest } from "next/server";

import { streamOsmStaticCell } from "@/lib/server/static-osm-cells";

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

  return streamOsmStaticCell(namespace, parsedRow, parsedCol);
};
