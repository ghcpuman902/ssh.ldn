"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import MapLibreMap, {
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre"
import { useTheme } from "next-themes"

import { PublicNoiseDetail } from "@/components/public-noise-map/public-noise-detail"
import { PublicNoiseFiltersPanel } from "@/components/public-noise-map/public-noise-filters"
import { PublicNoiseLegend } from "@/components/public-noise-map/public-noise-legend"
import { Button } from "@/components/ui/button"
import {
  mapLibreNoiseColourExpression,
  NO_DATA_COLOUR,
  type PublicNoiseSegmentProperties,
  type PublicNoiseSource,
} from "@/lib/public-noise/colours"
import {
  DEFAULT_PUBLIC_NOISE_FILTERS,
  getSegmentDisplayValue,
  parsePublicNoiseFilters,
  segmentMatchesFilters,
  serializePublicNoiseFilters,
  type PublicNoiseFilters,
} from "@/lib/public-noise/filters"
import {
  getMapPixelRatio,
  getMapStyle,
  LONDON_BOUNDS,
  LONDON_VIEWPORT,
  MAP_CONFIG,
  type MapTheme,
} from "@/lib/map/config"
import { cn } from "@/lib/utils"

import "maplibre-gl/dist/maplibre-gl.css"

type SegmentFeature = {
  type: "Feature"
  id?: string
  properties: PublicNoiseSegmentProperties
  geometry: {
    type: "LineString"
    coordinates: Array<[number, number]>
  }
}

type SegmentFeatureCollection = {
  type: "FeatureCollection"
  features: SegmentFeature[]
  meta?: Record<string, unknown>
}

type StationFeatureCollection = {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    id?: string
    properties: {
      featureId: string
      name: string | null
      label: string | null
      lineIds: string[]
      zone: string | null
    }
    geometry: {
      type: "Point"
      coordinates: [number, number]
    }
  }>
  meta?: Record<string, unknown>
}

type SourcesPayload = {
  sources: PublicNoiseSource[]
  summary?: {
    observationCount: number
    segmentCount: number
    unmatchedCount: number
    lines: string[]
  }
}

const resolveMapTheme = (resolvedTheme: string | undefined): MapTheme =>
  resolvedTheme === "dark" ? "dark" : "light"

const NETWORK_SOURCE_ID = "public-noise-network"
const NETWORK_LAYER_ID = "public-noise-network-line"
const SEGMENTS_SOURCE_ID = "public-noise-segments"
const SEGMENTS_LAYER_ID = "public-noise-segments-line"
const SEGMENTS_HIT_LAYER_ID = "public-noise-segments-hit"
const STATIONS_SOURCE_ID = "public-noise-stations"

type NetworkFeatureCollection = {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    id?: string
    properties: {
      featureId: string
      lineId: string
      lineName: string
      hasData: boolean
      valueDb: null
    }
    geometry: {
      type: "LineString"
      coordinates: Array<[number, number]>
    }
  }>
  meta?: Record<string, unknown>
}

