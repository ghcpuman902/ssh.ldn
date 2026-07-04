"use client"

import { useMemo } from "react"
import { Layer, Source } from "react-map-gl/maplibre"

import {
  DEFRA_MAP_KINDS,
  DEFRA_MAP_LAYERS,
  defraPeriodFromDayPart,
  type DefraMapKind,
} from "@/lib/map/defra-layers"
import {
  NOISE_TILE_MAX_ZOOM,
  NOISE_TILE_MIN_ZOOM,
  type MapTheme,
} from "@/lib/map/config"
import type {
  NightlifeFeatureCollection,
  RailLineFeatureCollection,
} from "@/lib/map/geojson-types"
import { isWeekendNight, type NoiseTimeSlot } from "@/lib/map/noise-time"
import { venueSlotActivity } from "@/lib/map/venue-time"

export type NoiseLayerVisibility = Record<
  DefraMapKind | "railLines" | "nightlife",
  boolean
>

export const DEFAULT_NOISE_LAYER_VISIBILITY: NoiseLayerVisibility = {
  road: true,
  rail: true,
  airport: true,
  railLines: true,
  nightlife: true,
};

export const DEFAULT_NOISE_LAYER_OPACITY: Record<
  DefraMapKind | "railLines" | "nightlife",
  number
> = {
  road: DEFRA_MAP_LAYERS.road.defaultOpacity,
  rail: DEFRA_MAP_LAYERS.rail.defaultOpacity,
  airport: DEFRA_MAP_LAYERS.airport.defaultOpacity,
  railLines: 0.9,
  nightlife: 0.95,
};

/** Reference geometry — sits above basemap, below DEFRA noise rasters. */
const RAIL_TRACK_COLORS: Record<MapTheme, { casing: string; line: string }> = {
  light: {
    casing: "#c7d2fe",
    line: "#4f46e5",
  },
  dark: {
    casing: "#312e81",
    line: "#818cf8",
  },
};

const NIGHTLIFE_AMENITY_COLORS: Record<MapTheme, Record<string, string>> = {
  light: {
    pub: "#d97706",
    bar: "#ea580c",
    nightclub: "#7c3aed",
    music_venue: "#db2777",
    default: "#78716c",
  },
  dark: {
    pub: "#fbbf24",
    bar: "#fb923c",
    nightclub: "#a78bfa",
    music_venue: "#f472b6",
    default: "#a8a29e",
  },
};

const defraTileUrl = (kind: DefraMapKind, period: string) =>
  `/api/map/defra/${kind}/{z}/{x}/{y}.png?period=${period}`;

const enrichNightlifeGeoJson = (
  data: NightlifeFeatureCollection | null,
  timeSlot: NoiseTimeSlot
): NightlifeFeatureCollection | null => {
  if (!data) return null;

  return {
    ...data,
    features: data.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        activity: venueSlotActivity(
          feature.properties.openingHours,
          feature.properties.amenity,
          timeSlot
        ),
      },
    })),
  };
};

type RailTrackLayersProps = {
  visible: boolean;
  data: RailLineFeatureCollection | null;
  mapTheme: MapTheme;
  opacity: number;
};

/** Physical rail geometry — highlights where DEFRA rail noise originates. */
const RailTrackLayers = ({
  visible,
  data,
  mapTheme,
  opacity,
}: RailTrackLayersProps) => {
  if (!visible || !data || data.features.length === 0) return null;

  const colors = RAIL_TRACK_COLORS[mapTheme];

  return (
    <Source id="rail-tracks" type="geojson" data={data}>
      <Layer
        id="rail-tracks-casing"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": colors.casing,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            2,
            12,
            4,
            15,
            7,
          ],
          "line-opacity": opacity * 0.55,
        }}
      />
      <Layer
        id="rail-tracks-line"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": colors.line,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            1,
            12,
            2.5,
            15,
            5,
          ],
          "line-opacity": opacity * 0.95,
        }}
      />
    </Source>
  );
};

type DefraNoiseRasterLayersProps = {
  visibility: Pick<NoiseLayerVisibility, DefraMapKind>;
  timeSlot: NoiseTimeSlot;
  opacity: Partial<Record<DefraMapKind, number>>;
  weekendNightBoost: number;
};

