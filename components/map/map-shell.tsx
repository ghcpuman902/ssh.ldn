"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre"
import { useTheme } from "next-themes"
import { MapNoiseAudioToggle } from "@/components/map/map-noise-audio-toggle"
import { useCursorNoise } from "@/hooks/use-cursor-noise"
import { useMapWindowClip } from "@/hooks/use-map-window-clip"
import { useMapZoomControlStyles } from "@/hooks/use-map-zoom-control-styles"
import { useViewportNightlifeGeoJson } from "@/hooks/use-viewport-nightlife-geojson"
import {
  MapAnalysePanel,
  type AnalyseState,
} from "@/components/map/map-analyse-panel"
import { VoiceModeButton } from "@/components/map/voice-mode-button"
import {
  DEFAULT_NOISE_LAYER_VISIBILITY,
  NoiseMapLayers,
  type NoiseLayerVisibility,
} from "@/components/map/noise-map-layers"
import { MapDataCredits } from "@/components/map/map-data-credits"
import { MapSearchBar, type MapSearchSelection } from "@/components/map/map-search-bar"
import { NoiseLayerControls } from "@/components/map/noise-layer-controls"
import type { MapTheme } from "@/lib/map/config"
import { DEFAULT_NOISE_TIME_SLOT } from "@/lib/map/noise-time"
import { locationContextFromAnalyse } from "@/lib/voice/location-context"
import type { GeocodeResult } from "@/lib/server/geocode-types"
import {
  getMapStyle,
  LONDON_BOUNDS,
  LONDON_VIEWPORT,
  MAP_CONFIG,
} from "@/lib/map/config"
import { registerNightlifeEmojiImages } from "@/lib/map/nightlife-emoji-images"
import { cn } from "@/lib/utils"

import "maplibre-gl/dist/maplibre-gl.css"
import "@/components/map/map-controls.css"

const LOGO_PATH = "/ssh.ldn logo.svg"
const LIVE_DEMO_URL = "https://sshldn.vercel.app"
const GITHUB_REPO_URL = "https://github.com/ghcpuman902/ssh.ldn"
const SEARCH_RESULT_ZOOM = 15

type ScoreResponse = {
  noiseScore: number
  noiseBand: string
  confidenceScore: number
  confidenceBand: string
  dominantSources: string[]
  contributors: { source: string; weight: number; score: number }[]
  timeProfile: { day: number; evening: number; night: number }
  caveats: string[]
  recommendedChecks: string[]
}

const resolveMapTheme = (resolvedTheme: string | undefined): MapTheme =>
  resolvedTheme === "dark" ? "dark" : "light"

