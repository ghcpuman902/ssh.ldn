"use client"

import { useMemo, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import type {
  GreenSpaceFeatureCollection,
  RailLineFeatureCollection,
  RailStationFeatureCollection,
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types"
import type { VisualLayerVisibility } from "@/lib/map/visual-layers"
import {
  useStaticGeoJson,
  useViewportOsmGeoJson,
} from "@/hooks/use-viewport-osm-geojson"

type TransitGeometryBundle = {
  lines: TubeLineFeatureCollection
  stations: TubeStationFeatureCollection
}

export type VisualLayerData = {
  railLines: RailLineFeatureCollection | null
  railStations: RailStationFeatureCollection | null
  tubeLines: TubeLineFeatureCollection | null
  tubeStations: TubeStationFeatureCollection | null
  overgroundLines: TubeLineFeatureCollection | null
  overgroundStations: TubeStationFeatureCollection | null
  elizabethLines: TubeLineFeatureCollection | null
  elizabethStations: TubeStationFeatureCollection | null
  greenSpaces: GreenSpaceFeatureCollection | null
}

export const useVisualLayerData = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean,
  visibility: VisualLayerVisibility,
): VisualLayerData => {
  const railLines = useViewportOsmGeoJson<RailLineFeatureCollection>({
    mapRef,
    enabled: enabled && visibility.rail,
    buildUrl: (row, col) =>
      `/api/discovery/osm/rail-visual?row=${row}&col=${col}&layer=lines`,
    getFeatureId: (feature) => String(feature.id ?? feature.properties.name),
  })

  const railStations = useViewportOsmGeoJson<RailStationFeatureCollection>({
    mapRef,
    enabled: enabled && visibility.rail,
    buildUrl: (row, col) =>
      `/api/discovery/osm/rail-visual?row=${row}&col=${col}&layer=stations`,
    getFeatureId: (feature) => feature.properties.featureId,
  })

  const greenSpaces = useViewportOsmGeoJson<GreenSpaceFeatureCollection>({
    mapRef,
    enabled: enabled && visibility.greenSpaces,
    buildUrl: (row, col) =>
      `/api/discovery/osm/green-spaces?row=${row}&col=${col}`,
    getFeatureId: (feature) => feature.properties.featureId,
  })

  const tubeGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/tube-geometry",
    enabled,
  )

  const overgroundGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/overground-geometry",
    enabled,
  )

  const elizabethGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/elizabeth-geometry",
    enabled,
  )

  return useMemo(
    () => ({
      railLines,
      railStations,
      tubeLines: visibility.tube ? (tubeGeometry?.lines ?? null) : null,
      tubeStations: visibility.tube ? (tubeGeometry?.stations ?? null) : null,
      overgroundLines: visibility.overground
        ? (overgroundGeometry?.lines ?? null)
        : null,
      overgroundStations: visibility.overground
        ? (overgroundGeometry?.stations ?? null)
        : null,
      elizabethLines: visibility.elizabeth
        ? (elizabethGeometry?.lines ?? null)
        : null,
      elizabethStations: visibility.elizabeth
        ? (elizabethGeometry?.stations ?? null)
        : null,
      greenSpaces,
    }),
    [
      elizabethGeometry,
      greenSpaces,
      overgroundGeometry,
      railLines,
      railStations,
      tubeGeometry,
      visibility.elizabeth,
      visibility.overground,
      visibility.tube,
    ],
  )
}