const DefraNoiseRasterLayers = ({
  visibility,
  timeSlot,
  opacity,
  weekendNightBoost,
}: DefraNoiseRasterLayersProps) => {
  const period = defraPeriodFromDayPart(timeSlot.part);

  const getOpacity = (kind: DefraMapKind) =>
    (opacity[kind] ?? DEFAULT_NOISE_LAYER_OPACITY[kind]) *
    (kind === "road" && timeSlot.part === "night" ? weekendNightBoost : 1);

  return (
    <>
      {DEFRA_MAP_KINDS.map((kind) =>
        visibility[kind] ? (
          <Source
            key={`defra-${kind}-${period}-${timeSlot.week}`}
            id={`defra-noise-${kind}-${period}`}
            type="raster"
            tiles={[defraTileUrl(kind, period)]}
            tileSize={256}
            minzoom={NOISE_TILE_MIN_ZOOM}
            maxzoom={NOISE_TILE_MAX_ZOOM}
          >
            <Layer
              id={`defra-noise-${kind}-${period}-layer`}
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

type NightlifeVenueLayersProps = {
  visible: boolean;
  data: NightlifeFeatureCollection | null;
  mapTheme: MapTheme;
  opacity: number;
};

/** Point markers — always on top of noise heatmaps. */
const NightlifeVenueLayers = ({
  visible,
  data,
  mapTheme,
  opacity,
}: NightlifeVenueLayersProps) => {
  if (!visible || !data || data.features.length === 0) return null;

  const colors = NIGHTLIFE_AMENITY_COLORS[mapTheme];

  return (
    <Source id="nightlife-venues" type="geojson" data={data}>
      <Layer
        id="nightlife-venues-circle"
        type="circle"
        paint={{
          "circle-color": [
            "match",
            ["get", "amenity"],
            "pub",
            colors.pub,
            "bar",
            colors.bar,
            "nightclub",
            colors.nightclub,
            "music_venue",
            colors.music_venue,
            colors.default,
          ],
          "circle-radius": [
            "*",
            ["interpolate", ["linear"], ["zoom"], 9, 3, 12, 5, 15, 9],
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "activity"], 0.5],
              0,
              0.6,
              0.5,
              0.85,
              1,
              1.15,
            ],
          ],
          "circle-opacity": [
            "*",
            opacity,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "activity"], 0.5],
              0,
              0.35,
              0.5,
              0.65,
              1,
              0.95,
            ],
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": mapTheme === "dark" ? "#1c1917" : "#ffffff",
          "circle-stroke-opacity": 0.9,
        }}
      />
    </Source>
  );
};

type NoiseMapLayersProps = {
  visibility: NoiseLayerVisibility;
  timeSlot: NoiseTimeSlot;
  opacity?: Partial<Record<DefraMapKind | "railLines" | "nightlife", number>>;
  railGeoJson: RailLineFeatureCollection | null;
  nightlifeGeoJson: NightlifeFeatureCollection | null;
  mapTheme?: MapTheme;
};

export const NoiseMapLayers = ({
  visibility,
  timeSlot,
  opacity = {},
  railGeoJson,
  nightlifeGeoJson,
  mapTheme = "light",
}: NoiseMapLayersProps) => {
  const weekendNightBoost = isWeekendNight(timeSlot) ? 1.08 : 1;

  const enrichedNightlife = useMemo(
    () => enrichNightlifeGeoJson(nightlifeGeoJson, timeSlot),
    [nightlifeGeoJson, timeSlot]
  );

  const railTrackOpacity =
    opacity.railLines ?? DEFAULT_NOISE_LAYER_OPACITY.railLines;
  const nightlifeOpacity =
    opacity.nightlife ?? DEFAULT_NOISE_LAYER_OPACITY.nightlife;

  return (
    <>
      {/* 1. Reference geometry — under noise rasters */}
      <RailTrackLayers
        visible={visibility.railLines}
        data={railGeoJson}
        mapTheme={mapTheme}
        opacity={railTrackOpacity}
      />

      {/* 2. DEFRA strategic noise heatmaps */}
      <DefraNoiseRasterLayers
        visibility={{
          road: visibility.road,
          rail: visibility.rail,
          airport: visibility.airport,
        }}
        timeSlot={timeSlot}
        opacity={opacity}
        weekendNightBoost={weekendNightBoost}
      />

      {/* 3. Nightlife venues — on top so markers stay visible */}
      <NightlifeVenueLayers
        visible={visibility.nightlife}
        data={enrichedNightlife}
        mapTheme={mapTheme}
        opacity={nightlifeOpacity}
      />
    </>
  );
};
