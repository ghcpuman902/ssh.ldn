"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl"
import type { MapRef } from "react-map-gl/maplibre"

import type { NoiseLayerVisibility } from "@/components/map/noise-map-layers"
import { defraPeriodFromDayPart, type DefraMapKind } from "@/lib/map/defra-layers"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"
import {
  createEmptyNoiseAudioChannelLevels,
  type NoiseAudioChannelLevels,
} from "@/lib/map/noise-audio-map"
import { noiseAudioEngine } from "@/lib/map/noise-audio-engine"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"
import {
  isLocalNoiseAmenity,
  LOCAL_NOISE_AMENITIES,
  type LocalNoiseAmenity,
  venueSlotActivity,
} from "@/lib/map/venue-time"
import { sampleDefraRasterIntensity } from "@/lib/map/raster-pixel-sampler"
import { boostAirportRasterIntensity } from "@/lib/map/transport-noise-scoring"

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

export type LocalAmenityLevels = Record<LocalNoiseAmenity, number>

export const createEmptyLocalAmenityLevels = (): LocalAmenityLevels =>
  LOCAL_NOISE_AMENITIES.reduce(
    (levels, amenity) => ({ ...levels, [amenity]: 0 }),
    {} as LocalAmenityLevels
  )

/** Map sampled 0–1 channel levels to 0–100 bar widths (absolute, not mix share). */
const createIntensityPercentages = (levels: NoiseAudioChannelLevels) =>
  Object.fromEntries(
    Object.entries(levels).map(([key, level]) => [key, level * 100])
  ) as NoiseAudioChannelLevels

const createLocalAmenityPercentages = (levels: LocalAmenityLevels) =>
  Object.fromEntries(
    Object.entries(levels).map(([key, level]) => [key, level * 100])
  ) as LocalAmenityLevels

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
  const channelLevels = createEmptyNoiseAudioChannelLevels()
  const amenityLevels = createEmptyLocalAmenityLevels()
  if (!nightlifeGeoJson) {
    return { channelLevels, amenityLevels }
  }

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

    amenityLevels[amenity] = Math.max(amenityLevels[amenity], weight)

    if (amenity === "pub" || amenity === "bar") {
      channelLevels.pubBar = Math.max(channelLevels.pubBar, weight)
      continue
    }

    if (amenity === "nightclub" || amenity === "music_venue") {
      channelLevels.nightclubMusicVenue = Math.max(
        channelLevels.nightclubMusicVenue,
        weight
      )
      continue
    }

    channelLevels.hospital = Math.max(channelLevels.hospital, weight)
  }

  return { channelLevels, amenityLevels }
}

type UseCursorNoiseInput = {
  mapRef: RefObject<MapRef | null>
  nightlifeGeoJson: NightlifeFeatureCollection | null
  timeSlot: NoiseTimeSlot
  layerVisibility: NoiseLayerVisibility
  samplingEnabled: boolean
  audioEnabled: boolean
  sampleMode?: "cursor" | "center"
}

