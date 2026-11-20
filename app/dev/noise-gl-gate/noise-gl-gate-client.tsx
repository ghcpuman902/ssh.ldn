"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as MapLibreMap } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { NoiseGridGlLayer } from "@/lib/map/noise-grid-gl-layer"
import { gridLevelFor, pixelMetersAt } from "@/lib/map/noise-grid-gl-math"
import { gridLayerPalette } from "@/lib/map/noise-grid-palette"
import { NOISE_DATA_BASE_URL } from "@/lib/map/noise-tiles"

/** The page's clear colour: every pixel is the layer composited over opaque black. */
export const GATE_CLEAR_RGB = [0, 0, 0] as const

type GateSample = {
  /** RGBA read back from the drawing buffer at the device pixel. */
  rgba: [number, number, number, number]
  /** Lng/lat of the device pixel's centre (map.unproject). */
  lat: number
  lng: number
  devicePixel: { x: number; y: number }
}

type NoiseGate = {
  ready: Promise<void>
  /** CSS pixel position -> the device pixel under it, read back with gl.readPixels. */
  samplePixel: (x: number, y: number) => GateSample
  info: () => {
    layer: string
    zoom: number
    level: number
    opacity: number
    width: number
    height: number
    pixelRatio: number
    clearRgb: readonly number[]
    /** Straight-alpha RGBA per band, 256 entries. */
    palette: number[][]
  }
}

declare global {
  interface Window {
    __noiseGate?: NoiseGate
  }
}

const num = (value: string | null, fallback: number) => {
  const n = value === null ? NaN : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const NoiseGlGateClient = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const base = (params.get("base") ?? NOISE_DATA_BASE_URL ?? "").replace(/\/+$/, "")
    const layerName = params.get("layer") ?? "road_Lden"
    const zoom = num(params.get("z"), 15)
    const lat = num(params.get("lat"), 51.5072)
    const lng = num(params.get("lng"), -0.1276)
    const opacity = num(params.get("opacity"), 1)
    if (!base) {
      queueMicrotask(() => setStatus("no base: set NEXT_PUBLIC_NOISE_DATA_BASE or ?base="))
      return
    }

    let map: MapLibreMap | null = null
    let cancelled = false
    const palette = gridLayerPalette(layerName)

    void import("maplibre-gl").then(({ Map }) => {
      if (cancelled || !containerRef.current) return
      map = new Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "clear",
              type: "background",
              paint: { "background-color": `rgb(${GATE_CLEAR_RGB.join(",")})` },
            },
          ],
        },
        center: [lng, lat],
        zoom,
        pixelRatio: 1,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: false },
      })
      const layer = new NoiseGridGlLayer("noise-gate", base, {
        layer: layerName,
        palette,
        opacity,
        visible: true,
      })
      const m = map

      const ready = new Promise<void>((resolve) => {
        const check = () => {
          if (!m.loaded() || layer.pending > 0) {
            m.triggerRepaint()
            setTimeout(check, 100)
            return
          }
          // One more full frame with everything resident.
          m.once("render", () => {
            setStatus("ready")
            resolve()
          })
          m.triggerRepaint()
        }
        m.once("load", () => {
          m.addLayer(layer)
          check()
        })
      })

      const samplePixel = (x: number, y: number): GateSample => {
        const canvas = m.getCanvas()
        const gl = canvas.getContext("webgl2")
        if (!gl) throw new Error("no webgl2 context")
        const ratio = canvas.width / canvas.clientWidth
        const px = Math.floor(x * ratio)
        const py = Math.floor(y * ratio)
        const out = new Uint8Array(4)
        gl.readPixels(px, canvas.height - 1 - py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out)
        const at = m.unproject([(px + 0.5) / ratio, (py + 0.5) / ratio])
        return {
          rgba: [out[0], out[1], out[2], out[3]],
          lat: at.lat,
          lng: at.lng,
          devicePixel: { x: px, y: py },
        }
      }

      window.__noiseGate = {
        ready,
        samplePixel,
        info: () => {
          const canvas = m.getCanvas()
          return {
            layer: layerName,
            zoom: m.getZoom(),
            level: gridLevelFor(pixelMetersAt(m.getZoom(), m.getCenter().lat), 5),
            opacity,
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            pixelRatio: canvas.width / canvas.clientWidth,
            clearRgb: GATE_CLEAR_RGB,
            palette: Array.from({ length: 256 }, (_, b) => Array.from(palette.subarray(b * 4, b * 4 + 4))),
          }
        },
      }
    })

    return () => {
      cancelled = true
      map?.remove()
      delete window.__noiseGate
    }
  }, [])

  return (
    <main style={{ position: "fixed", inset: 0, background: "#000" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <output
        data-noise-gate-status={status}
        style={{ position: "absolute", left: 4, bottom: 4, color: "#888", font: "10px monospace" }}
      >
        {status}
      </output>
    </main>
  )
}
