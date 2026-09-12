"use client"

import { useMemo } from "react"
import type { ExpressionSpecification } from "maplibre-gl"
import { Layer, Source } from "react-map-gl/maplibre"

import type { VisualLayerData } from "@/hooks/use-visual-layer-data"
import {
  BASEMAP_LABELS_LAYER_ID,
  BASEMAP_TEXT_FONT,
  RAIL_UNDERLAY_SLOT_ID,
  STATION_OVERLAY_SLOT_ID,
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

type TransitModeOverlay = {
  idPrefix: string
  visible: boolean
  lines: TubeLineFeatureCollection | null
  stations: TubeStationFeatureCollection | null
}

const TransitLineLayers = ({
  idPrefix,
  visible,
  theme,
  lines,
}: {
  idPrefix: string
  visible: boolean
  theme: MapTheme
  lines: TubeLineFeatureCollection
}) => {
  const paintedLines = useMemo(
    () => mixTransitLineColors(lines, theme),
    [lines, theme]
  )

  if (paintedLines.features.length === 0) return null

  return (
    <Source id={`${idPrefix}-lines`} type="geojson" data={paintedLines}>
      <Layer
        id={`${idPrefix}-lines-casing`}
        type="line"
        beforeId={STATION_OVERLAY_SLOT_ID}
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
        beforeId={STATION_OVERLAY_SLOT_ID}
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
  )
}

const TransitStationLayers = ({
  idPrefix,
  visible,
  theme,
  stations,
}: {
  idPrefix: string
  visible: boolean
  theme: MapTheme
  stations: TubeStationFeatureCollection
}) => {
  if (stations.features.length === 0) return null

  return (
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
          "circle-pitch-alignment": "map",
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
          "text-font": [...BASEMAP_TEXT_FONT],
          "text-size": TRANSIT_LABEL_SIZE,
          "text-radial-offset": 0.55,
          "text-variable-anchor": ["bottom", "top", "left", "right"],
          "text-max-width": 8,
          "text-allow-overlap": false,
          "text-optional": true,
          "text-padding": 1,
        }}
        paint={{
          "text-color": theme === "dark" ? "#f4f4f5" : "#111827",
          "text-halo-color": theme === "dark" ? "#18181b" : "#ffffff",
          "text-halo-width": 1.6,
        }}
      />
    </Source>
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

  const overlays: TransitModeOverlay[] = [
    {
      idPrefix: "tube",
      visible: visibility.tube,
      lines: data.tubeLines,
      stations: data.tubeStations,
    },
    {
      idPrefix: "overground",
      visible: visibility.overground,
      lines: data.overgroundLines,
      stations: data.overgroundStations,
    },
    {
      idPrefix: "elizabeth",
      visible: visibility.elizabeth,
      lines: data.elizabethLines,
      stations: data.elizabethStations,
    },
    {
      idPrefix: "dlr",
      visible: visibility.dlr,
      lines: data.dlrLines,
      stations: data.dlrStations,
    },
    {
      idPrefix: "tram",
      visible: visibility.tram,
      lines: data.tramLines,
      stations: data.tramStations,
    },
  ]

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

      {overlays.map((overlay) =>
        overlay.visible && overlay.lines ? (
          <TransitLineLayers
            key={`${overlay.idPrefix}-lines`}
            idPrefix={overlay.idPrefix}
            visible={overlay.visible}
            theme={theme}
            lines={overlay.lines}
          />
        ) : null
      )}

      {overlays.map((overlay) =>
        overlay.visible && overlay.stations ? (
          <TransitStationLayers
            key={`${overlay.idPrefix}-stations`}
            idPrefix={overlay.idPrefix}
            visible={overlay.visible}
            theme={theme}
            stations={overlay.stations}
          />
        ) : null
      )}
    </>
  )
}
