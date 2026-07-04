import { type NextRequest } from "next/server";

import { parseLatLng } from "@/lib/server/geo";
import { getNearbyPlanningApplications } from "@/lib/server/planning";

export const GET = async (request: NextRequest) => {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusMeters = Number(
    request.nextUrl.searchParams.get("radiusMeters") ?? 300
  );
  const parsed = parseLatLng(lat, lng);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const data = await getNearbyPlanningApplications({
      lat: parsed.lat,
      lng: parsed.lng,
      radiusMeters,
    });
    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Planning lookup failed",
      },
      { status: 502 }
    );
  }
};
