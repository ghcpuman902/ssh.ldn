"use client"

import { useMemo } from "react"
import type { ExpressionSpecification } from "maplibre-gl"
import { Layer, Source } from "react-map-gl/maplibre"

import {
  DEFRA_MAP_LAYERS,
  DEFRA_MAP_RENDER_ORDER,
  defraPeriodFromDayPart,
  type DefraMapKind,
} from "@/lib/map/defra-layers"
import {
  NOISE_TILE_MAX_ZOOM,
  NOISE_TILE_MIN_ZOOM,
  POI_DENSITY_TILE_MAX_ZOOM,
  POI_DENSITY_TILE_MIN_ZOOM,
} from "@/lib/map/config"
import { nightlifeEmojiImageId } from "@/lib/map/nightlife-emoji-images"
import {
  POI_EMOJI_PRIORITY_MIN_ZOOM,
  poiDensitySlotFromParts,
} from "@/lib/map/poi-density"
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
  ["*", 0.55, ["coalesce", ["get", "radiusScale"], 0.85]],
  12,
  ["*", 0.75, ["coalesce", ["get", "radiusScale"], 0.85]],
  15,
  ["*", 1, ["coalesce", ["get", "radiusScale"], 0.85]],
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

const poiDensityTileUrl = (slot: string) =>
  `/poi-density/tiles/${slot}/{z}/{x}/{y}.png`

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
      {DEFRA_MAP_RENDER_ORDER.map((kind) => (
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

const PoiDensityRasterLayer = ({
  visible,
  timeSlot,
  opacity,
}: {
  visible: boolean
  timeSlot: NoiseTimeSlot
  opacity: number
}) => {
  const slot = poiDensitySlotFromParts(timeSlot)

  return (
    <Source
      key={`poi-density-${slot}`}
      id={`poi-density-${slot}`}
      type="raster"
      tiles={[poiDensityTileUrl(slot)]}
      tileSize={256}
      minzoom={POI_DENSITY_TILE_MIN_ZOOM}
      maxzoom={POI_DENSITY_TILE_MAX_ZOOM}
    >
      <Layer
        id={`poi-density-${slot}-layer`}
        type="raster"
        layout={{ visibility: layerVisibility(visible) }}
        paint={{
          "raster-opacity": opacity * 0.82,
          "raster-fade-duration": 180,
          "raster-resampling": "nearest",
        }}
      />
    </Source>
  )
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
        id="nightlife-venues-noise-aura"
        type="circle"
        minzoom={13}
        layout={{
          visibility: layerVisibility(visible),
        }}
        paint={{
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9.8,
            0,
            11,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "heatWeight"], 0],
              0,
              2,
              0.5,
              7,
              1,
              12,
            ],
            13.5,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "heatWeight"], 0],
              0,
              5,
              0.5,
              13,
              1,
              22,
            ],
            16,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "heatWeight"], 0],
              0,
              6,
              0.5,
              16,
              1,
              26,
            ],
          ],
          "circle-color": [
            "match",
            ["get", "amenity"],
            "pub",
            "rgba(249, 115, 22, 0.58)",
            "bar",
            "rgba(249, 115, 22, 0.58)",
            "nightclub",
            "rgba(239, 68, 68, 0.62)",
            "music_venue",
            "rgba(239, 68, 68, 0.6)",
            "hospital",
            "rgba(59, 130, 246, 0.42)",
            "rgba(234, 179, 8, 0.44)",
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9.8,
            0,
            11,
            [
              "*",
              opacity * 0.14,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "heatWeight"], 0],
                0,
                0.04,
                0.5,
                0.26,
                1,
                0.42,
              ],
            ],
            13.5,
            [
              "*",
              opacity * 0.22,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "heatWeight"], 0],
                0,
                0.05,
                0.5,
                0.3,
                1,
                0.5,
              ],
            ],
            16,
            [
              "*",
              opacity * 0.16,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "heatWeight"], 0],
                0,
                0.04,
                0.5,
                0.24,
                1,
                0.42,
              ],
            ],
          ],
          "circle-blur": [
            "match",
            ["get", "amenity"],
            "pub",
            0.7,
            "bar",
            0.7,
            "nightclub",
            0.65,
            "music_venue",
            0.65,
            0.85,
          ],
          "circle-stroke-width": 0,
        }}
      />
      <Layer
        id="nightlife-venues-noise-core"
        type="circle"
        minzoom={13}
        layout={{
          visibility: layerVisibility(visible),
        }}
        paint={{
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10.8,
            0,
            12,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "heatWeight"], 0],
              0,
              1,
              0.5,
              3,
              1,
              5,
            ],
            15,
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "heatWeight"], 0],
              0,
              2,
              0.5,
              5,
              1,
              8,
            ],
          ],
          "circle-color": [
            "match",
            ["get", "amenity"],
            "pub",
            "rgba(251, 146, 60, 0.88)",
            "bar",
            "rgba(251, 146, 60, 0.88)",
            "nightclub",
            "rgba(248, 113, 113, 0.92)",
            "music_venue",
            "rgba(248, 113, 113, 0.9)",
            "hospital",
            "rgba(96, 165, 250, 0.7)",
            "rgba(250, 204, 21, 0.78)",
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10.8,
            0,
            12,
            [
              "*",
              opacity * 0.22,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "heatWeight"], 0],
                0,
                0.08,
                0.5,
                0.36,
                1,
                0.58,
              ],
            ],
            15,
            [
              "*",
              opacity * 0.3,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "heatWeight"], 0],
                0,
                0.1,
                0.5,
                0.42,
                1,
                0.68,
              ],
            ],
          ],
          "circle-blur": 0.35,
          "circle-stroke-width": 0,
        }}
      />
      <Layer
        id="nightlife-venues-priority-symbol"
        type="symbol"
        minzoom={11}
        maxzoom={14}
        filter={[
          "any",
          ["==", ["get", "amenity"], "hospital"],
          ["==", ["get", "amenity"], "nightclub"],
          ["==", ["get", "amenity"], "music_venue"],
        ]}
        layout={{
          visibility: layerVisibility(visible),
          "icon-image": NIGHTLIFE_ICON_IMAGE,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            POI_EMOJI_PRIORITY_MIN_ZOOM.hospital,
            ["*", 0.58, ["coalesce", ["get", "radiusScale"], 0.85]],
            14,
            ["*", 0.9, ["coalesce", ["get", "radiusScale"], 0.85]],
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        }}
        paint={{
          "icon-opacity": opacity,
        }}
      />
      <Layer
        id="nightlife-venues-symbol"
        type="symbol"
        minzoom={14}
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
              opacity * 0.55,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "activity"], 0.5],
                0,
                0.45,
                0.5,
                0.75,
                1,
                1,
              ],
            ],
            12,
            [
              "*",
              opacity * 0.8,
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "activity"], 0.5],
                0,
                0.45,
                0.5,
                0.75,
                1,
                1,
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
                0.45,
                0.5,
                0.75,
                1,
                1,
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

      <PoiDensityRasterLayer
        visible={visibility.nightlife}
        timeSlot={timeSlot}
        opacity={nightlifeOpacity}
      />

      <NightlifeVenueLayers
        visible={visibility.nightlife}
        data={enrichedNightlife}
        opacity={nightlifeOpacity}
      />
    </>
  )
}
