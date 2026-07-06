"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import Map, {
  Marker,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { useCursorNoise } from "@/hooks/use-cursor-noise"
import { useMapWindowClip } from "@/hooks/use-map-window-clip"
import { useMapZoomControlStyles } from "@/hooks/use-map-zoom-control-styles"
import { useIsMobile } from "@/hooks/use-mobile"
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
import { VisualMapLayers } from "@/components/map/visual-map-layers"
import { useVisualLayerData } from "@/hooks/use-visual-layer-data"
import type { MapTheme } from "@/lib/map/config"
import {
  DEFAULT_NOISE_TIME_SLOT,
  getCurrentNoiseTimeSlot,
} from "@/lib/map/noise-time"
import { locationContextFromAnalyse } from "@/lib/voice/location-context"
import { estimateClientNoiseScore } from "@/lib/map/client-noise-score"
import {
  fetchNearbyNoisyPois,
  getNoisyPoiStyle,
  type NearbyNoisyPoiSummary,
} from "@/lib/map/google-nearby-noisy-poi"
import type { GeocodeResult } from "@/lib/server/geocode-types"
import {
  getMapPixelRatio,
  getMapStyle,
  LONDON_BOUNDS,
  LONDON_VIEWPORT,
  MAP_CONFIG,
} from "@/lib/map/config"
import {
  bindNightlifeEmojiImages,
  refreshNightlifeEmojiImages,
} from "@/lib/map/nightlife-emoji-images"
import {
  DEFAULT_VISUAL_LAYER_VISIBILITY,
  type VisualLayerVisibility,
} from "@/lib/map/visual-layers"
import { cn } from "@/lib/utils"

import "maplibre-gl/dist/maplibre-gl.css"
import "@/components/map/map-controls.css"

const LOGO_PATH = "/ssh.ldn logo.svg"
const SEARCH_RESULT_ZOOM = 15
const PANEL_WIDTH = "26rem"
const PANEL_TRANSITION_MS = 300

type PlanningApplicationResponse = {
  applicationId: string | null
  reference: string | null
  description: string | null
  status: string | null
  decisionType: string | null
  applicationTypeFull: string | null
  developmentType: string | null
  decisionDate: string | null
  distanceMeters: number | null
  planningAuthority: string | null
  url: string | null
  linkKind: "direct" | "entity" | "portal" | null
}

const resolveMapTheme = (resolvedTheme: string | undefined): MapTheme =>
  resolvedTheme === "dark" ? "dark" : "light"

