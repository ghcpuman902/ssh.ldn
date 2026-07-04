import { type NextRequest } from "next/server";

import { getOpenWeatherCurrent } from "@/lib/server/openweather";

export const GET = async (request: NextRequest) => {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);

  if (
    latParam === null ||
    lngParam === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return Response.json(
      { error: "lat and lng are required numbers" },
      { status: 400 }
    );
  }

  try {
    const data = await getOpenWeatherCurrent({ lat, lng });
    return Response.json(data);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenWeather current request failed";

    const status = message.includes("OPENWEATHER_API_KEY") ? 503 : 502;

    return Response.json({ error: message }, { status });
  }
};
