import { type NextRequest } from "next/server"

import { parseLatLng } from "@/lib/server/geo"
import { getNightlifeGeoJson } from "@/lib/server/osm-nightlife"

export const GET = async (request: NextRequest) => {
  const lat = Number(request.nextUrl.searchParams.get("lat"))
  const lng = Number(request.nextUrl.searchParams.get("lng"))
  const radiusMeters = Number(
    request.nextUrl.searchParams.get("radiusMeters") ?? 8000
  )
  const parsed = parseLatLng(lat, lng)

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters < 100 ||
    radiusMeters > 15000
  ) {
    return Response.json(
      { error: "radiusMeters must be between 100 and 15000" },
      { status: 400 }
    )
  }

  try {
    const geojson = await getNightlifeGeoJson({
      lat: parsed.lat,
      lng: parsed.lng,
      radiusMeters,
    })
    return Response.json(geojson)
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OSM local noise lookup failed",
      },
      { status: 502 }
    )
  }
}
