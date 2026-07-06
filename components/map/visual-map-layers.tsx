"use client"

import { Layer, Source } from "react-map-gl/maplibre"

import type { VisualLayerData } from "@/hooks/use-visual-layer-data"
import { BASEMAP_LABELS_LAYER_ID } from "@/lib/map/config"
import type { VisualLayerVisibility } from "@/lib/map/visual-layers"

const layerVisibility = (visible: boolean): "visible" | "none" =>
  visible ? "visible" : "none"

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
                1.8,
                14,
                3.2,
                16,
                4.2,
              ],
              "line-opacity": 0.9,
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
                2,
                14,
                3.5,
                16,
                4.5,
              ],
              "circle-color": "#ffffff",
              "circle-stroke-color": "#111827",
              "circle-stroke-width": 1.2,
              "circle-opacity": 0.95,
            }}
          />
        </Source>
      ) : null}
    </>
  )
}
