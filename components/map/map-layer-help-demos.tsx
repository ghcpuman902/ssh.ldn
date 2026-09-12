"use client"

import type { ReactNode } from "react"
import { Volume2 } from "lucide-react"

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

const DemoSoundPreview = () => (
  <div
    aria-hidden
    className="map-help-demo-sound relative h-28 w-full max-w-56 overflow-hidden rounded-2xl border border-border/40 bg-[oklch(0.96_0.01_120)]"
  >
    <div className="absolute inset-0 opacity-70">
      <div className="absolute top-6 right-8 left-10 h-px bg-red-400/80" />
      <div className="absolute top-14 right-4 left-6 h-px bg-zinc-800" />
      <div className="absolute top-10 right-10 left-4 h-px bg-green-600/80" />
      <div className="map-help-demo-sound-dot absolute size-2 rounded-full border border-zinc-900 bg-white" />
      <div className="map-help-demo-sound-dot-b absolute size-2 rounded-full border border-zinc-900 bg-white" />
    </div>
    <div className="map-help-demo-sound-crosshair absolute size-5 -translate-x-1/2 -translate-y-1/2">
      <span className="absolute top-1/2 left-0 h-px w-full bg-foreground" />
      <span className="absolute top-0 left-1/2 h-full w-px bg-foreground" />
    </div>
    <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-foreground shadow-sm">
      <Volume2 className="size-3" />
      <span className="map-help-demo-sound-bars flex h-3 items-end gap-px">
        <span className="w-0.5 rounded-sm bg-primary" />
        <span className="w-0.5 rounded-sm bg-primary" />
        <span className="w-0.5 rounded-sm bg-primary" />
      </span>
    </div>
  </div>
)

export const MapLayerHelpDemos = {
  Time: () => (
    <DemoFrame label="Animated time selector switching weekday, weekend, day, and night">
      <DemoTimeGrid />
    </DemoFrame>
  ),
  Layers: () => (
    <DemoFrame label="Animated noise layer buttons lighting up for road, rail, aircraft, and local sources">
      <DemoLayerPills />
    </DemoFrame>
  ),
  Visual: () => (
    <DemoFrame label="Animated Tube and park layer toggles">
      <DemoVisualLayers />
    </DemoFrame>
  ),
  Sound: () => (
    <DemoFrame label="Animated map pan with centre crosshair and sound preview">
      <DemoSoundPreview />
    </DemoFrame>
  ),
}
