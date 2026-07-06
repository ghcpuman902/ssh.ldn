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

type TubeGeometryBundle = {
  lines: TubeLineFeatureCollection
  stations: TubeStationFeatureCollection
}

export type VisualLayerData = {
  railLines: RailLineFeatureCollection | null
  railStations: RailStationFeatureCollection | null
  tubeLines: TubeLineFeatureCollection | null
  tubeStations: TubeStationFeatureCollection | null
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

  const tubeGeometry = useStaticGeoJson<TubeGeometryBundle>(
    "/api/map/tube-geometry",
    enabled,
  )

  return useMemo(
    () => ({
      railLines,
      railStations,
      tubeLines: visibility.tube ? (tubeGeometry?.lines ?? null) : null,
      tubeStations: visibility.tube ? (tubeGeometry?.stations ?? null) : null,
      greenSpaces,
    }),
    [greenSpaces, railLines, railStations, tubeGeometry, visibility.tube],
  )
}
