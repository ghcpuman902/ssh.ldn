"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Map, {
  AttributionControl,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre"
import { useTheme } from "next-themes"
import { useMapWindowClip } from "@/hooks/use-map-window-clip"
import {
  DEFAULT_NOISE_LAYER_VISIBILITY,
  NoiseMapLayers,
  type NoiseLayerVisibility,
} from "@/components/map/noise-map-layers"
import { NoiseLayerControls } from "@/components/map/noise-layer-controls"
import type { MapTheme } from "@/lib/map/config"
import type { RailLineFeatureCollection } from "@/lib/map/geojson-types"
import { DEFAULT_NOISE_TIME_SLOT } from "@/lib/map/noise-time"
import {
  getMapStyle,
  LONDON_BOUNDS,
  LONDON_CENTER,
  LONDON_VIEWPORT,
  MAP_CONFIG,
} from "@/lib/map/config"

import "maplibre-gl/dist/maplibre-gl.css"

const LOGO_PATH = "/ssh.ldn logo.svg"
const RAIL_FETCH_RADIUS_METERS = 8_000

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
  const mapRef = useRef<MapRef>(null)
  const { clipContainerRef, mapWindowRef, logoRef, updateClip } =
    useMapWindowClip()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    updateClip()
    mapRef.current?.resize()
  }, [mounted, updateClip])

  useEffect(() => {
    if (!mounted || !layerVisibility.railLines) return

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
  }, [mounted, layerVisibility.railLines])

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
      <div className="pointer-events-none absolute left-4 top-4 z-20 md:left-5 md:top-5">
        <Image
          ref={logoRef}
          src={LOGO_PATH}
          alt="ssh.ldn"
          width={924}
          height={179}
          priority
          className="h-7 w-auto md:h-8"
        />
      </div>

      <div className="pointer-events-none absolute bottom-6 left-4 z-20 md:bottom-8 md:left-5">
        <NoiseLayerControls
          visibility={layerVisibility}
          timeSlot={timeSlot}
          onVisibilityChange={setLayerVisibility}
          onTimeSlotChange={setTimeSlot}
        />
      </div>

      <div
        ref={mapWindowRef}
        data-map-window
        className="relative h-full w-full"
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
            }}
          >
            <NoiseMapLayers
              visibility={layerVisibility}
              timeSlot={timeSlot}
              railGeoJson={railGeoJson}
              mapTheme={mapTheme}
            />
            <NavigationControl
              position="bottom-right"
              showCompass={false}
              visualizePitch={false}
            />
            <AttributionControl compact />
          </Map>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/10 via-transparent to-background/20"
          />
        </div>
      </div>
    </div>
  )
}
