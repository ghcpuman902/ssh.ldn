"use client"

import { useMemo } from "react"
import type { ExpressionSpecification } from "maplibre-gl"
import { Layer, Source } from "react-map-gl/maplibre"

import {
  DEFRA_MAP_KINDS,
  DEFRA_MAP_LAYERS,
  defraPeriodFromDayPart,
  type DefraMapKind,
} from "@/lib/map/defra-layers"
import { NOISE_TILE_MAX_ZOOM, NOISE_TILE_MIN_ZOOM } from "@/lib/map/config"
import { nightlifeEmojiImageId } from "@/lib/map/nightlife-emoji-images"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"
import { isWeekendNight, type NoiseTimeSlot } from "@/lib/map/noise-time"
import {
  isLocalNoiseAmenity,
  type LocalNoiseAmenity,
  venueSlotActivity,
} from "@/lib/map/venue-time"

export type NoiseLayerVisibility = Record<DefraMapKind | "nightlife", boolean>

export const DEFAULT_NOISE_LAYER_VISIBILITY: NoiseLayerVisibility = {
  road: true,
  rail: true,
  airport: true,
  nightlife: true,
}

export const DEFAULT_NOISE_LAYER_OPACITY: Record<
  DefraMapKind | "nightlife",
  number
> = {
  road: DEFRA_MAP_LAYERS.road.defaultOpacity,
  rail: DEFRA_MAP_LAYERS.rail.defaultOpacity,
  airport: DEFRA_MAP_LAYERS.airport.defaultOpacity,
  nightlife: 0.95,
}

const activityRadiusScale = (activity: number) => {
  if (activity <= 0) return 0.6
  if (activity >= 1) return 1.15
  if (activity <= 0.5) return 0.6 + (activity / 0.5) * (0.85 - 0.6)
  return 0.85 + ((activity - 0.5) / 0.5) * (1.15 - 0.85)
}

const LOCAL_POINT_IMPACT_BOOST: Record<LocalNoiseAmenity, number> = {
  pub: 1.9,
  bar: 1.8,
  nightclub: 1.6,
  music_venue: 1.7,
  hospital: 0.85,
}

const localPointImpactWeight = (amenity: string | null, activity: number) => {
  if (!isLocalNoiseAmenity(amenity)) return activity

  return Math.min(1, activity * LOCAL_POINT_IMPACT_BOOST[amenity])
}

/** zoom must be top-level; activity scale is precomputed on each feature. */
const NIGHTLIFE_ICON_SIZE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  9,
  ["*", 0.35, ["coalesce", ["get", "radiusScale"], 0.85]],
  12,
  ["*", 0.55, ["coalesce", ["get", "radiusScale"], 0.85]],
  15,
  ["*", 0.9, ["coalesce", ["get", "radiusScale"], 0.85]],
]

const NIGHTLIFE_ICON_IMAGE: ExpressionSpecification = [
  "match",
  ["get", "amenity"],
  "pub",
  nightlifeEmojiImageId("pub"),
  "bar",
  nightlifeEmojiImageId("bar"),
  "nightclub",
  nightlifeEmojiImageId("nightclub"),
  "music_venue",
  nightlifeEmojiImageId("music_venue"),
  "hospital",
  nightlifeEmojiImageId("hospital"),
  nightlifeEmojiImageId("default"),
]

const layerVisibility = (visible: boolean): "visible" | "none" =>
  visible ? "visible" : "none"

const defraTileUrl = (kind: DefraMapKind, period: string) =>
  `/api/map/defra/${kind}/{z}/{x}/{y}.png?period=${period}`

const enrichNightlifeGeoJson = (
  data: NightlifeFeatureCollection | null,
  timeSlot: NoiseTimeSlot
): NightlifeFeatureCollection | null => {
  if (!data) return null

  return {
    ...data,
    features: data.features.map((feature) => {
      const activity = venueSlotActivity(
        feature.properties.openingHours,
        feature.properties.amenity,
        timeSlot
      )
      const heatWeight = localPointImpactWeight(
        feature.properties.amenity,
        activity
      )

      return {
        ...feature,
        properties: {
          ...feature.properties,
          activity,
          heatWeight,
          radiusScale: activityRadiusScale(activity),
        },
      }
    }),
  }
}

