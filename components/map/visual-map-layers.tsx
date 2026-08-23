"use client"

import { useMemo } from "react"
import type { ExpressionSpecification } from "maplibre-gl"
import { Layer, Source } from "react-map-gl/maplibre"

import type { VisualLayerData } from "@/hooks/use-visual-layer-data"
import {
  BASEMAP_LABELS_LAYER_ID,
  RAIL_UNDERLAY_SLOT_ID,
  TRANSIT_OVERLAY_SLOT_ID,
} from "@/lib/map/config"
import type { MapTheme } from "@/lib/map/config"
import type {
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types"
import {
  mixTransitLineColors,
  railStrokeColor,
  transitCasingColor,
} from "@/lib/map/line-paint"
import type { VisualLayerVisibility } from "@/lib/map/visual-layers"

const layerVisibility = (visible: boolean): "visible" | "none" =>
  visible ? "visible" : "none"

const TRANSIT_LINE_OFFSET: ExpressionSpecification = [
  "coalesce",
  ["get", "lineOffset"],
  0,
]

const TRANSIT_LINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  2.2,
  14,
  3.8,
  16,
  5,
]

const TRANSIT_INNER_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  1.4,
  14,
  2.6,
  16,
  3.4,
]

const TRANSIT_LABEL_SIZE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  10,
  14,
  11,
  16,
  12,
]

type VisualMapLayersProps = {
  visibility: VisualLayerVisibility
  data: VisualLayerData
  theme: MapTheme
}

type TransitLineOverlayProps = {
  idPrefix: string
  visible: boolean
  theme: MapTheme
  lines: TubeLineFeatureCollection | null
  stations: TubeStationFeatureCollection | null
}

const TransitLineOverlay = ({
  idPrefix,
  visible,
  theme,
  lines,
  stations,
}: TransitLineOverlayProps) => {
  const paintedLines = useMemo(
    () => (lines ? mixTransitLineColors(lines, theme) : null),
    [lines, theme]
  )
  const showLines = visible && (paintedLines?.features.length ?? 0) > 0
  const showStations = visible && (stations?.features.length ?? 0) > 0

  if (!showLines && !showStations) return null

  return (
    <>
      {showLines && paintedLines ? (
        <Source id={`${idPrefix}-lines`} type="geojson" data={paintedLines}>
          <Layer
            id={`${idPrefix}-lines-casing`}
            type="line"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            layout={{
              visibility: layerVisibility(visible),
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-color": transitCasingColor(theme),
              "line-width": TRANSIT_LINE_WIDTH,
              "line-offset": TRANSIT_LINE_OFFSET,
              "line-opacity": 1,
            }}
          />
          <Layer
            id={`${idPrefix}-lines-stroke`}
            type="line"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            layout={{
              visibility: layerVisibility(visible),
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-color": ["coalesce", ["get", "color"], "#6366f1"],
              "line-width": TRANSIT_INNER_WIDTH,
              "line-offset": TRANSIT_LINE_OFFSET,
              "line-opacity": 1,
            }}
          />
        </Source>
      ) : null}

      {showStations && stations ? (
        <Source id={`${idPrefix}-stations`} type="geojson" data={stations}>
          <Layer
            id={`${idPrefix}-stations-circle`}
            type="circle"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            minzoom={10}
            layout={{ visibility: layerVisibility(visible) }}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10,
                2.5,
                14,
                4,
                16,
                5,
              ],
              "circle-color": "#ffffff",
              "circle-stroke-color": "#111827",
              "circle-stroke-width": 1.4,
              "circle-opacity": 1,
            }}
          />
          <Layer
            id={`${idPrefix}-stations-label`}
            type="symbol"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            minzoom={12}
            layout={{
              visibility: layerVisibility(visible),
              "text-field": ["coalesce", ["get", "label"], ["get", "name"], ""],
              "text-size": TRANSIT_LABEL_SIZE,
              "text-offset": [0, 1.15],
              "text-anchor": "top",
              "text-max-width": 8,
              "text-allow-overlap": false,
              "text-optional": true,
              "text-padding": 2,
            }}
            paint={{
              "text-color": theme === "dark" ? "#f4f4f5" : "#111827",
              "text-halo-color": theme === "dark" ? "#18181b" : "#ffffff",
              "text-halo-width": 1.6,
            }}
          />
        </Source>
      ) : null}
    </>
  )
}

export const VisualMapLayers = ({
  visibility,
  data,
  theme,
}: VisualMapLayersProps) => {
  const showRail = (data.railLines?.features.length ?? 0) > 0
  const showGreen =
    visibility.greenSpaces && (data.greenSpaces?.features.length ?? 0) > 0

  return (
    <>
      {showRail && data.railLines ? (
        <Source id="rail-lines" type="geojson" data={data.railLines}>
          <Layer
            id="rail-lines-stroke"
            type="line"
            beforeId={RAIL_UNDERLAY_SLOT_ID}
            layout={{
              visibility: "visible",
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-color": railStrokeColor(theme),
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10,
                1.2,
                14,
                2.4,
                16,
                3.2,
              ],
              "line-opacity": 1,
            }}
          />
        </Source>
      ) : null}

      {showGreen && data.greenSpaces ? (
        <Source id="green-spaces" type="geojson" data={data.greenSpaces}>
          <Layer
            id="green-spaces-fill"
            type="fill"
            beforeId={TRANSIT_OVERLAY_SLOT_ID}
            layout={{ visibility: layerVisibility(visibility.greenSpaces) }}
            paint={{
              "fill-color": "rgba(74, 222, 128, 0.18)",
              "fill-outline-color": "rgba(34, 197, 94, 0.35)",
            }}
          />
        </Source>
      ) : null}

      <TransitLineOverlay
        idPrefix="tube"
        visible={visibility.tube}
        theme={theme}
        lines={data.tubeLines}
        stations={data.tubeStations}
      />

      <TransitLineOverlay
        idPrefix="overground"
        visible={visibility.overground}
        theme={theme}
        lines={data.overgroundLines}
        stations={data.overgroundStations}
      />

      <TransitLineOverlay
        idPrefix="elizabeth"
        visible={visibility.elizabeth}
        theme={theme}
        lines={data.elizabethLines}
        stations={data.elizabethStations}
      />

      <TransitLineOverlay
        idPrefix="dlr"
        visible={visibility.dlr}
        theme={theme}
        lines={data.dlrLines}
        stations={data.dlrStations}
      />

      <TransitLineOverlay
        idPrefix="tram"
        visible={visibility.tram}
        theme={theme}
        lines={data.tramLines}
        stations={data.tramStations}
      />
    </>
  )
}
