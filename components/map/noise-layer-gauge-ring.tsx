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

export type GaugeSegment = {
  id?: string
  value: number
  color: string
}

type NoiseLayerGaugeRingProps = {
  active: boolean
  level?: number
  color?: string
  segments?: GaugeSegment[]
  phase?: number
  className?: string
}

type MotionState = {
  instant: number
  peak: number
  segmentMeters: Array<GaugeSegment & MeterPair>
  isMulti: boolean
}

const SIZE = 29
const GEOMETRY = getSpectrometerGeometry(SIZE)

export const NoiseLayerGaugeRing = ({
  active,
  level = 0,
  color = "var(--noise-other)",
  segments,
  phase = 0,
  className,
}: NoiseLayerGaugeRingProps) => {
  const clipId = useId()
  const [motionState, setMotionState] = useState<MotionState>({
    instant: 0,
    peak: 0,
    segmentMeters: [],
    isMulti: false,
  })
  const levelRef = useRef(level)
  const segmentsRef = useRef(segments)
  const colorRef = useRef(color)
  const meterRef = useRef<MeterPair>({ instant: 0, peak: 0 })
  const segmentMetersRef = useRef<Map<string, MeterPair>>(new Map())
  const reduceMotionRef = useRef(false)
  const lastFrameRef = useRef<number | null>(null)

  levelRef.current = level
  segmentsRef.current = segments
  colorRef.current = color

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  }, [])

  useEffect(() => {
    if (!active) {
      meterRef.current = { instant: 0, peak: 0 }
      segmentMetersRef.current = new Map()
      lastFrameRef.current = null
      setMotionState({
        instant: 0,
        peak: 0,
        segmentMeters: [],
        isMulti: false,
      })
      return
    }

    let frameId = 0

    const tick = (now: number) => {
      const lastFrame = lastFrameRef.current ?? now
      const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrameRef.current = now
      const timeSeconds = now / 1000
      const staticMode = reduceMotionRef.current

      const currentSegments = segmentsRef.current
      const isMulti = Boolean(currentSegments?.some((segment) => segment.value > 0))

      if (isMulti) {
        const nextSegmentMeters = currentSegments!.map((segment) => {
          const key = segment.id ?? segment.color
          const previous = segmentMetersRef.current.get(key) ?? {
            instant: 0,
            peak: 0,
          }
          const next = updateSpectrometerMeter(
            previous,
            segment.value,
            timeSeconds,
            phase,
            deltaSeconds,
            staticMode
          )
          segmentMetersRef.current.set(key, next)

          return {
            ...segment,
            ...next,
          }
        })

        setMotionState({
          instant: 0,
          peak: 0,
          segmentMeters: nextSegmentMeters,
          isMulti: true,
        })
      } else {
        meterRef.current = updateSpectrometerMeter(
          meterRef.current,
          levelRef.current,
          timeSeconds,
          phase,
          deltaSeconds,
          staticMode
        )

        setMotionState({
          instant: meterRef.current.instant,
          peak: meterRef.current.peak,
          segmentMeters: [],
          isMulti: false,
        })
      }

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

  const { instant, peak, isMulti, segmentMeters } = motionState
  const hasSignal = isMulti
    ? segmentMeters.some((segment) => segment.instant > 0 || segment.peak > 0)
    : instant > 0 || peak > 0 || level > 0

  if (!hasSignal) {
    return null
  }

  const renderMeterPair = (
    key: string,
    meterInstant: number,
    meterPeak: number,
    fillColor: string
  ) => (
    <g key={key}>
      {meterPeak > 0.5 ? (
        <path
          d={buildSpectrometerFlatFill(
            spectrometerLevelToTop(meterPeak, GEOMETRY),
            GEOMETRY.fillBottom,
            GEOMETRY
          )}
          fill={fillColor}
          opacity={PEAK_OPACITY}
        />
      ) : null}
      {meterInstant > 0.5 ? (
        <path
          d={buildSpectrometerFlatFill(
            spectrometerLevelToTop(meterInstant, GEOMETRY),
            GEOMETRY.fillBottom,
            GEOMETRY
          )}
          fill={fillColor}
          opacity={INSTANT_OPACITY}
        />
      ) : null}
    </g>
  )

  const renderStackedMeters = () => {
    const totalInstant = segmentMeters.reduce(
      (sum, segment) => sum + segment.instant,
      0
    )
    const totalPeak = segmentMeters.reduce(
      (sum, segment) => sum + segment.peak,
      0
    )

    if (totalInstant <= 0 && totalPeak <= 0) return null

    const instantFillHeight = (Math.min(100, totalInstant) / 100) * GEOMETRY.fillHeight
    const peakFillHeight = (Math.min(100, totalPeak) / 100) * GEOMETRY.fillHeight

    let peakBottom = GEOMETRY.fillBottom
    let instantBottom = GEOMETRY.fillBottom

    const peakPaths = segmentMeters.map((segment) => {
      if (segment.peak <= 0 || totalPeak <= 0) return null

      const bandHeight = (segment.peak / totalPeak) * peakFillHeight
      const top = peakBottom - bandHeight
      const path = (
        <path
          key={`peak-${segment.id ?? segment.color}`}
          d={buildSpectrometerFlatFill(top, peakBottom, GEOMETRY)}
          fill={segment.color}
          opacity={PEAK_OPACITY}
        />
      )
      peakBottom = top
      return path
    })

    const instantPaths = segmentMeters.map((segment) => {
      if (segment.instant <= 0 || totalInstant <= 0) return null

      const bandHeight = (segment.instant / totalInstant) * instantFillHeight
      const top = instantBottom - bandHeight
      const path = (
        <path
          key={`instant-${segment.id ?? segment.color}`}
          d={buildSpectrometerFlatFill(top, instantBottom, GEOMETRY)}
          fill={segment.color}
          opacity={INSTANT_OPACITY}
        />
      )
      instantBottom = top
      return path
    })

    return (
      <>
        {peakPaths}
        {instantPaths}
      </>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${GEOMETRY.size} ${GEOMETRY.size}`}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle
            cx={GEOMETRY.center}
            cy={GEOMETRY.center}
            r={GEOMETRY.innerRadius}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {isMulti
          ? renderStackedMeters()
          : renderMeterPair("single", instant, peak, colorRef.current)}
      </g>
    </svg>
  )
}
