"use client"

import { useEffect, useState, type RefObject } from "react"
import type { MapRef } from "react-map-gl/maplibre"

import { fps120Stats } from "@/lib/map/fps120/controller"

type Reading = { input: number; unique: number; touch: number; render: number; active: boolean }

/**
 * Pilot meter: input samples per second (controller reads, and how many of
 * them moved), raw touch events per second, and map frames rendered per
 * second. With the controller off it still counts touch events and frames,
 * so the same phone can compare both modes.
 */
export const Fps120Meter = ({ mapRef, controller }: { mapRef: RefObject<MapRef | null>; controller: boolean }) => {
  const [reading, setReading] = useState<Reading | null>(null)

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    let frames = 0
    const onRender = () => {
      frames += 1
    }
    const container = map.getCanvasContainer()
    // Controller off: count the touch events MapLibre sees (passive, capture).
    const onTouch = () => {
      if (!controller) fps120Stats.touchMoves += 1
    }
    map.on("render", onRender)
    container.addEventListener("touchmove", onTouch, { passive: true, capture: true })
    let last = performance.now()
    let prev = { ...fps120Stats }
    const id = setInterval(() => {
      const now = performance.now()
      const s = (now - last) / 1000
      setReading({
        input: Math.round((fps120Stats.samples - prev.samples) / s),
        unique: Math.round((fps120Stats.unique - prev.unique) / s),
        touch: Math.round((fps120Stats.touchMoves - prev.touchMoves) / s),
        render: Math.round(frames / s),
        active: fps120Stats.active,
      })
      frames = 0
      last = now
      prev = { ...fps120Stats }
    }, 500)
    return () => {
      clearInterval(id)
      map.off("render", onRender)
      container.removeEventListener("touchmove", onTouch, { capture: true })
    }
  }, [mapRef, controller])

  return (
    <div
      data-fps120-meter
      className="pointer-events-none fixed top-[max(env(safe-area-inset-top),8px)] left-1/2 z-[1000] -translate-x-1/2 rounded-md bg-white px-2 py-1 font-mono text-[11px] leading-tight text-neutral-900"
    >
      <div>{controller ? "fps120 ON" : "fps120 off"}{reading?.active ? " ●" : ""}</div>
      <div>
        in {controller ? `${reading?.unique ?? 0}/${reading?.input ?? 0}` : `${reading?.touch ?? 0}`} Hz · map{" "}
        {reading?.render ?? 0} fps
      </div>
    </div>
  )
}