export const PublicNoiseMapShell = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const mapRef = useRef<MapRef>(null)
  const [mounted, setMounted] = useState(false)
  const [segments, setSegments] = useState<SegmentFeatureCollection | null>(null)
  const [network, setNetwork] = useState<NetworkFeatureCollection | null>(null)
  const [stations, setStations] = useState<StationFeatureCollection | null>(null)
  const [sources, setSources] = useState<PublicNoiseSource[]>([])
  const [summary, setSummary] = useState<SourcesPayload["summary"]>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<PublicNoiseFilters>(
    DEFAULT_PUBLIC_NOISE_FILTERS,
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setFilters(parsePublicNoiseFilters(searchParams))
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [segmentsRes, networkRes, stationsRes, sourcesRes] =
          await Promise.all([
            fetch("/data/public-noise/segments.geojson"),
            fetch("/data/public-noise/network.geojson"),
            fetch("/data/public-noise/stations.geojson"),
            fetch("/data/public-noise/sources.json"),
          ])

        if (
          !segmentsRes.ok ||
          !networkRes.ok ||
          !stationsRes.ok ||
          !sourcesRes.ok
        ) {
          throw new Error("Failed to load public noise datasets")
        }

        const [segmentsJson, networkJson, stationsJson, sourcesJson] =
          await Promise.all([
            segmentsRes.json() as Promise<SegmentFeatureCollection>,
            networkRes.json() as Promise<NetworkFeatureCollection>,
            stationsRes.json() as Promise<StationFeatureCollection>,
            sourcesRes.json() as Promise<SourcesPayload>,
          ])

        if (cancelled) return

        setSegments(segmentsJson)
        setNetwork(networkJson)
        setStations(stationsJson)
        setSources(sourcesJson.sources ?? [])
        setSummary(sourcesJson.summary)
        setLoadError(null)
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load map data",
          )
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFiltersChange = useCallback(
    (next: PublicNoiseFilters) => {
      setFilters(next)
      const query = serializePublicNoiseFilters(next)
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const handleReset = useCallback(() => {
    handleFiltersChange(DEFAULT_PUBLIC_NOISE_FILTERS)
  }, [handleFiltersChange])

  const filteredSegments = useMemo(() => {
    if (!segments) return null

    return {
      ...segments,
      features: segments.features.filter((feature) =>
        segmentMatchesFilters(feature.properties, filters),
      ),
    }
  }, [filters, segments])

  const filteredNetwork = useMemo(() => {
    if (!network) return null
    if (!filters.line) return network
    return {
      ...network,
      features: network.features.filter(
        (feature) => feature.properties.lineId === filters.line,
      ),
    }
  }, [filters.line, network])

  const filteredStations = useMemo(() => {
    if (!stations) return null
    if (!filters.line) return stations
    return {
      ...stations,
      features: stations.features.filter((feature) =>
        feature.properties.lineIds?.includes(filters.line!),
      ),
    }
  }, [filters.line, stations])

  const selectedSegment = useMemo(() => {
    if (!filters.segment || !segments) return null
    return (
      segments.features.find((f) => f.properties.segmentId === filters.segment)
        ?.properties ?? null
    )
  }, [filters.segment, segments])

  const colourProperty =
    filters.valueMode === "passenger"
      ? "passengerValueDb"
      : filters.valueMode === "cab"
        ? "cabValueDb"
        : "valueDb"

  const lines = useMemo(() => {
    if (!segments) return []
    const map = new Map<string, string>()
    for (const feature of segments.features) {
      map.set(feature.properties.lineId, feature.properties.lineName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [segments])

  const years = useMemo(() => {
    if (!segments) return []
    const set = new Set<string>()
    for (const feature of segments.features) {
      for (const date of [feature.properties.dateMin, feature.properties.dateMax]) {
        if (date) set.add(date.slice(0, 4))
      }
    }
    return [...set].sort()
  }, [segments])

  const mapReadySources = useMemo(
    () => sources.filter((source) => source.mapReady),
    [sources],
  )

  const sourcesById = useMemo(() => {
    const map = new Map<string, PublicNoiseSource>()
    for (const source of sources) map.set(source.id, source)
    return map
  }, [sources])

  const coverageSummary = summary
    ? `${filteredSegments?.features.length ?? 0} / ${summary.segmentCount} sections · ${summary.observationCount} observations`
    : "Loading coverage…"

  const sectionList = useMemo(() => {
    if (!filteredSegments) return []
    return [...filteredSegments.features]
      .map((f) => f.properties)
      .sort((a, b) => {
        const av = getSegmentDisplayValue(a, filters.valueMode) ?? -1
        const bv = getSegmentDisplayValue(b, filters.valueMode) ?? -1
        return bv - av
      })
  }, [filteredSegments, filters.valueMode])

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.find(
        (f) => f.layer?.id === SEGMENTS_HIT_LAYER_ID || f.layer?.id === SEGMENTS_LAYER_ID,
      )
      const segmentId = feature?.properties?.segmentId
      if (typeof segmentId !== "string") return
      handleFiltersChange({ ...filters, segment: segmentId })
    },
    [filters, handleFiltersChange],
  )

  const handleShare = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }
  }, [])

  if (!mounted) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading public noise map"
        className="h-svh w-full animate-pulse bg-muted"
      />
    )
  }

  const mapTheme = resolveMapTheme(resolvedTheme)

  return (
    <div className="flex h-svh w-full flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              ← Noise map
            </Link>
            <span className="text-muted-foreground">·</span>
            <h1 className="truncate text-base font-semibold text-foreground md:text-lg">
              Public Tube interior noise
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Unindexed reference prototype from published FOI / academic
            measurements — not open data. Green = quieter · red/purple =
            noisier · grey = no measured data.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Copy shareable URL"
            onClick={() => void handleShare()}
          >
            Copy link
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/data-sources">Sources</Link>
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative min-h-0 min-w-0">
          {loadError ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
              {loadError}
            </div>
          ) : (
            <MapLibreMap
              ref={mapRef}
              initialViewState={{ ...LONDON_VIEWPORT, zoom: 11.2 }}
              mapStyle={getMapStyle(mapTheme)}
              minZoom={MAP_CONFIG.minZoom}
              maxZoom={MAP_CONFIG.maxZoom}
              maxBounds={LONDON_BOUNDS}
              pixelRatio={getMapPixelRatio()}
              style={{ width: "100%", height: "100%" }}
              attributionControl={false}
              interactiveLayerIds={[SEGMENTS_HIT_LAYER_ID, SEGMENTS_LAYER_ID]}
              onClick={handleMapClick}
              cursor="pointer"
            >
              {filteredNetwork ? (
                <Source id={NETWORK_SOURCE_ID} type="geojson" data={filteredNetwork}>
                  <Layer
                    id={NETWORK_LAYER_ID}
                    type="line"
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                    paint={{
                      "line-color": NO_DATA_COLOUR,
                      "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        2,
                        14,
                        3.5,
                        16,
                        5,
                      ],
                      "line-opacity": 0.55,
                    }}
                  />
                </Source>
              ) : null}

              {filteredSegments ? (
                <Source id={SEGMENTS_SOURCE_ID} type="geojson" data={filteredSegments}>
                  <Layer
                    id={SEGMENTS_HIT_LAYER_ID}
                    type="line"
                    paint={{
                      "line-color": "#000000",
                      "line-opacity": 0,
                      "line-width": 14,
                    }}
                  />
                  <Layer
                    id={SEGMENTS_LAYER_ID}
                    type="line"
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                    paint={{
                      "line-color": mapLibreNoiseColourExpression(colourProperty),
                      "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        3.5,
                        14,
                        7,
                        16,
                        9,
                      ],
                      "line-opacity": 0.95,
                    }}
                  />
                </Source>
              ) : null}

              {filteredStations ? (
                <Source id={STATIONS_SOURCE_ID} type="geojson" data={filteredStations}>
                  <Layer
                    id="public-noise-stations-circle"
                    type="circle"
                    minzoom={11}
                    paint={{
                      "circle-radius": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        11,
                        2,
                        14,
                        3.5,
                        16,
                        4.5,
                      ],
                      "circle-color": "#ffffff",
                      "circle-stroke-color": "#111827",
                      "circle-stroke-width": 1.2,
                    }}
                  />
                  <Layer
                    id="public-noise-stations-label"
                    type="symbol"
                    minzoom={12.5}
                    layout={{
                      "text-field": ["coalesce", ["get", "label"], ["get", "name"], ""],
                      "text-size": 10,
                      "text-offset": [0, 1.1],
                      "text-anchor": "top",
                      "text-optional": true,
                    }}
                    paint={{
                      "text-color": "#111827",
                      "text-halo-color": "#ffffff",
                      "text-halo-width": 1.4,
                    }}
                  />
                </Source>
              ) : null}

              <NavigationControl position="bottom-right" showCompass={false} />
            </MapLibreMap>
          )}

          <div className="pointer-events-none absolute inset-x-3 bottom-3 top-auto z-10 flex justify-between gap-3 md:inset-x-4 md:bottom-4 md:top-4 md:items-start">
            <div className="pointer-events-auto hidden max-w-56 md:block">
              <PublicNoiseLegend />
            </div>
            <div className="pointer-events-auto w-full max-w-sm md:hidden">
              <PublicNoiseLegend />
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-t border-border p-3 lg:border-t-0 lg:border-l lg:p-4">
          <PublicNoiseFiltersPanel
            filters={filters}
            lines={lines}
            sources={mapReadySources}
            years={years}
            coverageSummary={coverageSummary}
            onChange={handleFiltersChange}
            onReset={handleReset}
          />

          <PublicNoiseDetail
            segment={selectedSegment}
            sourcesById={sourcesById}
            valueMode={filters.valueMode}
            onClose={() => handleFiltersChange({ ...filters, segment: null })}
          />

          <section aria-label="Noisiest matching sections" className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Loudest matching sections
            </h2>
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {sectionList.slice(0, 20).map((segment) => {
                const value = getSegmentDisplayValue(segment, filters.valueMode)
                const selected = filters.segment === segment.segmentId
                return (
                  <li key={segment.segmentId}>
                    <button
                      type="button"
                      aria-label={`${segment.fromStation} to ${segment.toStation}, ${value ?? "no data"} dBA`}
                      aria-pressed={selected}
                      tabIndex={0}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/60",
                      )}
                      onClick={() =>
                        handleFiltersChange({
                          ...filters,
                          segment: segment.segmentId,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        handleFiltersChange({
                          ...filters,
                          segment: segment.segmentId,
                        })
                      }}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-foreground">
                          {segment.fromStation}
                        </span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium text-foreground">
                          {segment.toStation}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {value === null ? "—" : value.toFixed(0)}
                      </span>
                    </button>
                  </li>
                )
              })}
              {sectionList.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No sections match these filters.
                </li>
              ) : null}
            </ul>
          </section>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            FOI attachments without an explicit open licence are shown for evaluation
            and marked as not open data. Prefer asking TfL for reuse permission before
            any redistribution of extracted values.
          </p>
        </aside>
      </div>
    </div>
  )
}
