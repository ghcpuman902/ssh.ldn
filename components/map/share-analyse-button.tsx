"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import {
  buildShareCardPath,
  buildShareQuery,
  formatShareMetaTitle,
  splitShareAddress,
} from "@/lib/map/share-card"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"

type ShareAnalyseButtonProps = {
  address: string
  latitude: number
  longitude: number
  timeSlot: NoiseTimeSlot
  score?: number
  scorePending?: boolean
}

export const ShareAnalyseButton = ({
  address,
  latitude,
  longitude,
  timeSlot,
  score,
  scorePending = false,
}: ShareAnalyseButtonProps) => {
  const cardPath = buildShareCardPath({
    address,
    latitude,
    longitude,
    score,
  })

  useEffect(() => {
    if (scorePending) return
    void fetch(cardPath).catch(() => undefined)
  }, [cardPath, scorePending])

  const handleShare = async () => {
    const query = buildShareQuery({
      address,
      latitude,
      longitude,
      timeSlot,
      score,
    })
    const url = `${window.location.origin}${window.location.pathname}?${query}`
    const title = formatShareMetaTitle(splitShareAddress(address), score)

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        toast.error("Could not share this address.")
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy the link.")
    }
  }

  return (
    <button
      type="button"
      data-sheet-no-drag
      aria-label={`Share ${address}`}
      onClick={() => {
        void handleShare()
      }}
      className="flex h-11 w-full touch-manipulation items-center justify-center rounded-2xl border border-border/60 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
    >
      Share
    </button>
  )
}
