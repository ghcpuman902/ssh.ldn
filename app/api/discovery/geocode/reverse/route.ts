import { type NextRequest } from "next/server";

import { reverseGeocodeCoordinates } from "@/lib/server/geocode";

export const GET = async (request: NextRequest) => {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");

  const latitude = latParam ? Number(latParam) : Number.NaN;
  const longitude = lngParam ? Number(lngParam) : Number.NaN;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Response.json(
      { error: "Provide lat and lng query parameters" },
      { status: 400 }
    );
  }

  try {
    const result = await reverseGeocodeCoordinates({ latitude, longitude });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Reverse geocoding failed unexpectedly";

    return Response.json({ error: message }, { status: 502 });
  }
};
