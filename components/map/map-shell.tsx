"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import dynamic from "next/dynamic"
import Map, {
  Marker,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { useCursorNoise } from "@/hooks/use-cursor-noise"
import { useMapLongPress } from "@/hooks/use-map-long-press"
import { useMapTypeToSearch } from "@/hooks/use-map-type-to-search"
import { useMapWindowClip } from "@/hooks/use-map-window-clip"
import { useMapZoomControlStyles } from "@/hooks/use-map-zoom-control-styles"
import { useIsMobile } from "@/hooks/use-mobile"
import { useShiftDragRotate } from "@/hooks/use-shift-drag-rotate"
import { useViewportNightlifeGeoJson } from "@/hooks/use-viewport-nightlife-geojson"
import { useNoiseReveal } from "@/hooks/use-noise-reveal"
import type { AnalyseState } from "@/components/map/map-analyse-panel"
// Voice mode is temporarily unwired so ElevenLabs stays off the map load path.
// import { VoiceModeButton } from "@/components/map/voice-mode-button"
import { NoiseMapLayers } from "@/components/map/noise-map-layers"
import { MapDataCredits } from "@/components/map/map-data-credits"
import { MapSearchBar, type MapSearchBarHandle, type MapSearchSelection } from "@/components/map/map-search-bar"
import { NoiseLayerControls } from "@/components/map/noise-layer-controls"
import { VisualMapLayers } from "@/components/map/visual-map-layers"
import { useVisualLayerData } from "@/hooks/use-visual-layer-data"
import type { MapTheme } from "@/lib/map/config"
import { buildGeocodeResultFromCoordinates } from "@/lib/map/build-geocode-result"
import {
  DEFAULT_NOISE_TIME_SLOT,
  decodeNoiseTimeSlot,
  encodeNoiseTimeSlot,
  getCurrentNoiseTimeSlot,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time"
// import { locationContextFromAnalyse } from "@/lib/voice/location-context"
// import { isVoiceModeEnabledClient } from "@/lib/voice/voice-mode"
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
  isWithinLondonBounds,
  LONDON_BOUNDS,
  LONDON_VIEWPORT,
  MAP_CONFIG,
} from "@/lib/map/config"
import {
  bindNightlifeEmojiImages,
  refreshNightlifeEmojiImages,
} from "@/lib/map/nightlife-emoji-images"
import {
  readNoiseLayerVisibility,
  readVisualLayerVisibility,
  writeNoiseLayerVisibility,
  writeVisualLayerVisibility,
} from "@/lib/map/layer-visibility-storage"
import { cn } from "@/lib/utils"

import "maplibre-gl/dist/maplibre-gl.css"
import "@/components/map/map-controls.css"

const MapAnalysePanel = dynamic(
  () =>
    import("@/components/map/map-analyse-panel").then((mod) => mod.MapAnalysePanel),
  { ssr: false }
)

const MapAnalyseSheet = dynamic(
  () =>
    import("@/components/map/map-analyse-sheet").then((mod) => mod.MapAnalyseSheet),
  { ssr: false }
)

const SEARCH_RESULT_ZOOM = 15
const PANEL_WIDTH = "26rem"
const PANEL_TRANSITION_MS = 300
/** Wait after nightlife settles before warming visual layers. */
const VISUAL_PREFETCH_SETTLE_MS = 400
/** If nightlife never settles, still warm visual layers after this. */
const VISUAL_PREFETCH_FALLBACK_MS = 3500

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

const parseShareCoordinates = (latParam: string | null, lngParam: string | null) => {
  if (latParam === null || lngParam === null) {
    return null
  }

  const latitude = Number(latParam)
  const longitude = Number(lngParam)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return { latitude, longitude }
}

const buildShareQuery = ({
  address,
  latitude,
  longitude,
  timeSlot,
}: {
  address: string
  latitude: number
  longitude: number
  timeSlot: NoiseTimeSlot
}) => {
  const params = new URLSearchParams()
  params.set("address", address)
  params.set("lat", latitude.toFixed(6))
  params.set("lng", longitude.toFixed(6))
  params.set("timeSlot", encodeNoiseTimeSlot(timeSlot))
  return params.toString()
}

const getShareSearchParams = () =>
  new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)

const replaceShareUrl = (query: string) => {
  if (typeof window === "undefined") return

  const nextUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname
  const currentUrl = `${window.location.pathname}${window.location.search}`

  if (currentUrl === nextUrl) return

  window.history.replaceState(window.history.state, "", nextUrl)
}

