import { type NextRequest } from "next/server"

import { createShareCardImage } from "@/lib/map/share-card-image"
import { parseShareCardSearchParams } from "@/lib/map/share-card"

export const GET = async (request: NextRequest) => {
  const card = parseShareCardSearchParams({
    address: request.nextUrl.searchParams.get("address") ?? undefined,
    lat: request.nextUrl.searchParams.get("lat") ?? undefined,
    lng: request.nextUrl.searchParams.get("lng") ?? undefined,
    score: request.nextUrl.searchParams.get("score") ?? undefined,
  })

  if (!card) {
    return new Response("Address, lat, and lng are required", { status: 400 })
  }

  return createShareCardImage(card)
}
