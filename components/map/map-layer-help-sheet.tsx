"use client"

import type { ReactNode } from "react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { DEFRA_MAP_LAYERS } from "@/lib/map/defra-layers"
import { NOISE_CONTRIBUTOR_META } from "@/lib/map/noise-contributor-meta"
import {
  DEFRA_TIME_SLOT_NOTE,
  formatNoiseTimeSlot,
  NOISE_DAY_PARTS,
  WEEK_SEGMENT_LABELS,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time"
import { VISUAL_LAYER_META } from "@/lib/map/visual-layers"

type MapLayerHelpSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  timeSlot: NoiseTimeSlot
  audioEnabled: boolean
  audioSampleMode: "cursor" | "center"
}

const audioHelpText = (
  audioEnabled: boolean,
  audioSampleMode: "cursor" | "center"
) => {
  if (audioSampleMode === "center") {
    return "On. Sound follows the map centre, and stays unmuted here — use the phone silent switch if you want it off."
  }

  if (audioEnabled) {
    return "On. Sound follows the cursor."
  }

  return "Hear a rough mix under the cursor."
}

const HelpSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <section className="space-y-1.5">
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
    <div className="space-y-1 text-sm text-muted-foreground">{children}</div>
  </section>
)

export const MapLayerHelpSheet = ({
  open,
  onOpenChange,
  timeSlot,
  audioEnabled,
  audioSampleMode,
}: MapLayerHelpSheetProps) => {
  const dayHours =
    NOISE_DAY_PARTS.find((part) => part.part === "day")?.hours ?? "07:00–19:00"
  const nightHours =
    NOISE_DAY_PARTS.find((part) => part.part === "night")?.hours ??
    "23:00–07:00"

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left">
          <DrawerTitle>Map controls</DrawerTitle>
          <DrawerDescription>
            What the time selector, noise layers, and visual layers do.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-8">
          <HelpSection title="When">
            <p>
              Now showing {formatNoiseTimeSlot(timeSlot)}.{" "}
              {WEEK_SEGMENT_LABELS.weekday} uses Mon–Fri traffic.{" "}
              {WEEK_SEGMENT_LABELS.weekend} uses Sat–Sun. Day is {dayHours}.
              Night is {nightHours}.
            </p>
            <p>{DEFRA_TIME_SLOT_NOTE}</p>
          </HelpSection>

          <HelpSection title="Noise layers">
            <p>
              {NOISE_CONTRIBUTOR_META.road.emoji} {DEFRA_MAP_LAYERS.road.label}:{" "}
              {DEFRA_MAP_LAYERS.road.description}. Yearly DEFRA averages, not
              live readings.
            </p>
            <p>
              {NOISE_CONTRIBUTOR_META.rail.emoji} {DEFRA_MAP_LAYERS.rail.label}:{" "}
              {DEFRA_MAP_LAYERS.rail.description}. Yearly DEFRA averages, not
              live readings.
            </p>
            <p>
              {NOISE_CONTRIBUTOR_META.airport.emoji}{" "}
              {DEFRA_MAP_LAYERS.airport.label}:{" "}
              {DEFRA_MAP_LAYERS.airport.description}. Yearly DEFRA averages, not
              live readings.
            </p>
            <p>
              {NOISE_CONTRIBUTOR_META.nightlife.emoji} Local noise sources:
              pubs, bars, clubs, and venues from OpenStreetMap. These follow the
              time selector more closely than the DEFRA rasters.
            </p>
          </HelpSection>

          <HelpSection title="Visual layers">
            <p>
              {VISUAL_LAYER_META.tube.label}: coloured Tube, Overground,
              Elizabeth line, DLR, and tram tracks. Context only, not a noise
              reading.
            </p>
            <p>
              {VISUAL_LAYER_META.greenSpaces.label}:{" "}
              {VISUAL_LAYER_META.greenSpaces.description}
            </p>
          </HelpSection>

          <HelpSection title="Sound preview">
            <p>{audioHelpText(audioEnabled, audioSampleMode)}</p>
          </HelpSection>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
