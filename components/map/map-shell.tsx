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
import { useMapZoomControlStyles } from "@/hooks/use-map-zoom-control-styles"
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
import "@/components/map/map-controls.css"

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
  const { clipContainerRef, mapWindowRef, logoRef, debugPoints, updateClip } =
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

      <div className="absolute bottom-6 left-4 z-30 md:bottom-8 md:left-5">
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
              applyZoomControlStyles()
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

          {debugPoints.length > 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-30"
            >
              {debugPoints.map((point) => {
                const isBottom =
                  point.id.includes("br") ||
                  point.id.includes("bl") ||
                  point.id.includes("bottom") ||
                  point.id.includes("left-bend") ||
                  point.id === "path-m"

                return (
                  <div
                    key={point.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: point.x, top: point.y }}
                  >
                    <div
                      className={
                        isBottom
                          ? "size-3.5 rounded-full bg-red-500 ring-2 ring-white"
                          : "size-2.5 rounded-full bg-red-400/80 ring-1 ring-white"
                      }
                    />
                    <span className="mt-0.5 block max-w-36 text-[9px] font-medium leading-tight text-red-600">
                      {point.id}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
