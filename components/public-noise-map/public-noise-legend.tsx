"use client"

import { LEGEND_BANDS } from "@/lib/public-noise/colours"

export const PublicNoiseLegend = () => (
  <div
    aria-label="Noise colour legend"
    className="rounded-xl border border-border bg-background/95 p-3 text-xs shadow-sm backdrop-blur"
  >
    <p className="font-medium text-foreground">In-carriage LAeq (dBA)</p>
    <p className="mt-0.5 text-[10px] text-muted-foreground">
      Green = quieter · yellow → orange → red → purple = noisier · grey = no data
    </p>
    <ul className="mt-2 space-y-1">
      {LEGEND_BANDS.map((band) => (
        <li key={band.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-sm border border-border"
            style={{ backgroundColor: band.color }}
          />
          <span className="text-muted-foreground">{band.label}</span>
        </li>
      ))}
    </ul>
  </div>
)
