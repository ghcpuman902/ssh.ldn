"use client"

import { Layer, Source } from "react-map-gl/maplibre"

import {
  DEFRA_MAP_KINDS,
  DEFRA_MAP_LAYERS,
  defraPeriodFromDayPart,
  type DefraMapKind,
} from "@/lib/map/defra-layers"
import type { MapTheme } from "@/lib/map/config"
import type { RailLineFeatureCollection } from "@/lib/map/geojson-types"
import { isWeekendNight, type NoiseTimeSlot } from "@/lib/map/noise-time"

export type NoiseLayerVisibility = Record<DefraMapKind | "railLines", boolean>

export const DEFAULT_NOISE_LAYER_VISIBILITY: NoiseLayerVisibility = {
  road: true,
  rail: true,
  airport: true,
  railLines: true,
};

export const DEFAULT_NOISE_LAYER_OPACITY: Record<
  DefraMapKind | "railLines",
  number
> = {
  road: DEFRA_MAP_LAYERS.road.defaultOpacity,
  rail: DEFRA_MAP_LAYERS.rail.defaultOpacity,
  airport: DEFRA_MAP_LAYERS.airport.defaultOpacity,
  railLines: 0.65,
};

const RAIL_LINE_COLORS: Record<
  MapTheme,
  { casing: string; line: string }
> = {
  light: {
    casing: "#e7e5e4",
    line: "#a8a29e",
  },
  dark: {
    casing: "#44403c",
    line: "#78716c",
  },
};

const defraTileUrl = (kind: DefraMapKind, period: string) =>
  `/api/map/defra/${kind}/{z}/{x}/{y}.png?period=${period}`;

type NoiseMapLayersProps = {
  visibility: NoiseLayerVisibility;
  timeSlot: NoiseTimeSlot;
  opacity?: Partial<Record<DefraMapKind | "railLines", number>>;
  railGeoJson: RailLineFeatureCollection | null;
  mapTheme?: MapTheme;
};

export const NoiseMapLayers = ({
  visibility,
  timeSlot,
  opacity = {},
  railGeoJson,
  mapTheme = "light",
}: NoiseMapLayersProps) => {
  const period = defraPeriodFromDayPart(timeSlot.part);
  const weekendNightBoost = isWeekendNight(timeSlot) ? 1.08 : 1;
  const railColors = RAIL_LINE_COLORS[mapTheme];

  const getOpacity = (key: DefraMapKind | "railLines") =>
    (opacity[key] ?? DEFAULT_NOISE_LAYER_OPACITY[key]) *
    (key === "road" && timeSlot.part === "night" ? weekendNightBoost : 1);

  return (
    <>
      {visibility.railLines && railGeoJson && railGeoJson.features.length > 0 ? (
        <Source id="rail-lines" type="geojson" data={railGeoJson}>
          <Layer
            id="rail-lines-casing"
            type="line"
            paint={{
              "line-color": railColors.casing,
              "line-width": 3.5,
              "line-opacity": getOpacity("railLines") * 0.45,
            }}
          />
          <Layer
            id="rail-lines-line"
            type="line"
            paint={{
              "line-color": railColors.line,
              "line-width": 1.5,
              "line-opacity": getOpacity("railLines") * 0.85,
            }}
          />
        </Source>
      ) : null}

      {DEFRA_MAP_KINDS.map((kind) =>
        visibility[kind] ? (
          <Source
            key={`defra-${kind}-${period}-${timeSlot.week}`}
            id={`defra-${kind}-${period}`}
            type="raster"
            tiles={[defraTileUrl(kind, period)]}
            tileSize={256}
            attribution={DEFRA_MAP_LAYERS[kind].attribution}
          >
            <Layer
              id={`defra-${kind}-${period}-layer`}
              type="raster"
              paint={{
                "raster-opacity": Math.min(getOpacity(kind), 0.95),
                "raster-fade-duration": 250,
              }}
            />
          </Source>
        ) : null
      )}
    </>
  );
};
