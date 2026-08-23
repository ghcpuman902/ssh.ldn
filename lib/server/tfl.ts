import { haversineMeters } from "@/lib/server/geo"
import {
  TRANSIT_MODES,
  readTransitGeometryJson,
  type TransitMode,
} from "@/lib/server/static-transit-geometry"

/**
 * Nearby stops and line identity come from committed transit JSON
 * (`data/transit/{mode}/full.json`), the same snapshot TfL-Components keeps
 * on disk. The map never live-fetches StopPoint or line status.
 */

type CachedStation = {
  id: string
  name: string
  label: string | null
  modes: TransitMode[]
  lineIds: string[]
  zone: string | null
  lat: number
  lng: number
}

type CachedLine = {
  id: string
  name: string
  color: string
  mode: TransitMode
}

type TransitCatalog = {
  stations: CachedStation[]
  lines: CachedLine[]
}

let catalogPromise: Promise<TransitCatalog> | null = null

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

const asFeatureCollection = (value: unknown) => {
  const collection = asRecord(value)
  if (collection?.type !== "FeatureCollection") return []
  return Array.isArray(collection.features) ? collection.features : []
}

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

const pointCoordinates = (geometry: unknown): [number, number] | null => {
  const record = asRecord(geometry)
  if (record?.type !== "Point" || !Array.isArray(record.coordinates)) {
    return null
  }
  const lng = record.coordinates[0]
  const lat = record.coordinates[1]
  if (typeof lng !== "number" || typeof lat !== "number") return null
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

const readModeBundle = async (mode: TransitMode) => {
  const bundle = asRecord(await readTransitGeometryJson(mode, "full"))
  return {
    stationFeatures: asFeatureCollection(bundle?.stations),
    lineFeatures: asFeatureCollection(bundle?.lines),
  }
}

const loadCatalog = async (): Promise<TransitCatalog> => {
  const stationsById = new Map<string, CachedStation>()
  const linesByKey = new Map<string, CachedLine>()

  for (const mode of TRANSIT_MODES) {
    const { stationFeatures, lineFeatures } = await readModeBundle(mode)

    for (const feature of stationFeatures) {
      const record = asRecord(feature)
      const properties = asRecord(record?.properties)
      const coords = pointCoordinates(record?.geometry)
      const id = asString(record?.id) ?? asString(properties?.featureId) ?? null
      if (!record || !properties || !coords || !id) continue

      const name = asString(properties.name) ?? asString(properties.label) ?? id
      const existing = stationsById.get(id)
      if (existing) {
        if (!existing.modes.includes(mode)) existing.modes.push(mode)
        for (const lineId of asStringList(properties.lineIds)) {
          if (!existing.lineIds.includes(lineId)) existing.lineIds.push(lineId)
        }
        continue
      }

      stationsById.set(id, {
        id,
        name,
        label: asString(properties.label),
        modes: [mode],
        lineIds: asStringList(properties.lineIds),
        zone: asString(properties.zone),
        lng: coords[0],
        lat: coords[1],
      })
    }

    for (const feature of lineFeatures) {
      const record = asRecord(feature)
      const properties = asRecord(record?.properties)
      const id = asString(properties?.lineId)
      if (!id) continue
      const key = `${mode}:${id}`
      if (linesByKey.has(key)) continue
      linesByKey.set(key, {
        id,
        name: asString(properties?.lineName) ?? id,
        color: asString(properties?.color) ?? "#888888",
        mode,
      })
    }
  }

  return {
    stations: [...stationsById.values()],
    lines: [...linesByKey.values()],
  }
}

const getCatalog = () => {
  catalogPromise ??= loadCatalog()
  return catalogPromise
}

export type NearbyTflStopsInput = {
  lat: number
  lng: number
  radiusMeters?: number
  searchQuery?: string
}

const normalizeName = (value: string) =>
  value.toLowerCase().replace(/['’]/g, "")

export const getNearbyTflStops = async ({
  lat,
  lng,
  radiusMeters = 500,
  searchQuery,
}: NearbyTflStopsInput) => {
  const catalog = await getCatalog()
  const radius =
    Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 500
  const query = searchQuery?.trim() || null
  const needle = query ? normalizeName(query) : null

  const stopPoints = catalog.stations
    .map((station) => ({
      id: station.id,
      name: station.name,
      commonName: station.name,
      label: station.label,
      lat: station.lat,
      lon: station.lng,
      modes: station.modes,
      lineIds: station.lineIds,
      zone: station.zone,
      distanceMeters: Math.round(
        haversineMeters(lat, lng, station.lat, station.lng)
      ),
    }))
    .filter((station) => station.distanceMeters <= radius)
    .filter((station) =>
      needle
        ? normalizeName(station.name).includes(needle) ||
          (station.label
            ? normalizeName(station.label).includes(needle)
            : false)
        : true
    )
    .sort((left, right) => left.distanceMeters - right.distanceMeters)

  return {
    source: "cached-transit-geometry",
    sourceEndpoint: "data/transit/{mode}/full.json stations",
    live: false,
    retrievedAt: new Date().toISOString(),
    radiusMeters: radius,
    searchQuery: query,
    stopPointCount: stopPoints.length,
    stopPoints,
  }
}

export type TflLineStatusInput = {
  lineIds: string[]
}

export const getTflLineStatus = async ({ lineIds }: TflLineStatusInput) => {
  const catalog = await getCatalog()
  const wanted = new Set(lineIds.map((id) => id.trim()).filter(Boolean))
  const lines = catalog.lines
    .filter((line) => wanted.size === 0 || wanted.has(line.id))
    .map((line) => ({
      id: line.id,
      name: line.name,
      color: line.color,
      modeName: line.mode,
      lineStatuses: [],
    }))

  return {
    source: "cached-transit-geometry",
    sourceEndpoint: "data/transit/{mode}/full.json lines",
    live: false,
    note: "Line identity from committed geometry. Live disruption is not fetched.",
    retrievedAt: new Date().toISOString(),
    lineIds,
    lineCount: lines.length,
    lines,
  }
}
