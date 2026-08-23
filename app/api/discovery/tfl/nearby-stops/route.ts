import { type NextRequest } from "next/server"

import { getNearbyTflStops } from "@/lib/server/tfl"

export const GET = async (request: NextRequest) => {
  const lat = Number(request.nextUrl.searchParams.get("lat"))
  const lng = Number(request.nextUrl.searchParams.get("lng"))
  const radiusMeters = Number(
    request.nextUrl.searchParams.get("radiusMeters") ?? 500
  )
  const searchQuery =
    request.nextUrl.searchParams.get("searchQuery") ??
    request.nextUrl.searchParams.get("query") ??
    undefined

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json(
      { error: "lat and lng are required numbers" },
      { status: 400 }
    )
  }

  try {
    const data = await getNearbyTflStops({
      lat,
      lng,
      radiusMeters,
      searchQuery,
    })
    return Response.json(data)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cached transit lookup failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
