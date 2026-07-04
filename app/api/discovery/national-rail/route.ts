import { type NextRequest } from "next/server";

import { parseLatLng } from "@/lib/server/geo";
import { getNationalRailContext } from "@/lib/server/national-rail";

export const GET = async (request: NextRequest) => {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusMeters = Number(
    request.nextUrl.searchParams.get("radiusMeters") ?? 500
  );
  const parsed = parseLatLng(lat, lng);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const data = await getNationalRailContext({
    lat: parsed.lat,
    lng: parsed.lng,
    radiusMeters,
  });

  return Response.json(data);
};
