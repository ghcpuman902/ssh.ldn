"use client"

import type { ReactNode } from "react"

import { PlaceholderRoundel } from "@/components/map/placeholder-roundel"
import { NOISE_CONTRIBUTOR_META } from "@/lib/map/noise-contributor-meta"
import { cn } from "@/lib/utils"

const DemoFrame = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <figure className="overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
    <div
      role="img"
      aria-label={label}
      className="relative flex min-h-28 items-center justify-center overflow-hidden bg-background/80 p-3"
    >
      {children}
    </div>
  </figure>
)

const DemoTimeGrid = () => (
  <div
    aria-hidden
    className="map-help-demo-time pointer-events-none rounded-3xl border border-border/40 bg-background/80 px-3 py-2 shadow-sm"
  >
    <p className="mb-1.5 text-center text-[11px] font-medium text-foreground">
      <span className="map-help-demo-time-label" />
    </p>
    <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-1.5 gap-y-1">
      <span />
      <span className="text-center text-[9px] font-medium tracking-[-0.06em] text-muted-foreground">
        MTWTF
      </span>
      <span className="text-center text-[9px] font-medium tracking-[-0.06em] text-muted-foreground">
        SS
      </span>
      <span className="pr-0.5 text-[10px] font-medium text-muted-foreground">
        Day
      </span>
      <span className="map-help-demo-slot map-help-demo-slot-weekday-day inline-flex h-7 items-center justify-center rounded-lg border p-1">
        <span className="flex h-full gap-[3px]">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="w-1.5 rounded-sm bg-current" />
          ))}
        </span>
      </span>
      <span className="map-help-demo-slot map-help-demo-slot-weekend-day inline-flex h-7 items-center justify-center rounded-lg border p-1">
        <span className="flex h-full gap-[3px]">
          {Array.from({ length: 2 }, (_, index) => (
            <span key={index} className="w-1.5 rounded-sm bg-current" />
          ))}
        </span>
      </span>
      <span className="pr-0.5 text-[10px] font-medium text-muted-foreground">
        Night
      </span>
      <span className="map-help-demo-slot map-help-demo-slot-weekday-night inline-flex h-5 items-center justify-center rounded-lg border p-1">
        <span className="flex h-full gap-[3px]">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="w-1.5 rounded-sm bg-current" />
          ))}
        </span>
      </span>
      <span className="map-help-demo-slot map-help-demo-slot-weekend-night inline-flex h-5 items-center justify-center rounded-lg border p-1">
        <span className="flex h-full gap-[3px]">
          {Array.from({ length: 2 }, (_, index) => (
            <span key={index} className="w-1.5 rounded-sm bg-current" />
          ))}
        </span>
      </span>
    </div>
  </div>
)

const DemoLayerPills = () => {
  const layers = [
    NOISE_CONTRIBUTOR_META.road,
    NOISE_CONTRIBUTOR_META.rail,
    NOISE_CONTRIBUTOR_META.airport,
    NOISE_CONTRIBUTOR_META.nightlife,
  ]

  return (
    <div
      aria-hidden
      className="map-help-demo-layers pointer-events-none flex items-center gap-1 rounded-full border border-border/40 bg-background/80 p-1"
    >
      {layers.map((layer, index) => (
        <span
          key={layer.label}
          className={cn(
            "map-help-demo-layer relative flex size-8 items-center justify-center rounded-full border bg-background text-sm",
            `map-help-demo-layer-${index}`
          )}
        >
          <span
            className="map-help-demo-layer-ring absolute inset-0.5 rounded-full border-2 border-transparent"
            style={{ borderColor: layer.strokeColor }}
          />
          <span className="relative">{layer.emoji}</span>
        </span>
      ))}
    </div>
  )
}

const DemoVisualLayers = () => (
  <div
    aria-hidden
    className="pointer-events-none flex items-center gap-1 rounded-full border border-border/40 bg-background/80 p-1"
  >
    <span className="map-help-demo-visual-tube flex size-8 items-center justify-center rounded-full border bg-background">
      <PlaceholderRoundel className="h-5 w-auto" />
    </span>
    <span className="map-help-demo-visual-park flex size-8 items-center justify-center rounded-full border bg-background">
      <span className="text-base">🌳</span>
    </span>
  </div>
)

export const MapLayerHelpDemos = {
  Time: () => (
    <DemoFrame label="Time selector">
      <DemoTimeGrid />
    </DemoFrame>
  ),
  Layers: () => (
    <DemoFrame label="Noise layer buttons">
      <DemoLayerPills />
    </DemoFrame>
  ),
  Visual: () => (
    <DemoFrame label="Tube and park layer toggles">
      <DemoVisualLayers />
    </DemoFrame>
  ),
}
