"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type CSSProperties } from "react"

import { cn } from "@/lib/utils"
import {
  MAP_DATA_CREDITS,
  MAP_STRATEGIC_DISCLAIMER,
  type DataCredit,
} from "@/lib/map/data-credits"

const isInternalCreditUrl = (url: string) => url.startsWith("/")

const CreditLink = ({ credit }: { credit: DataCredit }) => {
  if (isInternalCreditUrl(credit.datasetUrl)) {
    return (
      <Link
        href={credit.datasetUrl}
        className="underline-offset-2 hover:text-foreground hover:underline"
        title={`${credit.title} — ${credit.licence}`}
      >
        {credit.attribution}
      </Link>
    )
  }

  return (
    <a
      href={credit.datasetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:text-foreground hover:underline"
      title={`${credit.title} — ${credit.licence}`}
    >
      {credit.attribution}
    </a>
  )
}

const CreditItems = () => (
  <>
    <span
      className="whitespace-nowrap after:mx-1.5 after:content-['·']"
      title={MAP_STRATEGIC_DISCLAIMER}
    >
      {MAP_STRATEGIC_DISCLAIMER}
    </span>
    {MAP_DATA_CREDITS.map((credit) => (
      <span
        key={credit.id}
        className="whitespace-nowrap after:mx-1.5 after:content-['·'] last:after:content-none"
      >
        <CreditLink credit={credit} />
      </span>
    ))}
  </>
)

export const MapDataCredits = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [shouldMarquee, setShouldMarquee] = useState(false)
  const [marqueeDuration, setMarqueeDuration] = useState("32s")

  useEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const updateMarquee = () => {
      const trackWidth = measure.scrollWidth
      const containerWidth = container.clientWidth
      const overflows = trackWidth > containerWidth

      setShouldMarquee(overflows)
      setMarqueeDuration(`${Math.max(24, trackWidth / 28)}s`)
    }

    updateMarquee()

    const observer = new ResizeObserver(updateMarquee)
    observer.observe(container)
    observer.observe(measure)

    return () => observer.disconnect()
  }, [])

  return (
    <footer
      ref={containerRef}
      aria-label="Data source credits"
      className={cn(
        "relative w-full text-[10px] leading-none text-muted-foreground",
        shouldMarquee && "map-data-credits-marquee-mask overflow-hidden"
      )}
      style={
        shouldMarquee
          ? ({ "--map-credits-marquee-duration": marqueeDuration } as CSSProperties)
          : undefined
      }
    >
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute flex w-max opacity-0"
      >
        <CreditItems />
      </div>

      {shouldMarquee ? (
        <div className="map-data-credits-marquee flex w-max" aria-live="off">
          <div className="map-data-credits-track flex shrink-0 items-center pr-8">
            <CreditItems />
          </div>
          <div
            className="map-data-credits-track flex shrink-0 items-center pr-8"
            aria-hidden
          >
            <CreditItems />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <CreditItems />
        </div>
      )}
    </footer>
  )
}
