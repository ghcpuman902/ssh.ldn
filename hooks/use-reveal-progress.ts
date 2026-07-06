"use client"

import { useEffect, useState } from "react"

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export const useRevealProgress = (key: string, durationMs = 900) => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(0)

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (reduceMotion) {
      setProgress(1)
      return
    }

    let frameId = 0
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const raw = Math.min(1, elapsed / durationMs)
      setProgress(easeOutCubic(raw))

      if (raw < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [durationMs, key])

  return progress
}
