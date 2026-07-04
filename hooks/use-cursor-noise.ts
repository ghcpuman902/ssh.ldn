"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl"
import type { MapRef } from "react-map-gl/maplibre"

import type { NoiseLayerVisibility } from "@/components/map/noise-map-layers"
import { defraPeriodFromDayPart, type DefraMapKind } from "@/lib/map/defra-layers"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"
import {
  createEmptyNoiseAudioChannelLevels,
  NOISE_AUDIO_CHANNELS,
  type NoiseAudioChannelLevels,
} from "@/lib/map/noise-audio-map"
import { noiseAudioEngine } from "@/lib/map/noise-audio-engine"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"
import {
  isLocalNoiseAmenity,
  type LocalNoiseAmenity,
  venueSlotActivity,
} from "@/lib/map/venue-time"
import { sampleDefraRasterIntensity } from "@/lib/map/raster-pixel-sampler"

const TRANSPORT_KINDS: DefraMapKind[] = ["road", "rail", "airport"]
const LOCAL_HOVER_RADIUS_PX = 64
const LOCAL_CHANNEL_BOOST = 1.35

const LOCAL_POINT_IMPACT_BOOST: Record<LocalNoiseAmenity, number> = {
  pub: 1.9,
  bar: 1.8,
  nightclub: 1.6,
  music_venue: 1.7,
  hospital: 0.85,
}

type ScreenPoint = { x: number; y: number }

const createMixPercentages = (levels: NoiseAudioChannelLevels) => {
  const weightedLevels = Object.fromEntries(
    Object.entries(levels).map(([key, level]) => {
      const channel = NOISE_AUDIO_CHANNELS[key as keyof typeof levels]
      return [key, level * channel.defaultGain]
    })
  ) as NoiseAudioChannelLevels
  const total = Object.values(weightedLevels).reduce(
    (sum, level) => sum + level,
    0
  )
  if (total <= 0) return createEmptyNoiseAudioChannelLevels()

  return Object.fromEntries(
    Object.entries(weightedLevels).map(([key, level]) => [
      key,
      (level / total) * 100,
    ])
  ) as NoiseAudioChannelLevels
}

const pointFalloff = (distancePx: number) => {
  if (distancePx >= LOCAL_HOVER_RADIUS_PX) return 0

  const normalized = 1 - distancePx / LOCAL_HOVER_RADIUS_PX
  return normalized * normalized
}

const computeLocalLevels = ({
  map,
  cursorPoint,
  nightlifeGeoJson,
  timeSlot,
}: {
  map: MapLibreMap
  cursorPoint: ScreenPoint
  nightlifeGeoJson: NightlifeFeatureCollection | null
  timeSlot: NoiseTimeSlot
}) => {
  const levels = createEmptyNoiseAudioChannelLevels()
  if (!nightlifeGeoJson) return levels

  for (const feature of nightlifeGeoJson.features) {
    const amenity = feature.properties.amenity
    if (!isLocalNoiseAmenity(amenity)) continue

    const [longitude, latitude] = feature.geometry.coordinates
    const point = map.project([longitude, latitude])
    const distancePx = Math.hypot(point.x - cursorPoint.x, point.y - cursorPoint.y)
    const falloff = pointFalloff(distancePx)
    if (falloff <= 0) continue

    const heatWeight = Math.min(
      1,
      venueSlotActivity(feature.properties.openingHours, amenity, timeSlot) *
        LOCAL_POINT_IMPACT_BOOST[amenity]
    )
    const weight = Math.min(1, heatWeight * falloff * LOCAL_CHANNEL_BOOST)

    if (amenity === "pub" || amenity === "bar") {
      levels.pubBar = Math.max(levels.pubBar, weight)
      continue
    }

    if (amenity === "nightclub" || amenity === "music_venue") {
      levels.nightclubMusicVenue = Math.max(levels.nightclubMusicVenue, weight)
      continue
    }

    levels.hospital = Math.max(levels.hospital, weight)
  }

  return levels
}

type UseCursorNoiseInput = {
  mapRef: RefObject<MapRef | null>
  nightlifeGeoJson: NightlifeFeatureCollection | null
  timeSlot: NoiseTimeSlot
  layerVisibility: NoiseLayerVisibility
  enabled: boolean
}

export const useCursorNoise = ({
  mapRef,
  nightlifeGeoJson,
  timeSlot,
  layerVisibility,
  enabled,
}: UseCursorNoiseInput) => {
  const [levels, setLevels] = useState<NoiseAudioChannelLevels>(() =>
    createEmptyNoiseAudioChannelLevels()
  )
  const sampleIdRef = useRef(0)

  const mixPercentages = useMemo(() => createMixPercentages(levels), [levels])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !enabled) {
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      setLevels(emptyLevels)
      noiseAudioEngine.setIntensities(emptyLevels)
      void noiseAudioEngine.disable()
      return
    }

    let frameId: number | null = null
    let latestCursor: { latitude: number; longitude: number } | null = null
    let latestCursorPoint: ScreenPoint | null = null
    let latestZoom = map.getZoom()
    let cancelled = false

    const updateLevels = async () => {
      frameId = null
      const cursor = latestCursor
      const cursorPoint = latestCursorPoint
      if (!cursor || !cursorPoint) return

      const sampleId = ++sampleIdRef.current
      const period = defraPeriodFromDayPart(timeSlot.part)
      const nextLevels = layerVisibility.nightlife
        ? computeLocalLevels({
            map,
            cursorPoint,
            nightlifeGeoJson,
            timeSlot,
          })
        : createEmptyNoiseAudioChannelLevels()

      await Promise.all(
        TRANSPORT_KINDS.map(async (kind) => {
          if (!layerVisibility[kind]) return

          nextLevels[kind] = await sampleDefraRasterIntensity({
            kind,
            period,
            longitude: cursor.longitude,
            latitude: cursor.latitude,
            zoom: latestZoom,
          }).catch(() => 0)
        })
      )

      if (cancelled || sampleId !== sampleIdRef.current) return

      setLevels(nextLevels)
      noiseAudioEngine.setIntensities(nextLevels)
    }

    const scheduleUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(() => {
        void updateLevels()
      })
    }

    const handleMouseMove = (event: MapMouseEvent) => {
      latestCursor = {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      }
      latestCursorPoint = { x: event.point.x, y: event.point.y }
      scheduleUpdate()
    }

    const handleMouseLeave = () => {
      latestCursor = null
      latestCursorPoint = null
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      setLevels(emptyLevels)
      noiseAudioEngine.setIntensities(emptyLevels)
    }

    const handleZoom = () => {
      latestZoom = map.getZoom()
      noiseAudioEngine.setMasterFromZoom(latestZoom)
      scheduleUpdate()
    }

    void noiseAudioEngine.enable().catch(() => {
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      setLevels(emptyLevels)
      noiseAudioEngine.setIntensities(emptyLevels)
    })
    noiseAudioEngine.setMasterFromZoom(latestZoom)
    map.on("mousemove", handleMouseMove)
    map.on("mouseout", handleMouseLeave)
    map.on("zoom", handleZoom)

    return () => {
      cancelled = true
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      map.off("mousemove", handleMouseMove)
      map.off("mouseout", handleMouseLeave)
      map.off("zoom", handleZoom)
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      setLevels(emptyLevels)
      noiseAudioEngine.setIntensities(emptyLevels)
    }
  }, [enabled, layerVisibility, mapRef, nightlifeGeoJson, timeSlot])

  return {
    levels,
    mixPercentages,
  }
}
