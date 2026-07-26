import { type NextRequest } from "next/server"

import { LONDON_BBOX } from "@/lib/map/config"
import { osmGridCellBbox } from "@/lib/map/osm-grid"
import { parseLatLng } from "@/lib/server/geo"
import { osmCellCacheHeaders } from "@/lib/server/http-cache"
import {
  getNightlifeGeoJson,
  getNightlifeGeoJsonForBbox,
  getNightlifeGeoJsonForCell,
} from "@/lib/server/osm-nightlife"

const NIGHTLIFE_HEADERS = osmCellCacheHeaders("nightlife")

const parseBbox = (request: NextRequest) => {
  const westParam = request.nextUrl.searchParams.get("west")
  const southParam = request.nextUrl.searchParams.get("south")
  const eastParam = request.nextUrl.searchParams.get("east")
  const northParam = request.nextUrl.searchParams.get("north")

  if (
    westParam === null ||
    southParam === null ||
    eastParam === null ||
    northParam === null
  ) {
    return null
  }

  const west = Number(westParam)
  const south = Number(southParam)
  const east = Number(eastParam)
  const north = Number(northParam)

  if (![west, south, east, north].every(Number.isFinite)) {
    return { ok: false as const, error: "bbox params must be numbers" }
  }

  if (west >= east || south >= north) {
    return { ok: false as const, error: "Invalid bbox: west/east or south/north" }
  }

  if (
    west < LONDON_BBOX.west ||
    east > LONDON_BBOX.east ||
    south < LONDON_BBOX.south ||
    north > LONDON_BBOX.north
  ) {
    return { ok: false as const, error: "bbox must stay within Greater London bounds" }
  }

  return { ok: true as const, west, south, east, north }
}

export const GET = async (request: NextRequest) => {
  const row = request.nextUrl.searchParams.get("row")
  const col = request.nextUrl.searchParams.get("col")

  if (row !== null && col !== null) {
    const parsedRow = Number(row)
    const parsedCol = Number(col)

    if (!Number.isInteger(parsedRow) || !Number.isInteger(parsedCol)) {
      return Response.json({ error: "row and col must be integers" }, { status: 400 })
    }

    try {
      const cell = osmGridCellBbox(parsedRow, parsedCol)
      const geojson = await getNightlifeGeoJsonForCell(cell)
      return Response.json(geojson, { headers: NIGHTLIFE_HEADERS })
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "OSM local noise grid lookup failed",
        },
        { status: 502 }
      )
    }
  }

  const bbox = parseBbox(request)
  if (bbox && !bbox.ok) {
    return Response.json({ error: bbox.error }, { status: 400 })
  }

  if (bbox?.ok) {
    try {
      const geojson = await getNightlifeGeoJsonForBbox({
        west: bbox.west,
        south: bbox.south,
        east: bbox.east,
        north: bbox.north,
      })
      return Response.json(geojson, { headers: NIGHTLIFE_HEADERS })
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "OSM local noise bbox lookup failed",
        },
        { status: 502 }
      )
    }
  }

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
    return Response.json(geojson, { headers: NIGHTLIFE_HEADERS })
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
