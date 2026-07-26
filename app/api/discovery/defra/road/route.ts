import { type NextRequest } from "next/server";

import { getDefraNoiseSample } from "@/lib/server/defra";
import { parseLatLng } from "@/lib/server/geo";
import { defraSampleCacheHeaders } from "@/lib/server/http-cache";

export const GET = async (request: NextRequest) => {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusMeters = Number(
    request.nextUrl.searchParams.get("radiusMeters") ?? 50
  );
  const parsed = parseLatLng(lat, lng);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const data = await getDefraNoiseSample({
      kind: "road",
      lat: parsed.lat,
      lng: parsed.lng,
      radiusMeters,
    });
    return Response.json(data, { headers: defraSampleCacheHeaders() });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "DEFRA road lookup failed",
      },
      { status: 502 }
    );
  }
};
