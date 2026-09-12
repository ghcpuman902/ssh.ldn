import type {
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types"

type CoordPair = [number, number]

/** TfL dots can sit 100m+ off the OSM centreline; keep a little slack. */
const MAX_SNAP_METERS = 280

const toMeters = (from: CoordPair, to: CoordPair) => {
  const latitudeScale = 111_320
  const longitudeScale =
    111_320 * Math.cos((from[1] * Math.PI) / 180)

  return Math.hypot(
    (to[0] - from[0]) * longitudeScale,
    (to[1] - from[1]) * latitudeScale
  )
}

const nearestPointOnSegment = (
  point: CoordPair,
  start: CoordPair,
  end: CoordPair
): CoordPair => {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared < 1e-16) return start

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared
    )
  )

  return [start[0] + dx * t, start[1] + dy * t]
}

const nearestPointOnLine = (
  point: CoordPair,
  coordinates: CoordPair[]
): { point: CoordPair; meters: number } | null => {
  if (coordinates.length < 2) return null

  let bestPoint = coordinates[0]
  let bestMeters = toMeters(point, bestPoint)

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const candidate = nearestPointOnSegment(
      point,
      coordinates[index],
      coordinates[index + 1]
    )
    const meters = toMeters(point, candidate)
    if (meters < bestMeters) {
      bestMeters = meters
      bestPoint = candidate
    }
  }

  return { point: bestPoint, meters: bestMeters }
}

/**
 * Move station dots onto OSM track geometry so they sit on the painted line
 * instead of TfL stop coordinates (often the street entrance).
 */
export const snapStationsToLines = (
  stations: TubeStationFeatureCollection,
  lines: TubeLineFeatureCollection
): TubeStationFeatureCollection => {
  if (stations.features.length === 0 || lines.features.length === 0) {
    return stations
  }

  const linesById = new Map<string, TubeLineFeatureCollection["features"]>()

  for (const line of lines.features) {
    const bucket = linesById.get(line.properties.lineId) ?? []
    bucket.push(line)
    linesById.set(line.properties.lineId, bucket)
  }

  let snappedCount = 0
  const features = stations.features.map((station) => {
    const point = station.geometry.coordinates
    const candidateLines = station.properties.lineIds.flatMap(
      (lineId) => linesById.get(lineId) ?? []
    )
    const searchLines =
      candidateLines.length > 0 ? candidateLines : lines.features

    let best: { point: CoordPair; meters: number } | null = null

    for (const line of searchLines) {
      const nearest = nearestPointOnLine(point, line.geometry.coordinates)
      if (!nearest) continue
      if (!best || nearest.meters < best.meters) {
        best = nearest
      }
    }

    if (!best || best.meters > MAX_SNAP_METERS) return station

    snappedCount += 1

    return {
      ...station,
      geometry: {
        ...station.geometry,
        coordinates: best.point,
      },
    }
  })

  return {
    ...stations,
    features,
    meta: stations.meta
      ? {
          ...stations.meta,
          coordinateSource: "osm-line-snap",
          osmLineSnapCount: snappedCount,
        }
      : undefined,
  }
}
