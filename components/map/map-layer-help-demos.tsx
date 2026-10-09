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

/** Mini map window: lighting cycles day/night, the frame cycles plain/warm glow. */
const DemoTimeWindow = () => (
  <div aria-hidden className="pointer-events-none flex flex-col items-center gap-2">
    <div className="map-help-demo-time-frame rounded-2xl p-2">
      <div className="map-help-demo-time-map relative h-16 w-28 overflow-hidden rounded-xl">
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 -rotate-12 bg-current opacity-30" />
        <span className="absolute inset-y-0 left-2/3 w-0.5 rotate-6 bg-current opacity-30" />
        <span className="absolute top-3 left-6 size-8 rounded-full bg-orange-500/45 blur-[6px]" />
      </div>
    </div>
    <p className="text-[11px] font-medium text-foreground">
      <span className="map-help-demo-time-label" />
    </p>
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
    <DemoFrame label="The map lights up for day and goes dark for night; weekends add a warm glow around it">
      <DemoTimeWindow />
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
