"use client"

import type { ExpressionSpecification } from "maplibre-gl"
import { Layer, Source } from "react-map-gl/maplibre"

import type { VisualLayerData } from "@/hooks/use-visual-layer-data"
import { BASEMAP_LABELS_LAYER_ID } from "@/lib/map/config"
import type { VisualLayerVisibility } from "@/lib/map/visual-layers"

const layerVisibility = (visible: boolean): "visible" | "none" =>
  visible ? "visible" : "none"

const TUBE_LINE_OFFSET: ExpressionSpecification = [
  "coalesce",
  ["get", "lineOffset"],
  0,
]

const TUBE_LINE_WIDTH: ExpressionSpecification = [
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

const TUBE_LABEL_SIZE: ExpressionSpecification = [
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
}

export const VisualMapLayers = ({ visibility, data }: VisualMapLayersProps) => {
  const showRail =
    visibility.rail &&
    ((data.railLines?.features.length ?? 0) > 0 ||
      (data.railStations?.features.length ?? 0) > 0)
  const showTube =
    visibility.tube &&
    ((data.tubeLines?.features.length ?? 0) > 0 ||
      (data.tubeStations?.features.length ?? 0) > 0)
  const showGreen =
    visibility.greenSpaces && (data.greenSpaces?.features.length ?? 0) > 0

  return (
    <>
      {showGreen && data.greenSpaces ? (
        <Source id="green-spaces" type="geojson" data={data.greenSpaces}>
          <Layer
            id="green-spaces-fill"
            type="fill"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            layout={{ visibility: layerVisibility(visibility.greenSpaces) }}
            paint={{
              "fill-color": "rgba(74, 222, 128, 0.18)",
              "fill-outline-color": "rgba(34, 197, 94, 0.35)",
            }}
          />
        </Source>
      ) : null}

      {showRail && data.railLines ? (
        <Source id="rail-lines" type="geojson" data={data.railLines}>
          <Layer
            id="rail-lines-stroke"
            type="line"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            layout={{
              visibility: layerVisibility(visibility.rail),
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-color": "#475569",
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
              "line-opacity": 0.85,
            }}
          />
        </Source>
      ) : null}

      {showRail && data.railStations ? (
        <Source id="rail-stations" type="geojson" data={data.railStations}>
          <Layer
            id="rail-stations-circle"
            type="circle"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            minzoom={11}
            layout={{ visibility: layerVisibility(visibility.rail) }}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                2.5,
                14,
                4,
                16,
                5,
              ],
              "circle-color": "#ffffff",
              "circle-stroke-color": "#475569",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.95,
            }}
          />
        </Source>
      ) : null}

      {showTube && data.tubeLines ? (
        <Source id="tube-lines" type="geojson" data={data.tubeLines}>
          <Layer
            id="tube-lines-casing"
            type="line"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            layout={{
              visibility: layerVisibility(visibility.tube),
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-color": "#ffffff",
              "line-width": TUBE_LINE_WIDTH,
              "line-offset": TUBE_LINE_OFFSET,
              "line-opacity": 0.92,
            }}
          />
          <Layer
            id="tube-lines-stroke"
            type="line"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            layout={{
              visibility: layerVisibility(visibility.tube),
              "line-join": "round",
              "line-cap": "round",
            }}
            paint={{
              "line-color": ["coalesce", ["get", "color"], "#6366f1"],
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10,
                1.4,
                14,
                2.6,
                16,
                3.4,
              ],
              "line-offset": TUBE_LINE_OFFSET,
              "line-opacity": 0.95,
            }}
          />
        </Source>
      ) : null}

      {showTube && data.tubeStations ? (
        <Source id="tube-stations" type="geojson" data={data.tubeStations}>
          <Layer
            id="tube-stations-circle"
            type="circle"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            minzoom={10}
            layout={{ visibility: layerVisibility(visibility.tube) }}
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
              "circle-opacity": 0.98,
            }}
          />
          <Layer
            id="tube-stations-label"
            type="symbol"
            beforeId={BASEMAP_LABELS_LAYER_ID}
            minzoom={12}
            layout={{
              visibility: layerVisibility(visibility.tube),
              "text-field": [
                "coalesce",
                ["get", "label"],
                ["get", "name"],
                "",
              ],
              "text-size": TUBE_LABEL_SIZE,
              "text-offset": [0, 1.15],
              "text-anchor": "top",
              "text-max-width": 8,
              "text-allow-overlap": false,
              "text-optional": true,
              "text-padding": 2,
            }}
            paint={{
              "text-color": "#111827",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.6,
            }}
          />
        </Source>
      ) : null}
    </>
  )
}
