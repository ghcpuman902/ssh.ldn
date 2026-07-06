"use client"

import { useEffect, useId, useRef, useState } from "react"

import {
  buildSpectrometerFlatFill,
  getSpectrometerGeometry,
  INSTANT_OPACITY,
  PEAK_OPACITY,
  spectrometerLevelToTop,
  updateSpectrometerMeter,
  type MeterPair,
} from "@/lib/map/spectrometer-meter"
import { cn } from "@/lib/utils"

type SpectrometerMeterFillProps = {
  active: boolean
  level?: number
  color?: string
  phase?: number
  size?: number
  className?: string
}

type MotionState = MeterPair

export const SpectrometerMeterFill = ({
  active,
  level = 0,
  color = "var(--foreground)",
  phase = 0,
  size = 29,
  className,
}: SpectrometerMeterFillProps) => {
  const clipId = useId()
  const geometry = getSpectrometerGeometry(size)
  const [motionState, setMotionState] = useState<MotionState>({
    instant: 0,
    peak: 0,
  })
  const levelRef = useRef(level)
  const colorRef = useRef(color)
  const meterRef = useRef<MeterPair>({ instant: 0, peak: 0 })
  const reduceMotionRef = useRef(false)
  const lastFrameRef = useRef<number | null>(null)

  levelRef.current = level
  colorRef.current = color

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  }, [])

  useEffect(() => {
    if (!active) {
      meterRef.current = { instant: 0, peak: 0 }
      lastFrameRef.current = null
      setMotionState({ instant: 0, peak: 0 })
      return
    }

    let frameId = 0

    const tick = (now: number) => {
      const lastFrame = lastFrameRef.current ?? now
      const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrameRef.current = now
      const timeSeconds = now / 1000

      meterRef.current = updateSpectrometerMeter(
        meterRef.current,
        levelRef.current,
        timeSeconds,
        phase,
        deltaSeconds,
        reduceMotionRef.current
      )

      setMotionState({ ...meterRef.current })
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
      lastFrameRef.current = null
    }
  }, [active, phase])

  if (!active) {
    return null
  }

  const { instant, peak } = motionState
  const hasSignal = instant > 0 || peak > 0 || level > 0

  if (!hasSignal) {
    return null
  }

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${geometry.size} ${geometry.size}`}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle
            cx={geometry.center}
            cy={geometry.center}
            r={geometry.innerRadius}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {peak > 0.5 ? (
          <path
            d={buildSpectrometerFlatFill(
              spectrometerLevelToTop(peak, geometry),
              geometry.fillBottom,
              geometry
            )}
            fill={colorRef.current}
            opacity={PEAK_OPACITY}
          />
        ) : null}
        {instant > 0.5 ? (
          <path
            d={buildSpectrometerFlatFill(
              spectrometerLevelToTop(instant, geometry),
              geometry.fillBottom,
              geometry
            )}
            fill={colorRef.current}
            opacity={INSTANT_OPACITY}
          />
        ) : null}
      </g>
    </svg>
  )
}
