import { defaultLineColor } from "@/lib/map/visual-layers"
import {
  dedupeConsecutiveCoords,
  stripStationLabel,
} from "@/lib/map/tube-line-paths"
import type {
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types"

type CoordPair = [number, number]

export const STATION_SKETCH_SOURCE = "tfl-station-sketch"

export type SketchStop = {
  id?: string
  name?: string
  lat?: number
  lon?: number
  zone?: string
}

export type SketchSequence = {
  lineId: string
  lineName?: string
  stations: SketchStop[]
}

const isPlottableStop = (
  stop: SketchStop
): stop is SketchStop & { lat: number; lon: number } =>
  typeof stop.lat === "number" && typeof stop.lon === "number"

/**
 * Straight station-to-station polylines — the low-res first paint for transit.
 * Full track-following geometry replaces this after the map has idled.
 */
export const buildTransitSketchFromSequences = (
  sequences: SketchSequence[],
  retrievedAt: string
): {
  lines: TubeLineFeatureCollection
  stations: TubeStationFeatureCollection
} => {
  const stationMap = new Map<
    string,
    TubeStationFeatureCollection["features"][number]
  >()
  const lineFeatures: TubeLineFeatureCollection["features"] = []

  for (const sequence of sequences) {
    const color = defaultLineColor(sequence.lineId)
    const lineName = sequence.lineName ?? sequence.lineId
    const sketchCoords: CoordPair[] = []

    for (const stop of sequence.stations) {
      if (!isPlottableStop(stop)) continue

      sketchCoords.push([stop.lon, stop.lat])

      if (!stop.id) continue

      const existing = stationMap.get(stop.id)
      if (existing) {
        if (!existing.properties.lineIds.includes(sequence.lineId)) {
          existing.properties.lineIds.push(sequence.lineId)
        }
        if (stop.zone) {
          existing.properties.zone = stop.zone
        }
        continue
      }

      stationMap.set(stop.id, {
        type: "Feature",
        id: stop.id,
        properties: {
          featureId: stop.id,
          name: stop.name ?? null,
          label: stripStationLabel(stop.name),
          lineIds: [sequence.lineId],
          zone: stop.zone ?? null,
        },
        geometry: {
          type: "Point",
          coordinates: [stop.lon, stop.lat],
        },
      })
    }

    const coordinates = dedupeConsecutiveCoords(sketchCoords)
    if (coordinates.length < 2) continue

    lineFeatures.push({
      type: "Feature",
      id: `${sequence.lineId}-sketch`,
      properties: {
        featureId: `${sequence.lineId}-sketch`,
        lineId: sequence.lineId,
        lineName,
        color,
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    })
  }

  return {
    lines: {
      type: "FeatureCollection",
      features: lineFeatures,
      meta: {
        source: STATION_SKETCH_SOURCE,
        filter: "Station-to-station polylines from TfL route sequences",
        featureCount: lineFeatures.length,
        retrievedAt,
      },
    },
    stations: {
      type: "FeatureCollection",
      features: [...stationMap.values()],
      meta: {
        source: "tfl-unified-api",
        filter: "Station dots from TfL route sequences",
        featureCount: stationMap.size,
        retrievedAt,
      },
    },
  }
}

export const isStationSketchLines = (
  lines: TubeLineFeatureCollection | null | undefined
) => lines?.meta?.source === STATION_SKETCH_SOURCE

const downsampleLine = (coordinates: CoordPair[], maxPoints: number) => {
  if (coordinates.length <= maxPoints) return coordinates

  const step = (coordinates.length - 1) / (maxPoints - 1)
  const sampled: CoordPair[] = []

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(coordinates[Math.round(index * step)]!)
  }

  return dedupeConsecutiveCoords(sampled)
}

/** Keep the real track shape with far fewer vertices for the first line paint. */
export const simplifyTrackLineCollection = (
  lines: TubeLineFeatureCollection,
  maxPointsPerLine = 48
): TubeLineFeatureCollection => {
  const features = lines.features.map((feature) => ({
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: downsampleLine(feature.geometry.coordinates, maxPointsPerLine),
    },
  }))

  return {
    ...lines,
    features,
    meta: lines.meta
      ? {
          ...lines.meta,
          source: "osm-simplified",
          filter: "Downsampled track-following geometry",
          featureCount: features.length,
        }
      : undefined,
  }
}
