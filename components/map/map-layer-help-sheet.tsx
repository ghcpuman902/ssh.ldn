"use client"

import type { ReactNode } from "react"

import { MapLayerHelpDemos } from "@/components/map/map-layer-help-demos"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import "@/components/map/map-controls.css"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"

type MapLayerHelpSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  timeSlot: NoiseTimeSlot
  audioEnabled: boolean
  audioSampleMode: "cursor" | "center"
}

const HelpSection = ({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: ReactNode
}) => (
  <section className="space-y-2">
    <div className="space-y-0.5">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{caption}</p>
    </div>
    {children}
  </section>
)

export const MapLayerHelpSheet = ({
  open,
  onOpenChange,
  audioSampleMode,
}: MapLayerHelpSheetProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left">
          <DrawerTitle>Map controls</DrawerTitle>
          <DrawerDescription>
            Watch the cluster, then use the matching buttons on the map.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-8">
          <HelpSection
            title="When"
            caption="Weekday or weekend, day or night."
          >
            <MapLayerHelpDemos.Time />
          </HelpSection>

          <HelpSection
            title="Noise layers"
            caption="Road, rail, aircraft, and nearby venues."
          >
            <MapLayerHelpDemos.Layers />
          </HelpSection>

          <HelpSection
            title="Visual layers"
            caption="Tube tracks and parks. Not a reading."
          >
            <MapLayerHelpDemos.Visual />
          </HelpSection>

          <HelpSection
            title="Sound preview"
            caption={
              audioSampleMode === "center"
                ? "Pan the map. Sound follows the centre crosshair."
                : "Move the cursor. Sound follows it."
            }
          >
            <MapLayerHelpDemos.Sound />
          </HelpSection>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
