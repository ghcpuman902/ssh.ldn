import { execFile } from "node:child_process"
import { promisify } from "node:util"

import type { OsmGridCell } from "@/lib/map/osm-grid"
import { osmGridCellKey } from "@/lib/map/osm-grid"
import { withOsmDiskCache } from "@/lib/server/osm-cache"

const execFileAsync = promisify(execFile)

type OverpassElement = {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const AMENITY_FILTER =
  "^(pub|bar|nightclub|music_venue|hospital)$"

const buildNightlifeBboxQuery = ({
  south,
  west,
  north,
  east,
}: {
  south: number
  west: number
  north: number
  east: number
}) => `[out:json][timeout:60];
(
  nwr(${south},${west},${north},${east})["amenity"~"${AMENITY_FILTER}"];
  nwr(${south},${west},${north},${east})["amenity"~"^(pub|bar)$"]["live_music"="yes"];
);
out center tags;`

const buildNightlifeRadiusQuery = (
  lat: number,
  lng: number,
  radiusMeters: number
) => `[out:json][timeout:60];
(
  nwr(around:${radiusMeters},${lat},${lng})["amenity"~"${AMENITY_FILTER}"];
  nwr(around:${radiusMeters},${lat},${lng})["amenity"~"^(pub|bar)$"]["live_music"="yes"];
);
out center tags;`

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
] as const

const fetchOverpass = async (query: string) => {
  let lastError: Error | null = null

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "-sS",
          "-G",
          endpoint,
          "--data-urlencode",
          `data=${query}`,
          "-H",
          "User-Agent: ssh.ldn-map/1.0",
          "-H",
          "Accept: application/json",
          "--max-time",
          "60",
        ],
        { maxBuffer: 20 * 1024 * 1024 }
      )

      return JSON.parse(stdout) as { elements?: OverpassElement[] }
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Overpass request failed")
    }
  }

  throw lastError ?? new Error("Overpass request failed")
}

const getElementLatLng = (element: OverpassElement) => {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { latitude: element.lat, longitude: element.lon }
  }

  if (element.center) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    }
  }

  return null
}

const elementsToFeatureCollection = (
  elements: OverpassElement[] | undefined,
  meta: Record<string, unknown>
) => {
  const seen = new Set<string>()
  const features = (elements ?? [])
    .map((element) => {
      const coordinates = getElementLatLng(element)
      if (!coordinates) {
        return null
      }

      const featureId = `${element.type}/${element.id}`
      if (seen.has(featureId)) {
        return null
      }
      seen.add(featureId)

      const amenity = element.tags?.amenity ?? null
      const liveMusic = element.tags?.live_music === "yes"

      return {
        type: "Feature" as const,
        id: element.id,
        properties: {
          featureId,
          name: element.tags?.name ?? null,
          amenity,
          openingHours: element.tags?.opening_hours ?? null,
          liveMusic,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [coordinates.longitude, coordinates.latitude] as [
            number,
            number,
          ],
        },
      }
    })
    .filter(
      (feature): feature is NonNullable<typeof feature> => feature !== null
    )

  return {
    type: "FeatureCollection" as const,
    features,
    meta: {
      source: "osm-overpass",
      filter: "pub|bar|nightclub|music_venue|hospital|live_music=yes",
      featureCount: features.length,
      retrievedAt: new Date().toISOString(),
      ...meta,
    },
  }
}

export type OsmNightlifeInput = {
  lat: number
  lng: number
  radiusMeters?: number
}

export type OsmNightlifeBboxInput = {
  west: number
  south: number
  east: number
  north: number
}

export const getNightlifeGeoJsonForCell = async (cell: OsmGridCell) =>
  withOsmDiskCache(
    "nightlife",
    [
      "v3-grid-bbox",
      osmGridCellKey(cell.row, cell.col),
      cell.west.toFixed(4),
      cell.south.toFixed(4),
    ],
    () => fetchNightlifeGeoJsonForBbox(cell)
  )

export const getNightlifeGeoJsonForBbox = async (bbox: OsmNightlifeBboxInput) =>
  withOsmDiskCache(
    "nightlife",
    [
      "v3-adhoc-bbox",
      bbox.west.toFixed(4),
      bbox.south.toFixed(4),
      bbox.east.toFixed(4),
      bbox.north.toFixed(4),
    ],
    () => fetchNightlifeGeoJsonForBbox(bbox)
  )

export const getNightlifeGeoJson = async ({
  lat,
  lng,
  radiusMeters = 8_000,
}: OsmNightlifeInput) =>
  withOsmDiskCache(
    "nightlife",
    ["v2-local-noise-sources", lat.toFixed(3), lng.toFixed(3), radiusMeters],
    () => fetchNightlifeGeoJson({ lat, lng, radiusMeters })
  )

const fetchNightlifeGeoJsonForBbox = async ({
  west,
  south,
  east,
  north,
}: OsmNightlifeBboxInput) => {
  const query = buildNightlifeBboxQuery({ south, west, north, east })
  const payload = await fetchOverpass(query)

  return elementsToFeatureCollection(payload.elements, {
    query: "bbox",
    bbox: { west, south, east, north },
  })
}

const fetchNightlifeGeoJson = async ({
  lat,
  lng,
  radiusMeters = 8_000,
}: OsmNightlifeInput) => {
  const query = buildNightlifeRadiusQuery(lat, lng, radiusMeters)
  const payload = await fetchOverpass(query)

  return elementsToFeatureCollection(payload.elements, {
    query: "radius",
    radiusMeters,
    center: { lat, lng },
  })
}