export const useCursorNoise = ({
  mapRef,
  nightlifeGeoJson,
  timeSlot,
  layerVisibility,
  samplingEnabled,
  audioEnabled,
  sampleMode = "cursor",
}: UseCursorNoiseInput) => {
  const [levels, setLevels] = useState<NoiseAudioChannelLevels>(() =>
    createEmptyNoiseAudioChannelLevels()
  )
  const [amenityLevels, setAmenityLevels] = useState<LocalAmenityLevels>(() =>
    createEmptyLocalAmenityLevels()
  )
  const sampleIdRef = useRef(0)
  const audioEnabledRef = useRef(audioEnabled)

  useEffect(() => {
    audioEnabledRef.current = audioEnabled
  }, [audioEnabled])

  const intensityPercentages = useMemo(
    () => createIntensityPercentages(levels),
    [levels]
  )

  const localAmenityPercentages = useMemo(
    () => createLocalAmenityPercentages(amenityLevels),
    [amenityLevels]
  )

  useEffect(() => {
    if (!audioEnabled) {
      void noiseAudioEngine.disable()
      return
    }

    void noiseAudioEngine.enable().catch(() => {
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      noiseAudioEngine.setIntensities(emptyLevels)
    })
  }, [audioEnabled])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !samplingEnabled) {
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      const emptyAmenityLevels = createEmptyLocalAmenityLevels()
      setLevels(emptyLevels)
      setAmenityLevels(emptyAmenityLevels)
      if (audioEnabledRef.current) {
        noiseAudioEngine.setIntensities(emptyLevels)
      }
      return
    }

    let frameId: number | null = null
    let latestCursor: { latitude: number; longitude: number } | null = null
    let latestCursorPoint: ScreenPoint | null = null
    let latestZoom = map.getZoom()
    let cancelled = false

    const applyLevels = (
      nextLevels: NoiseAudioChannelLevels,
      nextAmenityLevels: LocalAmenityLevels
    ) => {
      setLevels(nextLevels)
      setAmenityLevels(nextAmenityLevels)
      if (audioEnabledRef.current) {
        noiseAudioEngine.setIntensities(nextLevels)
      }
    }

    const updateLevels = async () => {
      frameId = null
      const cursor = latestCursor
      const cursorPoint = latestCursorPoint
      if (!cursor || !cursorPoint) return

      const sampleId = ++sampleIdRef.current
      const period = defraPeriodFromDayPart(timeSlot.part)
      const nextLevels = createEmptyNoiseAudioChannelLevels()
      let nextAmenityLevels = createEmptyLocalAmenityLevels()

      if (layerVisibility.nightlife) {
        const local = computeLocalLevels({
          map,
          cursorPoint,
          nightlifeGeoJson,
          timeSlot,
        })
        Object.assign(nextLevels, local.channelLevels)
        nextAmenityLevels = local.amenityLevels
      }

      await Promise.all(
        TRANSPORT_KINDS.map(async (kind) => {
          if (!layerVisibility[kind]) return

          nextLevels[kind] = await sampleDefraRasterIntensity({
            kind,
            period,
            longitude: cursor.longitude,
            latitude: cursor.latitude,
            zoom: latestZoom,
          })
            .then((intensity) =>
              kind === "airport"
                ? boostAirportRasterIntensity(intensity)
                : intensity
            )
            .catch(() => 0)
        })
      )

      if (cancelled || sampleId !== sampleIdRef.current) return

      applyLevels(nextLevels, nextAmenityLevels)
    }

    const scheduleUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(() => {
        void updateLevels()
      })
    }

    const updateCenterSample = () => {
      const center = map.getCenter()
      const container = map.getContainer()
      latestCursor = {
        latitude: center.lat,
        longitude: center.lng,
      }
      latestCursorPoint = {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      }
      scheduleUpdate()
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
      const emptyAmenityLevels = createEmptyLocalAmenityLevels()
      applyLevels(emptyLevels, emptyAmenityLevels)
    }

    const handleZoom = () => {
      latestZoom = map.getZoom()
      if (audioEnabledRef.current) {
        noiseAudioEngine.setMasterFromZoom(latestZoom)
      }
      if (sampleMode === "center") {
        updateCenterSample()
        return
      }
      scheduleUpdate()
    }

    const handleMove = () => {
      if (sampleMode !== "center") return

      updateCenterSample()
    }

    if (audioEnabledRef.current) {
      noiseAudioEngine.setMasterFromZoom(latestZoom)
    }
    if (sampleMode === "center") {
      updateCenterSample()
      map.on("move", handleMove)
    } else {
      map.on("mousemove", handleMouseMove)
      map.on("mouseout", handleMouseLeave)
    }
    map.on("zoom", handleZoom)

    return () => {
      cancelled = true
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
      if (sampleMode === "center") {
        map.off("move", handleMove)
      } else {
        map.off("mousemove", handleMouseMove)
        map.off("mouseout", handleMouseLeave)
      }
      map.off("zoom", handleZoom)
      const emptyLevels = createEmptyNoiseAudioChannelLevels()
      const emptyAmenityLevels = createEmptyLocalAmenityLevels()
      setLevels(emptyLevels)
      setAmenityLevels(emptyAmenityLevels)
      if (audioEnabledRef.current) {
        noiseAudioEngine.setIntensities(emptyLevels)
      }
    }
  }, [
    samplingEnabled,
    layerVisibility,
    mapRef,
    nightlifeGeoJson,
    sampleMode,
    timeSlot,
  ])

  useEffect(() => {
    if (!audioEnabled) return

    noiseAudioEngine.setIntensities(levels)
    const map = mapRef.current?.getMap()
    if (map) {
      noiseAudioEngine.setMasterFromZoom(map.getZoom())
    }
  }, [audioEnabled, levels, mapRef])

  return {
    levels,
    intensityPercentages,
    localAmenityPercentages,
  }
}