export const MapShell = () => {
  const { resolvedTheme } = useTheme()
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState<NoiseLayerVisibility>(
    DEFAULT_NOISE_LAYER_VISIBILITY
  )
  const [visualLayerVisibility, setVisualLayerVisibility] =
    useState<VisualLayerVisibility>(DEFAULT_VISUAL_LAYER_VISIBILITY)
  const [timeSlot, setTimeSlot] = useState(DEFAULT_NOISE_TIME_SLOT)
  const [mapReady, setMapReady] = useState(false)
  const [analyseState, setAnalyseState] = useState<AnalyseState>({
    status: "idle",
  })
  const [isSearching, setIsSearching] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchExpanded, setSearchExpanded] = useState(false)
  const audioToggleEventsRef = useRef<number[]>([])
  const audioHelpShownRef = useRef(false)
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [isPickingLocation, setIsPickingLocation] = useState(false)
  const [hoveredNoisyPoiId, setHoveredNoisyPoiId] = useState<string | null>(null)
  const [focusedNoisyPoiId, setFocusedNoisyPoiId] = useState<string | null>(null)
  const mapRef = useRef<MapRef>(null)
  const latestRequestIdRef = useRef(0)
  const {
    clipContainerRef,
    mapWindowRef,
    logoRef,
    updateClip,
    syncClipDuringTransition,
  } = useMapWindowClip()
  const layoutGridRef = useRef<HTMLDivElement>(null)
  const applyZoomControlStyles = useMapZoomControlStyles(mapRef)
  const nightlifeGeoJson = useViewportNightlifeGeoJson(mapRef, mounted && mapReady)
  const visualLayerData = useVisualLayerData(
    mapRef,
    mounted && mapReady,
    visualLayerVisibility
  )
  const mapTheme = resolveMapTheme(resolvedTheme)
  const audioSampleMode = isMobile ? "center" : "cursor"
  const { intensityPercentages, localAmenityPercentages } = useCursorNoise({
    mapRef,
    nightlifeGeoJson,
    timeSlot,
    layerVisibility,
    samplingEnabled: mounted && mapReady,
    audioEnabled: mounted && audioEnabled,
    sampleMode: audioSampleMode,
  })

  useEffect(() => {
    setMounted(true)
    setTimeSlot(getCurrentNoiseTimeSlot())
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

    bindNightlifeEmojiImages(map)
  }, [mounted, mapTheme])

  useEffect(() => {
    if (!nightlifeGeoJson?.features.length) return

    const map = mapRef.current?.getMap()
    if (!map) return

    refreshNightlifeEmojiImages(map)
  }, [nightlifeGeoJson])

  const handleSearch = useCallback(
    async ({ address, resolvedGeocode }: MapSearchSelection) => {
      const requestId = ++latestRequestIdRef.current
      const isStale = () => latestRequestIdRef.current !== requestId

      setSearchQuery(address)
      setSearchExpanded(true)
      setIsSearching(true)

      if (resolvedGeocode) {
        setSelectedLocation({
          latitude: resolvedGeocode.latitude,
          longitude: resolvedGeocode.longitude,
        })
        mapRef.current?.flyTo({
          center: [resolvedGeocode.longitude, resolvedGeocode.latitude],
          zoom: SEARCH_RESULT_ZOOM,
          duration: 1200,
        })
      }

      setAnalyseState({
        status: "analysing",
        address,
        geocode: resolvedGeocode
          ? { status: "done", data: resolvedGeocode }
          : { status: "running" },
        score: resolvedGeocode ? { status: "running" } : { status: "queued" },
        planning: resolvedGeocode ? { status: "running" } : { status: "queued" },
        noisyPois: resolvedGeocode ? { status: "running" } : { status: "queued" },
      })
      setHoveredNoisyPoiId(null)
      setFocusedNoisyPoiId(null)

      const patchAnalyse = (
        patch: Partial<
          Pick<
            Extract<AnalyseState, { status: "analysing" }>,
            "geocode" | "score" | "planning" | "noisyPois"
          >
        >
      ) => {
        if (isStale()) return

        setAnalyseState((current) =>
          current.status === "analysing" ? { ...current, ...patch } : current
        )
      }

      const focusLocation = (latitude: number, longitude: number) => {
        setSelectedLocation({ latitude, longitude })
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: SEARCH_RESULT_ZOOM,
          duration: 1200,
        })
      }

      const runInstantScoreTask = async (latitude: number, longitude: number) => {
        patchAnalyse({ score: { status: "running" } })

        try {
          const zoom = mapRef.current?.getMap()?.getZoom() ?? SEARCH_RESULT_ZOOM
          const scoreData = await estimateClientNoiseScore({
            latitude,
            longitude,
            zoom,
            timeSlot,
            nightlifeGeoJson,
          })

          if (isStale()) return

          patchAnalyse({ score: { status: "done", data: scoreData } })
        } catch (error) {
          patchAnalyse({
            score: {
              status: "failed",
              message:
                error instanceof Error ? error.message : "Score unavailable",
            },
          })
        }
      }

      const runNoisyPoiTask = async (latitude: number, longitude: number) => {
        patchAnalyse({ noisyPois: { status: "running" } })

        try {
          const noisyPois = await fetchNearbyNoisyPois({ latitude, longitude })

          if (isStale()) return

          patchAnalyse({ noisyPois: { status: "done", data: noisyPois } })
        } catch (error) {
          patchAnalyse({
            noisyPois: {
              status: "failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Nearby venue lookup unavailable",
            },
          })
        }
      }

      const runPlanningTask = async (latitude: number, longitude: number) => {
        patchAnalyse({ planning: { status: "running" } })

        try {
          const planningParams = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
          })
          const planningResponse = await fetch(
            `/api/planning/nearby?${planningParams.toString()}`
          )
          const planningData = (await planningResponse.json()) as
            | { planningApplications: PlanningApplicationResponse[] }
            | { error: string }

          if (!planningResponse.ok || "error" in planningData) {
            throw new Error(
              "error" in planningData
                ? planningData.error
                : "Planning applications unavailable"
            )
          }

          if (isStale()) return

          patchAnalyse({
            planning: {
              status: "done",
              data: planningData.planningApplications,
            },
          })
        } catch (error) {
          patchAnalyse({
            planning: {
              status: "failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Planning applications unavailable",
            },
          })
        }
      }

      const runGeocodeTask = async () => {
        patchAnalyse({ geocode: { status: "running" } })

        try {
          const geocodeParams = new URLSearchParams({ address })

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

          if (isStale()) return null

          focusLocation(geocodeData.latitude, geocodeData.longitude)
          patchAnalyse({ geocode: { status: "done", data: geocodeData } })
          return geocodeData
        } catch (error) {
          patchAnalyse({
            geocode: {
              status: "failed",
              message:
                error instanceof Error ? error.message : "Geocoding failed",
            },
          })
          return null
        }
      }

      try {
        if (resolvedGeocode) {
          await Promise.all([
            runInstantScoreTask(
              resolvedGeocode.latitude,
              resolvedGeocode.longitude
            ),
            runPlanningTask(
              resolvedGeocode.latitude,
              resolvedGeocode.longitude
            ),
            runNoisyPoiTask(
              resolvedGeocode.latitude,
              resolvedGeocode.longitude
            ),
          ])
        } else {
          const geocodeResult = await runGeocodeTask()

          if (isStale()) return

          if (geocodeResult) {
            void runInstantScoreTask(
              geocodeResult.latitude,
              geocodeResult.longitude
            )
            void runPlanningTask(
              geocodeResult.latitude,
              geocodeResult.longitude
            )
            void runNoisyPoiTask(
              geocodeResult.latitude,
              geocodeResult.longitude
            )
          } else {
            patchAnalyse({
              score: {
                status: "failed",
                message: "Waiting for a valid location before scoring",
              },
              planning: {
                status: "failed",
                message: "Waiting for a valid location before planning lookup",
              },
              noisyPois: {
                status: "failed",
                message: "Waiting for a valid location before venue lookup",
              },
            })
          }
        }
      } finally {
        if (!isStale()) {
          setIsSearching(false)
        }
      }
    },
    [nightlifeGeoJson, timeSlot]
  )

  const handleCloseAnalyse = useCallback(() => {
    latestRequestIdRef.current += 1
    setAnalyseState({ status: "idle" })
    setSelectedLocation(null)
    setIsSearching(false)
    setHoveredNoisyPoiId(null)
    setFocusedNoisyPoiId(null)
  }, [])

  const handleNoisyPoiFocus = useCallback((poi: NearbyNoisyPoiSummary) => {
    setFocusedNoisyPoiId((current) =>
      current === poi.placeId ? null : poi.placeId
    )
  }, [])

  const handleMapLocationPicked = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const params = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
        })
        const response = await fetch(
          `/api/discovery/geocode/reverse?${params.toString()}`
        )
        const data = (await response.json()) as GeocodeResult | { error: string }

        if (!response.ok || "error" in data) {
          throw new Error(
            "error" in data ? data.error : "Reverse geocoding failed"
          )
        }

        await handleSearch({
          address: data.normalizedAddress,
          resolvedGeocode: data,
        })
      } catch {
        const fallbackAddress = `Dropped pin (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
        const fallbackGeocode: GeocodeResult = {
          inputAddress: fallbackAddress,
          normalizedAddress: fallbackAddress,
          latitude,
          longitude,
          postcode: null,
          coordinatePrecision: "unknown",
          geocoderName: "map-pin-drop",
          geocoderConfidence: "low",
          source: "map-pin-drop",
          sourceEndpoint: "client-side map click",
          retrievedAt: new Date().toISOString(),
          sourceLicence: "n/a",
          warnings: ["Reverse geocoding failed; using dropped pin coordinates."],
          rawResponse: null,
        }

        await handleSearch({
          address: fallbackAddress,
          resolvedGeocode: fallbackGeocode,
        })
      }
    },
    [handleSearch]
  )

  const handleSelectFromMap = useCallback(() => {
    setIsPickingLocation(true)
    toast.info("Click anywhere on the map to select that location.", {
      id: "map-pick-location-hint",
      duration: 6000,
    })
  }, [])

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!isPickingLocation) return

      const { lat, lng } = event.lngLat
      setIsPickingLocation(false)
      toast.dismiss("map-pick-location-hint")
      void handleMapLocationPicked(lat, lng)
    },
    [handleMapLocationPicked, isPickingLocation]
  )

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    map.getCanvas().style.cursor = isPickingLocation ? "crosshair" : ""
  }, [isPickingLocation, mapReady])

  useEffect(() => {
    if (!isPickingLocation) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return

      setIsPickingLocation(false)
      toast.dismiss("map-pick-location-hint")
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isPickingLocation])

  const showMobileAudioHelp = useCallback(
    (reason: "start" | "frustration") => {
      if (!isMobile) return

      toast.info(
        reason === "start"
          ? "Sound samples the map centre now — pan until the crosshair sits over the place you want to hear."
          : "If you still cannot hear it, check media volume, Silent Mode / ring switch, and Bluetooth output.",
        {
          id: reason === "start" ? "mobile-audio-center-help" : "mobile-audio-device-help",
          duration: reason === "start" ? 4200 : 7000,
        }
      )
    },
    [isMobile]
  )

  const handleAudioEnabledChange = useCallback(
    (nextEnabled: boolean) => {
      setAudioEnabled(nextEnabled)

      if (!isMobile) return

      const now = Date.now()
      audioToggleEventsRef.current = [
        ...audioToggleEventsRef.current.filter((time) => now - time < 18_000),
        now,
      ]

      if (nextEnabled && !audioHelpShownRef.current) {
        audioHelpShownRef.current = true
        showMobileAudioHelp("start")
      }

      if (audioToggleEventsRef.current.length >= 4) {
        showMobileAudioHelp("frustration")
        audioToggleEventsRef.current = []
      }
    },
    [isMobile, showMobileAudioHelp]
  )

  const analyseOpen = analyseState.status !== "idle"
  const noisyPois = useMemo(
    () =>
      analyseState.status === "analysing" &&
      analyseState.noisyPois.status === "done"
        ? analyseState.noisyPois.data
        : [],
    [analyseState]
  )
  const voiceContext = useMemo(() => {
    if (analyseState.status !== "analysing") {
      return null
    }

    if (analyseState.geocode.status !== "done") {
      return null
    }

    return locationContextFromAnalyse(analyseState, timeSlot)
  }, [analyseState, timeSlot])

  const searchBarProps = {
    onSearch: handleSearch,
    onSelectFromMap: handleSelectFromMap,
    isSearching,
    query: searchQuery,
    onQueryChange: setSearchQuery,
    expanded: searchExpanded,
    onExpandedChange: setSearchExpanded,
  }

  useEffect(() => {
    if (!mounted) return

    return syncClipDuringTransition(PANEL_TRANSITION_MS, () => {
      mapRef.current?.resize()
    })
  }, [analyseOpen, mounted, syncClipDuringTransition])

  useEffect(() => {
    const grid = layoutGridRef.current
    if (!grid || !mounted) return

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== grid) return
      if (event.propertyName !== "grid-template-columns") return

      updateClip()
      mapRef.current?.resize()
    }

    grid.addEventListener("transitionend", handleTransitionEnd)

    return () => grid.removeEventListener("transitionend", handleTransitionEnd)
  }, [mounted, updateClip])

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
          "pointer-events-auto absolute z-50 max-md:hidden",
          "transition-[width,top,right] duration-300 ease-in-out",
          analyseOpen
            ? "top-4 right-4 w-104 md:top-5 md:right-5"
            : "top-2 right-2 w-fit md:top-7.5 md:right-7.5"
        )}
      >
        <MapSearchBar
          variant={analyseOpen ? "docked" : "floating"}
          instanceId="desktop"
          {...searchBarProps}
        />
      </div>

      <div
        ref={layoutGridRef}
        className={cn(
          "grid h-full min-h-0 grid-cols-1",
          "md:transition-[grid-template-columns,gap] md:duration-300 md:ease-in-out",
          analyseOpen
            ? "md:grid-cols-[minmax(0,1fr)_var(--map-panel-width)] md:gap-4"
            : "md:grid-cols-[minmax(0,1fr)_0px] md:gap-0"
        )}
        style={{ "--map-panel-width": PANEL_WIDTH } as CSSProperties}
      >
        <div
          ref={mapWindowRef}
          data-map-window
          className="relative z-0 min-h-0 min-w-0"
        >
          <div
            ref={clipContainerRef}
            className={cn(
              "absolute inset-0",
              audioEnabled && "map-noise-sampling"
            )}
          >
            <Map
              ref={mapRef}
              initialViewState={LONDON_VIEWPORT}
              mapStyle={getMapStyle(mapTheme)}
              minZoom={MAP_CONFIG.minZoom}
              maxZoom={MAP_CONFIG.maxZoom}
              maxBounds={LONDON_BOUNDS}
              pixelRatio={getMapPixelRatio()}
              style={{ width: "100%", height: "100%" }}
              attributionControl={false}
              reuseMaps
              onClick={handleMapClick}
              onLoad={() => {
                const map = mapRef.current?.getMap()
                if (map) {
                  bindNightlifeEmojiImages(map)
                  if (process.env.NODE_ENV === "development") {
                    ;(
                      window as Window & {
                        __sshMap?: ReturnType<MapRef["getMap"]>
                      }
                    ).__sshMap = map
                  }
                }
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
              <VisualMapLayers
                visibility={visualLayerVisibility}
                data={visualLayerData}
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
              {noisyPois.map((poi, index) => {
                const isHighlighted =
                  hoveredNoisyPoiId === poi.placeId ||
                  focusedNoisyPoiId === poi.placeId
                const style = getNoisyPoiStyle(poi.primaryType, poi.categoryLabel)

                return (
                  <Marker
                    key={poi.placeId}
                    longitude={poi.longitude}
                    latitude={poi.latitude}
                    anchor="center"
                  >
                    <button
                      type="button"
                      aria-label={`Highlight ${poi.name} on the map, ${poi.distanceMeters}m away`}
                      aria-pressed={focusedNoisyPoiId === poi.placeId}
                      onMouseEnter={(event) => {
                        event.stopPropagation()
                        setHoveredNoisyPoiId(poi.placeId)
                      }}
                      onMouseLeave={(event) => {
                        event.stopPropagation()
                        setHoveredNoisyPoiId(null)
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleNoisyPoiFocus(poi)
                      }}
                      className={cn(
                        "relative flex size-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-md transition-transform duration-150 ease-out hover:scale-115 active:scale-95",
                        isHighlighted && "z-10 scale-125"
                      )}
                      style={{ backgroundColor: style.color }}
                    >
                      {focusedNoisyPoiId === poi.placeId ? (
                        <span
                          aria-hidden
                          className="motion-safe:animate-ping absolute inset-0 rounded-full opacity-75"
                          style={{ backgroundColor: style.color }}
                        />
                      ) : null}
                      <span className="relative">{index + 1}</span>
                    </button>
                  </Marker>
                )
              })}
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
            {isMobile && audioEnabled ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              >
                <span className="absolute h-px w-9 rounded-full bg-foreground/80 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
                <span className="absolute h-9 w-px rounded-full bg-foreground/80 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
                <span className="size-2 rounded-full border border-white bg-primary shadow-sm" />
              </div>
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-0 z-10">
            <div
              ref={logoRef}
              className="pointer-events-auto absolute left-0 top-0 flex w-fit flex-col items-center gap-1 pb-3 pr-4 text-center md:pb-3.5 md:pr-5"
            >
              <div className="flex items-center justify-center gap-1.5 md:gap-2">
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
              <p className="text-[10px] leading-none text-muted-foreground md:text-xs">
                London Noise Map by{" "}
                <a
                  href="https://x.com/manglekuo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  @manglekuo
                </a>
              </p>
            </div>

            <div
              className={cn(
                "pointer-events-auto absolute right-4 top-4 z-20 md:hidden",
                analyseOpen && "pointer-events-none opacity-0"
              )}
            >
              <MapSearchBar
                variant="floating"
                instanceId="mobile-floating"
                {...searchBarProps}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-24 right-2 w-fit max-w-[calc(100%-2rem)] md:bottom-28 md:right-2.5">
              <NoiseLayerControls
                visibility={layerVisibility}
                visualVisibility={visualLayerVisibility}
                timeSlot={timeSlot}
                intensityPercentages={intensityPercentages}
                localAmenityPercentages={localAmenityPercentages}
                audioEnabled={audioEnabled}
                audioSampleMode={audioSampleMode}
                onVisibilityChange={setLayerVisibility}
                onVisualVisibilityChange={setVisualLayerVisibility}
                onTimeSlotChange={setTimeSlot}
                onAudioEnabledChange={handleAudioEnabledChange}
              />
            </div>

            <div className="pointer-events-auto absolute inset-x-4 bottom-0 z-20 flex h-4 items-center md:inset-x-5 md:h-5">
              <MapDataCredits />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden",
            "fixed inset-x-3 bottom-3 z-40 max-h-[82svh] transition-[transform,opacity] duration-300 ease-out",
            "md:static md:inset-auto md:z-auto md:h-full md:max-h-none md:overflow-hidden md:transition-none",
            analyseOpen
              ? "translate-y-0 opacity-100 md:pointer-events-auto"
              : "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0 md:translate-y-0 md:opacity-100 md:pointer-events-none"
          )}
        >
          <div className="shrink-0 pb-3 md:hidden">
            <MapSearchBar
              variant="docked"
              instanceId="mobile-docked"
              {...searchBarProps}
            />
          </div>

          <div aria-hidden className="hidden h-14 shrink-0 md:block" />

          <MapAnalysePanel
            state={analyseState}
            onClose={handleCloseAnalyse}
            focusedNoisyPoiId={focusedNoisyPoiId}
            onNoisyPoiHover={setHoveredNoisyPoiId}
            onNoisyPoiFocus={handleNoisyPoiFocus}
          />

          {analyseOpen ? (
            <div className="shrink-0 px-0 pt-3">
              <VoiceModeButton context={voiceContext} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
