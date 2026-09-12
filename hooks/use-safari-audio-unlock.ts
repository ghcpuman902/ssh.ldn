"use client"

import { useEffect, useRef } from "react"

import { SAFARI_AUDIO_UNLOCK_EVENTS } from "@/lib/map/noise-audio-engine"

/**
 * Safari / WebKit autoplay: AudioContext must be created or resumed inside a
 * trusted user gesture (click, tap, key). MapLibre `movestart` / `dragstart`
 * do not count.
 */
export const useSafariAudioUnlock = (
  enabled: boolean,
  onUnlock: () => void
) => {
  const onUnlockRef = useRef(onUnlock)

  useEffect(() => {
    onUnlockRef.current = onUnlock
  }, [onUnlock])

  useEffect(() => {
    if (!enabled) return

    const handleUnlock = (event: Event) => {
      if (!event.isTrusted) return
      onUnlockRef.current()
    }

    for (const type of SAFARI_AUDIO_UNLOCK_EVENTS) {
      document.addEventListener(type, handleUnlock, {
        capture: true,
        passive: true,
      })
    }

    return () => {
      for (const type of SAFARI_AUDIO_UNLOCK_EVENTS) {
        document.removeEventListener(type, handleUnlock, true)
      }
    }
  }, [enabled])
}