type DefraNoiseRasterLayersProps = {
  visibility: Pick<NoiseLayerVisibility, DefraMapKind>
  timeSlot: NoiseTimeSlot
  opacity: Partial<Record<DefraMapKind, number>>
  weekendNightBoost: number
}

const DefraNoiseRasterLayers = ({
  visibility,
  timeSlot,
  opacity,
  weekendNightBoost,
}: DefraNoiseRasterLayersProps) => {
  const period = defraPeriodFromDayPart(timeSlot.part)

  const getOpacity = (kind: DefraMapKind) =>
    (opacity[kind] ?? DEFAULT_NOISE_LAYER_OPACITY[kind]) *
    (kind === "road" && timeSlot.part === "night" ? weekendNightBoost : 1)

  return (
    <>
      {DEFRA_MAP_KINDS.map((kind) => (
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
            layout={{ visibility: layerVisibility(visibility[kind]) }}
            paint={{
              "raster-opacity": Math.min(getOpacity(kind), 0.95),
              "raster-fade-duration": 250,
              // DEFRA noise is categorical dB bands — keep crisp band edges
              // when overzooming past the cached level instead of blurring.
              "raster-resampling": "nearest",
            }}
          />
        </Source>
      ))}
    </>
  )
}

type NightlifeVenueLayersProps = {
  visible: boolean
  data: NightlifeFeatureCollection | null
  opacity: number
}

/** Local source markers — always on top of noise heatmaps. */
const NightlifeVenueLayers = ({
  visible,
  data,
  opacity,
}: NightlifeVenueLayersProps) => {
  if (!data || data.features.length === 0) return null

  return (
    <Source id="nightlife-venues" type="geojson" data={data}>
      <Layer
        id="nightlife-venues-noise-points"
        type="circle"
        layout={{
          visibility: layerVisibility(visible),
        }}
        paint={{
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "heatWeight"], 0],
            0,
            3,
            0.5,
            7,
            1,
            11,
          ],
          "circle-color": [
            "match",
            ["get", "amenity"],
            "pub",
            "rgba(249, 115, 22, 0.82)",
            "bar",
            "rgba(249, 115, 22, 0.82)",
            "nightclub",
            "rgba(239, 68, 68, 0.86)",
            "music_venue",
            "rgba(239, 68, 68, 0.82)",
            "hospital",
            "rgba(59, 130, 246, 0.58)",
            "rgba(234, 179, 8, 0.56)",
          ],
          "circle-opacity": [
            "*",
            opacity,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "heatWeight"], 0],
              0,
              0.12,
              0.5,
              0.52,
              1,
              0.82,
            ],
          ],
          "circle-blur": [
            "match",
            ["get", "amenity"],
            "pub",
            0,
            "bar",
            0,
            "nightclub",
            0,
            "music_venue",
            0,
            0.15,
          ],
          "circle-stroke-color": "rgba(255, 255, 255, 0.7)",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.6,
        }}
      />
      <Layer
        id="nightlife-venues-symbol"
        type="symbol"
        layout={{
          visibility: layerVisibility(visible),
          "icon-image": NIGHTLIFE_ICON_IMAGE,
          "icon-size": NIGHTLIFE_ICON_SIZE,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        }}
        paint={{
          "icon-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            [
              "*",
              opacity * 0.15,
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
            12,
            [
              "*",
              opacity * 0.45,
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
            15,
            [
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
          ],
        }}
      />
    </Source>
  )
}

type NoiseMapLayersProps = {
  visibility: NoiseLayerVisibility
  timeSlot: NoiseTimeSlot
  opacity?: Partial<Record<DefraMapKind | "nightlife", number>>
  nightlifeGeoJson: NightlifeFeatureCollection | null
}

export const NoiseMapLayers = ({
  visibility,
  timeSlot,
  opacity = {},
  nightlifeGeoJson,
}: NoiseMapLayersProps) => {
  const weekendNightBoost = isWeekendNight(timeSlot) ? 1.08 : 1

  const enrichedNightlife = useMemo(
    () => enrichNightlifeGeoJson(nightlifeGeoJson, timeSlot),
    [nightlifeGeoJson, timeSlot]
  )

  const nightlifeOpacity =
    opacity.nightlife ?? DEFAULT_NOISE_LAYER_OPACITY.nightlife

  return (
    <>
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

      <NightlifeVenueLayers
        visible={visibility.nightlife}
        data={enrichedNightlife}
        opacity={nightlifeOpacity}
      />
    </>
  )
}
