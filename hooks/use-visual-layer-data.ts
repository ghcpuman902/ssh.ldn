"use client"

import { useEffect, useMemo, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import type {
  GreenSpaceFeatureCollection,
  RailLineFeatureCollection,
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types"
import { withTransitGeometryCache } from "@/lib/map/transit-geometry-cache"
import type { VisualLayerVisibility } from "@/lib/map/visual-layers"
import { isStationSketchLines } from "@/lib/map/transit-sketch"
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

const PREVIEW_STAGGER_MS = 140
const FULL_STAGGER_MS = 380

const TRANSIT_PREVIEW_URLS = {
  tube: withTransitGeometryCache("/api/map/tube-geometry?lod=preview"),
  overground: withTransitGeometryCache(
    "/api/map/overground-geometry?lod=preview"
  ),
  elizabeth: withTransitGeometryCache(
    "/api/map/elizabeth-geometry?lod=preview"
  ),
  dlr: withTransitGeometryCache("/api/map/dlr-geometry?lod=preview"),
  tram: withTransitGeometryCache("/api/map/tram-geometry?lod=preview"),
} as const

const TRANSIT_FULL_URLS = {
  tube: withTransitGeometryCache("/api/map/tube-geometry"),
  overground: withTransitGeometryCache("/api/map/overground-geometry"),
  elizabeth: withTransitGeometryCache("/api/map/elizabeth-geometry"),
  dlr: withTransitGeometryCache("/api/map/dlr-geometry"),
  tram: withTransitGeometryCache("/api/map/tram-geometry"),
} as const

const buildRailLinesUrl = (row: number, col: number) =>
  `/api/discovery/osm/rail-visual?row=${row}&col=${col}&layer=lines`

const buildGreenSpacesUrl = (row: number, col: number) =>
  `/api/discovery/osm/green-spaces?row=${row}&col=${col}`

const getRailLineFeatureId = (
  feature: RailLineFeatureCollection["features"][number]
) => String(feature.id ?? feature.properties.name)

const getGreenSpaceFeatureId = (
  feature: GreenSpaceFeatureCollection["features"][number]
) => feature.properties.featureId

const pickTransitLayer = (
  preview: TransitGeometryBundle | null,
  full: TransitGeometryBundle | null,
  visible: boolean
) => {
  if (!visible) {
    return { lines: null, stations: null }
  }

  return {
    lines:
      full?.lines ??
      (isStationSketchLines(preview?.lines) ? null : (preview?.lines ?? null)),
    stations: full?.stations ?? preview?.stations ?? null,
  }
}

type UseVisualLayerDataOptions = {
  backgroundPrefetch: boolean
  lineUpgrade: boolean
}

/**
 * First view fetches station dots + one low-poly spine per line.
 * Higher-res unique-track geometry replaces it after `lineUpgrade`.
 */
export const useVisualLayerData = (
  mapRef: RefObject<MapRef | null>,
  enabled: boolean,
  visibility: VisualLayerVisibility,
  { backgroundPrefetch, lineUpgrade }: UseVisualLayerDataOptions
): VisualLayerData => {
  const [previewSlot, setPreviewSlot] = useState(0)
  const [fullSlot, setFullSlot] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setPreviewSlot(0)
      return
    }

    setPreviewSlot(1)
    const timers = [2, 3, 4, 5].map((slot, index) =>
      window.setTimeout(
        () => setPreviewSlot(slot),
        (index + 1) * PREVIEW_STAGGER_MS
      )
    )

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [enabled])

  useEffect(() => {
    if (!lineUpgrade) {
      setFullSlot(0)
      return
    }

    setFullSlot(1)
    const timers = [2, 3, 4, 5].map((slot, index) =>
      window.setTimeout(() => setFullSlot(slot), (index + 1) * FULL_STAGGER_MS)
    )

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [lineUpgrade])

  const deferOsmCells = enabled && (lineUpgrade || backgroundPrefetch)

  const railLines = useViewportOsmGeoJson<RailLineFeatureCollection>({
    mapRef,
    enabled: deferOsmCells,
    buildUrl: buildRailLinesUrl,
    getFeatureId: getRailLineFeatureId,
  })

  const greenSpaces = useViewportOsmGeoJson<GreenSpaceFeatureCollection>({
    mapRef,
    enabled: deferOsmCells && (visibility.greenSpaces || backgroundPrefetch),
    buildUrl: buildGreenSpacesUrl,
    getFeatureId: getGreenSpaceFeatureId,
  })

  const tubePreview = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_PREVIEW_URLS.tube,
    enabled && previewSlot >= 1 && (visibility.tube || backgroundPrefetch),
    "high"
  )
  const overgroundPreview = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_PREVIEW_URLS.overground,
    enabled && previewSlot >= 2 && (visibility.overground || backgroundPrefetch)
  )
  const elizabethPreview = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_PREVIEW_URLS.elizabeth,
    enabled && previewSlot >= 3 && (visibility.elizabeth || backgroundPrefetch)
  )
  const dlrPreview = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_PREVIEW_URLS.dlr,
    enabled && previewSlot >= 4 && (visibility.dlr || backgroundPrefetch)
  )
  const tramPreview = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_PREVIEW_URLS.tram,
    enabled && previewSlot >= 5 && (visibility.tram || backgroundPrefetch)
  )

  const tubeFull = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_FULL_URLS.tube,
    enabled &&
      lineUpgrade &&
      fullSlot >= 1 &&
      (visibility.tube || backgroundPrefetch),
    "low"
  )
  const overgroundFull = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_FULL_URLS.overground,
    enabled &&
      lineUpgrade &&
      fullSlot >= 2 &&
      (visibility.overground || backgroundPrefetch),
    "low"
  )
  const elizabethFull = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_FULL_URLS.elizabeth,
    enabled &&
      lineUpgrade &&
      fullSlot >= 3 &&
      (visibility.elizabeth || backgroundPrefetch),
    "low"
  )
  const dlrFull = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_FULL_URLS.dlr,
    enabled &&
      lineUpgrade &&
      fullSlot >= 4 &&
      (visibility.dlr || backgroundPrefetch),
    "low"
  )
  const tramFull = useStaticGeoJson<TransitGeometryBundle>(
    TRANSIT_FULL_URLS.tram,
    enabled &&
      lineUpgrade &&
      fullSlot >= 5 &&
      (visibility.tram || backgroundPrefetch),
    "low"
  )

  const tube = pickTransitLayer(tubePreview, tubeFull, visibility.tube)
  const overground = pickTransitLayer(
    overgroundPreview,
    overgroundFull,
    visibility.overground
  )
  const elizabeth = pickTransitLayer(
    elizabethPreview,
    elizabethFull,
    visibility.elizabeth
  )
  const dlr = pickTransitLayer(dlrPreview, dlrFull, visibility.dlr)
  const tram = pickTransitLayer(tramPreview, tramFull, visibility.tram)

  return useMemo(
    () => ({
      railLines,
      tubeLines: tube.lines,
      tubeStations: tube.stations,
      overgroundLines: overground.lines,
      overgroundStations: overground.stations,
      elizabethLines: elizabeth.lines,
      elizabethStations: elizabeth.stations,
      dlrLines: dlr.lines,
      dlrStations: dlr.stations,
      tramLines: tram.lines,
      tramStations: tram.stations,
      greenSpaces,
    }),
    [
      dlr.lines,
      dlr.stations,
      elizabeth.lines,
      elizabeth.stations,
      greenSpaces,
      overground.lines,
      overground.stations,
      railLines,
      tram.lines,
      tram.stations,
      tube.lines,
      tube.stations,
    ]
  )
}