export const MapShell = () => {
  const { resolvedTheme } = useTheme()
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState(readNoiseLayerVisibility)
  const [visualLayerVisibility, setVisualLayerVisibility] =
    useState(readVisualLayerVisibility)
  const [timeSlot, setTimeSlot] = useState(DEFAULT_NOISE_TIME_SLOT)
  const [mapReady, setMapReady] = useState(false)
  const [mapHasIdled, setMapHasIdled] = useState(false)
  const [backgroundPrefetchReady, setBackgroundPrefetchReady] = useState(false)
  const [analyseState, setAnalyseState] = useState<AnalyseState>({
    status: "idle",
  })
  const [isSearching, setIsSearching] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchExpanded, setSearchExpanded] = useState(false)
  const desktopSearchRef = useRef<MapSearchBarHandle>(null)
  const mobileFloatingSearchRef = useRef<MapSearchBarHandle>(null)
  const mobileDockedSearchRef = useRef<MapSearchBarHandle>(null)
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
  const hasHydratedFromUrlRef = useRef(false)
  const isRestoringFromUrlRef = useRef(false)
  const {
    clipContainerRef,
    mapWindowRef,
    logoRef,
    updateClip,
    syncClipDuringTransition,
  } = useMapWindowClip()
  const layoutGridRef = useRef<HTMLDivElement>(null)
  const applyZoomControlStyles = useMapZoomControlStyles(mapRef)
  const noiseReveal = useNoiseReveal(mapRef, mounted && mapReady)
  const {
    geoJson: nightlifeGeoJson,
    isFetching: nightlifeIsFetching,
    hasSettledInitial: nightlifeHasSettledInitial,
  } = useViewportNightlifeGeoJson(
    mapRef,
    mounted && mapReady && noiseReveal.stage === "complete"
  )
  const visualLayerData = useVisualLayerData(
    mapRef,
    mounted,
    visualLayerVisibility,
    {
      backgroundPrefetch: backgroundPrefetchReady,
      lineUpgrade: noiseReveal.lineUpgrade,
    }
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
    writeNoiseLayerVisibility(layerVisibility)
  }, [layerVisibility])

  useEffect(() => {
    writeVisualLayerVisibility(visualLayerVisibility)
  }, [visualLayerVisibility])

  // Quiet-gated visual prefetch: wait until nightlife has settled (or timeout)
  // so background OSM/transit fetches do not race the critical cold-open path.
  useEffect(() => {
    if (!mapHasIdled || backgroundPrefetchReady) return

    let settleTimer: number | undefined
    const fallbackTimer = window.setTimeout(() => {
      setBackgroundPrefetchReady(true)
    }, VISUAL_PREFETCH_FALLBACK_MS)

    if (nightlifeHasSettledInitial && !nightlifeIsFetching) {
      settleTimer = window.setTimeout(() => {
        setBackgroundPrefetchReady(true)
      }, VISUAL_PREFETCH_SETTLE_MS)
    }

    return () => {
      window.clearTimeout(fallbackTimer)
      if (settleTimer !== undefined) window.clearTimeout(settleTimer)
    }
  }, [
    backgroundPrefetchReady,
    mapHasIdled,
    nightlifeHasSettledInitial,
    nightlifeIsFetching,
  ])

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
    [nightlifeGeoJson]
  )

  const handleCloseAnalyse = useCallback(() => {
    latestRequestIdRef.current += 1
    setAnalyseState({ status: "idle" })
    setSelectedLocation(null)
    setIsSearching(false)
    setHoveredNoisyPoiId(null)
    setFocusedNoisyPoiId(null)
    setSearchQuery("")
    setSearchExpanded(false)
    // Clear share params immediately so dismiss does not wait on the sync effect.
    if (getShareSearchParams().toString().length > 0) {
      replaceShareUrl("")
    }
  }, [])

  const urlAddress =
    analyseState.status === "analysing" ? analyseState.address : null
  const urlLatitude =
    analyseState.status === "analysing" &&
    analyseState.geocode.status === "done"
      ? analyseState.geocode.data.latitude
      : null
  const urlLongitude =
    analyseState.status === "analysing" &&
    analyseState.geocode.status === "done"
      ? analyseState.geocode.data.longitude
      : null

  useEffect(() => {
    if (!mounted || !mapReady || hasHydratedFromUrlRef.current) return

    hasHydratedFromUrlRef.current = true

    const shareSearchParams = getShareSearchParams()
    const address = shareSearchParams.get("address")?.trim() ?? ""
    const coordinates = parseShareCoordinates(
      shareSearchParams.get("lat"),
      shareSearchParams.get("lng")
    )
    const decodedTimeSlot = decodeNoiseTimeSlot(
      shareSearchParams.get("timeSlot") ?? ""
    )

    if (decodedTimeSlot) {
      setTimeSlot(decodedTimeSlot)
    }

    const hasShareTarget = Boolean(address || coordinates)

    if (!hasShareTarget) {
      return
    }

    isRestoringFromUrlRef.current = true

    if (address && coordinates) {
      void handleSearch({
        address,
        resolvedGeocode: buildGeocodeResultFromCoordinates(
          address,
          coordinates.latitude,
          coordinates.longitude,
          {
            geocoderName: "shared-url",
            source: "shared-url",
            sourceEndpoint: "client-side URL params",
          }
        ),
      })
      return
    }

    if (address) {
      void handleSearch({ address })
      return
    }

    if (coordinates) {
      const fallbackAddress = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`

      void handleSearch({
        address: fallbackAddress,
        resolvedGeocode: buildGeocodeResultFromCoordinates(
          fallbackAddress,
          coordinates.latitude,
          coordinates.longitude,
          {
            geocoderName: "shared-url",
            source: "shared-url",
            sourceEndpoint: "client-side URL params",
          }
        ),
      })
    }
  }, [handleSearch, mapReady, mounted])

  useEffect(() => {
    if (!mounted || !mapReady || !hasHydratedFromUrlRef.current) return

    if (isRestoringFromUrlRef.current) {
      if (analyseState.status === "analysing") {
        isRestoringFromUrlRef.current = false
      } else {
        return
      }
    }

    const nextQuery =
      urlAddress !== null && urlLatitude !== null && urlLongitude !== null
        ? buildShareQuery({
            address: urlAddress,
            latitude: urlLatitude,
            longitude: urlLongitude,
            timeSlot,
          })
        : ""

    const currentQuery = getShareSearchParams().toString()

    if (nextQuery === currentQuery) {
      return
    }

    replaceShareUrl(nextQuery)
  }, [
    analyseState.status,
    mounted,
    mapReady,
    timeSlot,
    urlAddress,
    urlLatitude,
    urlLongitude,
  ])

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

        await handleSearch({
          address: fallbackAddress,
          resolvedGeocode: buildGeocodeResultFromCoordinates(
            fallbackAddress,
            latitude,
            longitude,
            {
              geocoderName: "map-pin-drop",
              source: "map-pin-drop",
              sourceEndpoint: "client-side map click",
              warnings: [
                "Reverse geocoding failed; using dropped pin coordinates.",
              ],
            }
          ),
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

  const handleUseMapCenter = useCallback(() => {
    const center = mapRef.current?.getMap()?.getCenter()
    if (!center) {
      toast.error("Map is not ready yet. Try again in a moment.")
      return
    }

    void handleMapLocationPicked(center.lat, center.lng)
  }, [handleMapLocationPicked])

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location is not available in this browser.")
      return
    }

    toast.info("Getting your location…", {
      id: "current-location-pending",
      duration: 8000,
    })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss("current-location-pending")
        const { latitude, longitude } = position.coords

        if (!isWithinLondonBounds(latitude, longitude)) {
          toast.error("Your location is outside Greater London.")
          return
        }

        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: SEARCH_RESULT_ZOOM,
          duration: 1200,
        })
        void handleMapLocationPicked(latitude, longitude)
      },
      (error) => {
        toast.dismiss("current-location-pending")

        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Enable it in browser settings.")
          return
        }

        if (error.code === error.TIMEOUT) {
          toast.error("Timed out getting your location. Try again.")
          return
        }

        toast.error("Could not get your current location.")
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      }
    )
  }, [handleMapLocationPicked])

  const handleMapLongPress = useCallback(
    ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      void handleMapLocationPicked(latitude, longitude)
    },
    [handleMapLocationPicked]
  )

  useShiftDragRotate(mapRef, mounted && mapReady)
  useMapLongPress(mapRef, mounted && mapReady && isMobile, handleMapLongPress)

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
  // Voice mode temporarily disabled — restore with VoiceModeButton import above.
  // const voiceContext = useMemo(() => {
  //   if (analyseState.status !== "analysing") {
  //     return null
  //   }
  //
  //   if (analyseState.geocode.status !== "done") {
  //     return null
  //   }
  //
  //   return locationContextFromAnalyse(analyseState, timeSlot)
  // }, [analyseState, timeSlot])

  const searchBarProps = {
    onSearch: handleSearch,
    onSelectFromMap: isMobile ? undefined : handleSelectFromMap,
    onUseCurrentLocation: handleUseCurrentLocation,
    onUseMapCenter: handleUseMapCenter,
    isSearching,
    query: searchQuery,
    onQueryChange: setSearchQuery,
    expanded: searchExpanded,
    onExpandedChange: setSearchExpanded,
  }

  const activeSearchRef = isMobile
    ? analyseOpen
      ? mobileDockedSearchRef
      : mobileFloatingSearchRef
    : desktopSearchRef

  const handleTypeToSearch = useCallback((character: string) => {
    setSearchExpanded(true)
    setSearchQuery((current) => `${current}${character}`)
  }, [])

  useMapTypeToSearch({
    searchRef: activeSearchRef,
    onType: handleTypeToSearch,
  })

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
        className="h-svh w-full animate-pulse bg-background p-4 md:p-5"
      >
        <div className="h-full w-full rounded-4xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="relative h-svh w-full bg-background p-4 md:p-5">
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
          ref={desktopSearchRef}
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
              dragRotate={false}
              boxZoom={false}
              onClick={handleMapClick}
              onLoad={() => {
                const map = mapRef.current?.getMap()
                if (map) {
                  bindNightlifeEmojiImages(map)
                  map.once("idle", () => setMapHasIdled(true))
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
                revealStage={noiseReveal.stage}
                coverageBounds={noiseReveal.coverageBounds}
                rasterFadeMs={noiseReveal.rasterFadeMs}
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
              aria-label="ssh-ldn London Noise Map"
              className="pointer-events-none absolute left-0 top-0 w-fit pb-2 pr-2.5 md:pb-2.5 md:pr-3.5"
            >
              <div className="flex items-center gap-1 md:gap-1.5">
                <span
                  aria-hidden
                  className="shrink-0 translate-y-1 text-[1.5rem] leading-none md:translate-y-1.5 md:text-[1.8rem]"
                >
                  🤫
                </span>
                <div className="-translate-y-px flex flex-col gap-0 leading-none">
                  <span className="font-mono text-2xl font-bold tracking-tight text-foreground leading-none md:text-4xl">
                    ssh-ldn
                  </span>
                  <p className="text-[10px] leading-none text-muted-foreground">
                    London Noise Map
                  </p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "pointer-events-auto absolute right-4 top-4 z-20 md:hidden",
                analyseOpen && "pointer-events-none opacity-0"
              )}
            >
              <MapSearchBar
                ref={mobileFloatingSearchRef}
                variant="floating"
                instanceId="mobile-floating"
                {...searchBarProps}
              />
            </div>

            <div className="pointer-events-none absolute bottom-24 right-2 w-fit max-w-[calc(100%-2rem)] md:bottom-28 md:right-2.5">
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

            <div className="pointer-events-none absolute inset-x-4 bottom-0 z-20 flex h-4 items-center md:inset-x-5 md:h-5">
              <MapDataCredits />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "hidden min-h-0 flex-col overflow-hidden md:flex",
            "md:h-full md:transition-none",
            analyseOpen
              ? "md:pointer-events-auto"
              : "md:pointer-events-none"
          )}
        >
          <div aria-hidden className="hidden h-14 shrink-0 md:block" />

          <MapAnalysePanel
            state={analyseState}
            onClose={handleCloseAnalyse}
            focusedNoisyPoiId={focusedNoisyPoiId}
            onNoisyPoiHover={setHoveredNoisyPoiId}
            onNoisyPoiFocus={handleNoisyPoiFocus}
          />
        </div>
      </div>

      {isMobile ? (
        <MapAnalyseSheet
          open={analyseOpen}
          state={analyseState}
          onClose={handleCloseAnalyse}
          searchBarProps={searchBarProps}
          searchBarRef={mobileDockedSearchRef}
          focusedNoisyPoiId={focusedNoisyPoiId}
          onNoisyPoiHover={setHoveredNoisyPoiId}
          onNoisyPoiFocus={handleNoisyPoiFocus}
        />
      ) : null}
    </div>
  )
}
