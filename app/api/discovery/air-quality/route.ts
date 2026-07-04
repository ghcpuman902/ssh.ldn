import { type NextRequest } from "next/server";

import { getNearbyAirQualitySites } from "@/lib/server/air-quality";
import { parseLatLng } from "@/lib/server/geo";

export const GET = async (request: NextRequest) => {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusMeters = Number(
    request.nextUrl.searchParams.get("radiusMeters") ?? 2000
  );
  const parsed = parseLatLng(lat, lng);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const data = await getNearbyAirQualitySites({
      lat: parsed.lat,
      lng: parsed.lng,
      radiusMeters,
    });
    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Air quality lookup failed",
      },
      { status: 502 }
    );
  }
};
