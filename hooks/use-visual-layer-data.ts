"use client"

import { useEffect, useMemo, useState, type RefObject } from "react"
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
  dlrLines: TubeLineFeatureCollection | null
  dlrStations: TubeStationFeatureCollection | null
  tramLines: TubeLineFeatureCollection | null
  tramStations: TubeStationFeatureCollection | null
  greenSpaces: GreenSpaceFeatureCollection | null
}

const TRANSIT_PREFETCH_STAGGER_MS = 450

const buildRailLinesUrl = (row: number, col: number) =>
  `/api/discovery/osm/rail-visual?row=${row}&col=${col}&layer=lines`

const buildRailStationsUrl = (row: number, col: number) =>
  `/api/discovery/osm/rail-visual?row=${row}&col=${col}&layer=stations`

const buildGreenSpacesUrl = (row: number, col: number) =>
  `/api/discovery/osm/green-spaces?row=${row}&col=${col}`

const getRailLineFeatureId = (
  feature: RailLineFeatureCollection["features"][number]
) => String(feature.id ?? feature.properties.name)

const getRailStationFeatureId = (
  feature: RailStationFeatureCollection["features"][number]
) => feature.properties.featureId

const getGreenSpaceFeatureId = (
  feature: GreenSpaceFeatureCollection["features"][number]
) => feature.properties.featureId

/**
 * Visual layers are hidden by default. Once `backgroundPrefetch` turns on
 * (quiet-gated in MapShell after nightlife settles), data warms in the
 * background so toggles render quickly. Transit geometry URLs are staggered
 * so they do not all hit the network at once.
 */
export const useVisualLayerData = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean,
  visibility: VisualLayerVisibility,
  backgroundPrefetch: boolean,
): VisualLayerData => {
  /** 0 = none; 1..5 unlock tube → overground → elizabeth → dlr → tram prefetch. */
  const [transitPrefetchSlot, setTransitPrefetchSlot] = useState(0)

  useEffect(() => {
    if (!backgroundPrefetch) {
      setTransitPrefetchSlot(0)
      return
    }

    setTransitPrefetchSlot(1)
    const timers = [2, 3, 4, 5].map((slot, index) =>
      window.setTimeout(
        () => setTransitPrefetchSlot(slot),
        (index + 1) * TRANSIT_PREFETCH_STAGGER_MS
      )
    )

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [backgroundPrefetch])

  const railLines = useViewportOsmGeoJson<RailLineFeatureCollection>({
    mapRef,
    enabled: enabled && (visibility.rail || backgroundPrefetch),
    buildUrl: buildRailLinesUrl,
    getFeatureId: getRailLineFeatureId,
  })

  const railStations = useViewportOsmGeoJson<RailStationFeatureCollection>({
    mapRef,
    enabled: enabled && (visibility.rail || backgroundPrefetch),
    buildUrl: buildRailStationsUrl,
    getFeatureId: getRailStationFeatureId,
  })

  const greenSpaces = useViewportOsmGeoJson<GreenSpaceFeatureCollection>({
    mapRef,
    enabled: enabled && (visibility.greenSpaces || backgroundPrefetch),
    buildUrl: buildGreenSpacesUrl,
    getFeatureId: getGreenSpaceFeatureId,
  })

  const tubeGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/tube-geometry",
    enabled && (visibility.tube || transitPrefetchSlot >= 1),
  )

  const overgroundGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/overground-geometry",
    enabled && (visibility.overground || transitPrefetchSlot >= 2),
  )

  const elizabethGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/elizabeth-geometry",
    enabled && (visibility.elizabeth || transitPrefetchSlot >= 3),
  )

  const dlrGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/dlr-geometry",
    enabled && (visibility.dlr || transitPrefetchSlot >= 4),
  )

  const tramGeometry = useStaticGeoJson<TransitGeometryBundle>(
    "/api/map/tram-geometry",
    enabled && (visibility.tram || transitPrefetchSlot >= 5),
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
      dlrLines: visibility.dlr ? (dlrGeometry?.lines ?? null) : null,
      dlrStations: visibility.dlr ? (dlrGeometry?.stations ?? null) : null,
      tramLines: visibility.tram ? (tramGeometry?.lines ?? null) : null,
      tramStations: visibility.tram ? (tramGeometry?.stations ?? null) : null,
      greenSpaces,
    }),
    [
      dlrGeometry,
      elizabethGeometry,
      greenSpaces,
      overgroundGeometry,
      railLines,
      railStations,
      tramGeometry,
      tubeGeometry,
      visibility.dlr,
      visibility.elizabeth,
      visibility.overground,
      visibility.tram,
      visibility.tube,
    ],
  )
}