export const MapShell = () => {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState<NoiseLayerVisibility>(
    DEFAULT_NOISE_LAYER_VISIBILITY
  )
  const [timeSlot, setTimeSlot] = useState(DEFAULT_NOISE_TIME_SLOT)
  const [mapReady, setMapReady] = useState(false)
  const [analyseState, setAnalyseState] = useState<AnalyseState>({
    status: "idle",
  })
  const [isSearching, setIsSearching] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const mapRef = useRef<MapRef>(null)
  const { clipContainerRef, mapWindowRef, logoRef, updateClip } =
    useMapWindowClip()
  const applyZoomControlStyles = useMapZoomControlStyles(mapRef)
  const nightlifeGeoJson = useViewportNightlifeGeoJson(mapRef, mounted && mapReady)
  const mapTheme = resolveMapTheme(resolvedTheme)
  const { mixPercentages } = useCursorNoise({
    mapRef,
    nightlifeGeoJson,
    timeSlot,
    layerVisibility,
    enabled: mounted && audioEnabled,
  })

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

    const map = mapRef.current?.getMap()
    if (!map) return

    const register = () => registerNightlifeEmojiImages(map)

    if (map.isStyleLoaded()) {
      register()
      return
    }

    map.once("styledata", register)
  }, [mounted, mapTheme])

  const handleSearch = useCallback(
    async ({ address, testPointId }: MapSearchSelection) => {
      setSearchQuery(address)
      setSearchExpanded(true)
      setIsSearching(true)
      setAnalyseState({ status: "loading", address })

      try {
        const geocodeParams = new URLSearchParams()

        if (testPointId) {
          geocodeParams.set("testPointId", testPointId)
        } else {
          geocodeParams.set("address", address)
        }

        const geocodeResponse = await fetch(
          `/api/discovery/geocode?${geocodeParams.toString()}`
        )
        const geocodeData = (await geocodeResponse.json()) as
          | GeocodeResult
          | { error: string }

        if (!geocodeResponse.ok || "error" in geocodeData) {
          throw new Error(
            "error" in geocodeData ? geocodeData.error : "Geocoding failed"
          )
        }

        setSelectedLocation({
          latitude: geocodeData.latitude,
          longitude: geocodeData.longitude,
        })

        mapRef.current?.flyTo({
          center: [geocodeData.longitude, geocodeData.latitude],
          zoom: SEARCH_RESULT_ZOOM,
          duration: 1200,
        })

        const scoreParams = new URLSearchParams({
          timeSlot: String(timeSlot),
        })

        if (testPointId ?? geocodeData.testPointId) {
          scoreParams.set(
            "testPointId",
            testPointId ?? geocodeData.testPointId ?? ""
          )
        } else {
          scoreParams.set("lat", String(geocodeData.latitude))
          scoreParams.set("lng", String(geocodeData.longitude))
        }

        let score: ScoreResponse | null = null
        let scoreError: string | undefined

        try {
          const scoreResponse = await fetch(
            `/api/score?${scoreParams.toString()}`
          )
          const scoreData = (await scoreResponse.json()) as
            | ScoreResponse
            | { error: string }

          if (scoreResponse.ok && !("error" in scoreData)) {
            score = scoreData
          } else {
            scoreError =
              "error" in scoreData ? scoreData.error : "Score unavailable"
          }
        } catch {
          scoreError = "Score unavailable"
        }

        setAnalyseState({
          status: "ready",
          address,
          geocode: geocodeData,
          score,
          scoreError,
        })
      } catch (error) {
        setAnalyseState({
          status: "error",
          address,
          message:
            error instanceof Error ? error.message : "Search failed unexpectedly",
        })
      } finally {
        setIsSearching(false)
      }
    },
    [timeSlot]
  )

  const handleCloseAnalyse = useCallback(() => {
    setAnalyseState({ status: "idle" })
  }, [])

  const analyseOpen = analyseState.status !== "idle"
  const voiceContext = useMemo(() => {
    if (analyseState.status !== "ready") {
      return null
    }

    return locationContextFromAnalyse(analyseState, timeSlot)
  }, [analyseState, timeSlot])

  const searchBarProps = {
    onSearch: handleSearch,
    isSearching,
    query: searchQuery,
    onQueryChange: setSearchQuery,
    expanded: searchExpanded,
    onExpandedChange: setSearchExpanded,
  }

  useEffect(() => {
    if (!mounted) return

    updateClip()
    mapRef.current?.resize()
  }, [analyseOpen, mounted, updateClip])

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
        className={cn(
          "flex h-full min-h-0",
          analyseOpen && "gap-3 md:gap-4"
        )}
      >
        <div
          ref={mapWindowRef}
          data-map-window
          className="relative z-0 min-w-0 flex-1 transition-[flex] duration-300 ease-out"
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
                const map = mapRef.current?.getMap()
                if (map) registerNightlifeEmojiImages(map)
                setMapReady(true)
                updateClip()
                mapRef.current?.resize()
                applyZoomControlStyles()
              }}
            >
              <NoiseMapLayers
                visibility={layerVisibility}
                timeSlot={timeSlot}
                nightlifeGeoJson={nightlifeGeoJson}
              />
              {selectedLocation ? (
                <Marker
                  longitude={selectedLocation.longitude}
                  latitude={selectedLocation.latitude}
                  anchor="bottom"
                >
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary text-sm shadow-md"
                  >
                    📍
                  </span>
                </Marker>
              ) : null}
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

          <div className="pointer-events-none absolute inset-0 z-10">
            <div
              ref={logoRef}
              className="pointer-events-auto absolute left-4 top-4 flex w-fit flex-col gap-1 pr-4 pb-3 md:left-5 md:top-5 md:pr-5 md:pb-3.5"
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <span
                  aria-hidden
                  className="text-[1.3lh] leading-none translate-y-1"
                  style={{
                    textBoxTrim: "trim-both",
                    textBoxEdge: "cap alphabetic",
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
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-none text-muted-foreground md:text-xs">
                <span>Londonmaxxing 003</span>
                <span aria-hidden>·</span>
                <a
                  href={LIVE_DEMO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  sshldn.vercel.app
                </a>
                <span aria-hidden>·</span>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  GitHub
                </a>
              </p>
            </div>

            <div
              className={cn(
                "pointer-events-auto absolute right-4 top-4 z-20 transition-[opacity,transform] duration-300 ease-out md:right-5 md:top-5",
                analyseOpen
                  ? "pointer-events-none translate-x-3 opacity-0"
                  : "translate-x-0 opacity-100"
              )}
            >
              <MapSearchBar
                variant="floating"
                instanceId="floating"
                {...searchBarProps}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-24 right-4 w-fit max-w-[calc(100%-2rem)] md:bottom-28 md:right-5">
              <NoiseLayerControls
                visibility={layerVisibility}
                timeSlot={timeSlot}
                onVisibilityChange={setLayerVisibility}
                onTimeSlotChange={setTimeSlot}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-8 left-4 z-20 w-fit md:bottom-10 md:left-5">
              <MapNoiseAudioToggle
                enabled={audioEnabled}
                mixPercentages={mixPercentages}
                onEnabledChange={setAudioEnabled}
              />
            </div>

            <div className="pointer-events-auto absolute inset-x-4 bottom-0 z-20 flex h-4 items-center md:inset-x-5 md:h-5">
              <MapDataCredits />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex h-full shrink-0 flex-col transition-[width,opacity] duration-300 ease-out",
            analyseOpen
              ? "w-[min(100%,20rem)] overflow-visible opacity-100"
              : "pointer-events-none w-0 overflow-hidden opacity-0"
          )}
        >
          <div
            className={cn(
              "relative z-30 w-[min(100%,20rem)] shrink-0 pb-3 transition-[opacity,transform] duration-300 ease-out",
              analyseOpen
                ? "translate-x-0 opacity-100"
                : "pointer-events-none translate-x-3 opacity-0"
            )}
          >
            <MapSearchBar variant="docked" instanceId="docked" {...searchBarProps} />
          </div>

          <MapAnalysePanel state={analyseState} onClose={handleCloseAnalyse} />

          {analyseOpen ? (
            <div className="px-4 pt-3 pb-4">
              <VoiceModeButton context={voiceContext} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
