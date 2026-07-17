"use client"

import { notFound } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import MapLibreMap, { Layer, Source } from "react-map-gl/maplibre"

import {
  mapLibreNoiseColourExpression,
  type PublicNoiseSegmentProperties,
  type PublicNoiseSource,
} from "@/lib/public-noise/colours"
import {
  getMapPixelRatio,
  getMapStyle,
  LONDON_BOUNDS,
  LONDON_VIEWPORT,
  MAP_CONFIG,
} from "@/lib/map/config"
import { PublicNoiseLegend } from "@/components/public-noise-map/public-noise-legend"

import "maplibre-gl/dist/maplibre-gl.css"

type SegmentFeatureCollection = {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: PublicNoiseSegmentProperties
    geometry: {
      type: "LineString"
      coordinates: Array<[number, number]>
    }
  }>
}

const DevPublicNoiseInner = () => {
  const searchParams = useSearchParams()
  const sourceId = searchParams.get("source")
  const [segments, setSegments] = useState<SegmentFeatureCollection | null>(null)
  const [sources, setSources] = useState<PublicNoiseSource[]>([])

  useEffect(() => {
    void Promise.all([
      fetch("/data/public-noise/segments.geojson").then((r) => r.json()),
      fetch("/data/public-noise/sources.json").then((r) => r.json()),
    ]).then(([seg, src]) => {
      setSegments(seg as SegmentFeatureCollection)
      setSources((src as { sources: PublicNoiseSource[] }).sources ?? [])
    })
  }, [])

  const filtered = useMemo(() => {
    if (!segments) return null
    if (!sourceId) return segments
    return {
      ...segments,
      features: segments.features.filter((f) =>
        f.properties.sourceIds.includes(sourceId),
      ),
    }
  }, [segments, sourceId])

  const activeSource = sources.find((s) => s.id === sourceId) ?? null

  return (
    <main className="flex h-svh flex-col">
      <header className="space-y-2 border-b border-border px-4 py-3">
        <Link
          href="/maps/public-noise-data"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Public map
        </Link>
        <h1 className="text-lg font-semibold">Public noise QA — per source</h1>
        <p className="text-xs text-muted-foreground">
          Render one source at a time over Central London. Use{" "}
          <code className="rounded bg-muted px-1">?source=central-r3291</code>
        </p>
        <div className="flex flex-wrap gap-2">
          {sources
            .filter((s) => s.mapReady)
            .map((source) => (
              <Link
                key={source.id}
                href={`/dev/public-noise-data?source=${source.id}`}
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                {source.id}
              </Link>
            ))}
          <Link
            href="/dev/public-noise-data"
            className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
          >
            all
          </Link>
        </div>
        {activeSource ? (
          <p className="text-xs text-muted-foreground">
            {activeSource.title} · {activeSource.rightsLabel} ·{" "}
            {filtered?.features.length ?? 0} sections
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Showing all sources · {filtered?.features.length ?? 0} sections
          </p>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <MapLibreMap
          initialViewState={{ ...LONDON_VIEWPORT, zoom: 11 }}
          mapStyle={getMapStyle("light")}
          minZoom={MAP_CONFIG.minZoom}
          maxZoom={MAP_CONFIG.maxZoom}
          maxBounds={LONDON_BOUNDS}
          pixelRatio={getMapPixelRatio()}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          {filtered ? (
            <Source id="qa-segments" type="geojson" data={filtered}>
              <Layer
                id="qa-segments-line"
                type="line"
                paint={{
                  "line-color": mapLibreNoiseColourExpression("valueDb"),
                  "line-width": 5,
                  "line-opacity": 0.9,
                }}
              />
            </Source>
          ) : null}
        </MapLibreMap>
        <div className="absolute bottom-4 left-4">
          <PublicNoiseLegend />
        </div>
      </div>
    </main>
  )
}

export default function DevPublicNoisePage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <Suspense fallback={<div className="h-svh animate-pulse bg-muted" />}>
      <DevPublicNoiseInner />
    </Suspense>
  )
}
