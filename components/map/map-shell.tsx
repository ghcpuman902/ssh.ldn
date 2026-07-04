"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Map, { NavigationControl, type MapRef } from "react-map-gl/maplibre"
import { useTheme } from "next-themes"
import { useMapWindowClip } from "@/hooks/use-map-window-clip"
import { useMapZoomControlStyles } from "@/hooks/use-map-zoom-control-styles"
import {
  DEFAULT_NOISE_LAYER_VISIBILITY,
  NoiseMapLayers,
  type NoiseLayerVisibility,
} from "@/components/map/noise-map-layers"
import { MapDataCredits } from "@/components/map/map-data-credits"
import { NoiseLayerControls } from "@/components/map/noise-layer-controls"
import type { MapTheme } from "@/lib/map/config"
import type {
  NightlifeFeatureCollection,
  RailLineFeatureCollection,
} from "@/lib/map/geojson-types"
import { DEFAULT_NOISE_TIME_SLOT } from "@/lib/map/noise-time"
import {
  getMapStyle,
  LONDON_BOUNDS,
  LONDON_CENTER,
  LONDON_VIEWPORT,
  MAP_CONFIG,
} from "@/lib/map/config"

import "maplibre-gl/dist/maplibre-gl.css"
import "@/components/map/map-controls.css"

const LOGO_PATH = "/ssh.ldn logo.svg"
const RAIL_FETCH_RADIUS_METERS = 8_000
const NIGHTLIFE_FETCH_RADIUS_METERS = 8_000

const resolveMapTheme = (resolvedTheme: string | undefined): MapTheme =>
  resolvedTheme === "dark" ? "dark" : "light"

export const MapShell = () => {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState<NoiseLayerVisibility>(
    DEFAULT_NOISE_LAYER_VISIBILITY
  )
  const [timeSlot, setTimeSlot] = useState(DEFAULT_NOISE_TIME_SLOT)
  const [railGeoJson, setRailGeoJson] =
    useState<RailLineFeatureCollection | null>(null)
  const [nightlifeGeoJson, setNightlifeGeoJson] =
    useState<NightlifeFeatureCollection | null>(null)
  const mapRef = useRef<MapRef>(null)
  const { clipContainerRef, mapWindowRef, logoRef, updateClip } =
    useMapWindowClip()
  const applyZoomControlStyles = useMapZoomControlStyles(mapRef)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    updateClip()
    mapRef.current?.resize()
  }, [mounted, updateClip])

  useEffect(() => {
    if (!mounted) return

    const controller = new AbortController()

    const loadRailLines = async () => {
      try {
        const params = new URLSearchParams({
          lat: String(LONDON_CENTER.latitude),
          lng: String(LONDON_CENTER.longitude),
          radiusMeters: String(RAIL_FETCH_RADIUS_METERS),
        })
        const response = await fetch(
          `/api/discovery/osm/rail-lines?${params.toString()}`,
          { signal: controller.signal }
        )

        if (!response.ok) return

        const data = (await response.json()) as RailLineFeatureCollection
        setRailGeoJson(data)
      } catch {
        if (!controller.signal.aborted) {
          setRailGeoJson(null)
        }
      }
    }

    void loadRailLines()

    return () => controller.abort()
  }, [mounted])

  useEffect(() => {
    if (!mounted) return

    const controller = new AbortController()

    const loadNightlife = async () => {
      try {
        const params = new URLSearchParams({
          lat: String(LONDON_CENTER.latitude),
          lng: String(LONDON_CENTER.longitude),
          radiusMeters: String(NIGHTLIFE_FETCH_RADIUS_METERS),
        })
        const response = await fetch(
          `/api/discovery/osm/nightlife?${params.toString()}`,
          { signal: controller.signal }
        )

        if (!response.ok) return

        const data = (await response.json()) as NightlifeFeatureCollection
        setNightlifeGeoJson(data)
      } catch {
        if (!controller.signal.aborted) {
          setNightlifeGeoJson(null)
        }
      }
    }

    void loadNightlife()

    return () => controller.abort()
  }, [mounted])

  const mapTheme = resolveMapTheme(resolvedTheme)

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="h-svh w-full animate-pulse bg-white p-4 md:p-5"
      >
        <div className="h-full w-full rounded-4xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="relative h-svh w-full bg-white p-4 md:p-5">
      <div
        ref={mapWindowRef}
        data-map-window
        className="relative z-0 h-full w-full"
      >
        <div ref={clipContainerRef} className="absolute inset-0">
          <Map
            ref={mapRef}
            initialViewState={LONDON_VIEWPORT}
            mapStyle={getMapStyle(mapTheme)}
            minZoom={MAP_CONFIG.minZoom}
            maxZoom={MAP_CONFIG.maxZoom}
            maxBounds={LONDON_BOUNDS}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
            reuseMaps
            onLoad={() => {
              updateClip()
              mapRef.current?.resize()
              applyZoomControlStyles()
            }}
          >
            <NoiseMapLayers
              visibility={layerVisibility}
              timeSlot={timeSlot}
              railGeoJson={railGeoJson}
              nightlifeGeoJson={nightlifeGeoJson}
              mapTheme={mapTheme}
            />
            <NavigationControl
              position="bottom-right"
              showCompass={false}
              visualizePitch={false}
            />
          </Map>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/10 via-transparent to-background/20"
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div
          ref={logoRef}
          className="pointer-events-auto absolute left-4 top-4 flex w-fit items-center gap-1.5 pr-4 pb-3 md:left-5 md:top-5 md:gap-2 md:pr-5 md:pb-3.5"
        >
          <span aria-hidden className="text-[1.3lh] leading-none translate-y-1"
            style={{
              textBoxTrim: 'trim-both',
              textBoxEdge: 'cap alphabetic',
            }}
          >
            🤫
          </span>
          <Image
            src={LOGO_PATH}
            alt="ssh.ldn"
            width={924}
            height={179}
            priority
            className="h-7 w-auto md:h-8"
          />
        </div>

        <div className="pointer-events-auto absolute bottom-24 right-4 w-fit max-w-[calc(100vw-2rem)] md:bottom-28 md:right-5">
          <NoiseLayerControls
            visibility={layerVisibility}
            timeSlot={timeSlot}
            onVisibilityChange={setLayerVisibility}
            onTimeSlotChange={setTimeSlot}
          />
        </div>

        <div className="pointer-events-auto absolute inset-x-4 bottom-0 z-20 flex h-4 items-center md:inset-x-5 md:h-5">
          <MapDataCredits />
        </div>
      </div>
    </div>
  )
}
