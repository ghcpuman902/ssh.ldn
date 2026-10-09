"use client"

import { useState } from "react"

import type { NoiseDayPart, NoiseTimeSlot } from "@/lib/map/noise-time"

/**
 * Weekday vs weekend lives in the gutter around the map window: the plain
 * page on weekdays, a soft, slowly breathing warm glow at the weekend
 * (amber by day, violet by night). CSS-only; see `.map-time-frame` in
 * map-controls.css.
 */
export const MapTimeFrame = ({ timeSlot }: { timeSlot: NoiseTimeSlot }) => (
  <div
    aria-hidden
    className="map-time-frame"
    data-week={timeSlot.week}
    data-part={timeSlot.part}
  >
    <div className="map-time-frame-glow" />
  </div>
)

/**
 * One-shot dusk / dawn sweep over the map while the basemap crossfades, so
 * the change itself says "the time changed". Skipped on first paint and
 * hidden under reduced motion.
 */
export const MapTimeVeil = ({ part }: { part: NoiseDayPart }) => {
  const [previousPart, setPreviousPart] = useState(part)
  const [sweep, setSweep] = useState<{ id: number; to: NoiseDayPart } | null>(
    null
  )

  if (part !== previousPart) {
    setPreviousPart(part)
    setSweep({ id: (sweep?.id ?? 0) + 1, to: part })
  }

  if (!sweep) return null

  return (
    <div
      key={sweep.id}
      aria-hidden
      className="map-time-veil"
      data-to={sweep.to}
      onAnimationEnd={() => setSweep(null)}
    />
  )
}
