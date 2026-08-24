"use client"

import { useState } from "react"
import { Info, Volume2, VolumeX } from "lucide-react"

import {
  NoiseTimeGrid,
  OptionalMapTooltip,
} from "@/components/map/noise-time-grid"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  NoiseLayerGaugeRing,
  type GaugeSegment,
} from "@/components/map/noise-layer-gauge-ring"
import type { NoiseLayerVisibility } from "@/components/map/noise-map-layers"
import { VISUAL_LAYER_ICON } from "@/components/map/transit-mode-icon"
import { DEFRA_MAP_LAYERS } from "@/lib/map/defra-layers"
import type { NoiseAudioChannelLevels } from "@/lib/map/noise-audio-map"
import {
  LOCAL_AMENITY_META,
  NOISE_CONTRIBUTOR_META,
} from "@/lib/map/noise-contributor-meta"
import {
  DEFAULT_VISUAL_LAYER_VISIBILITY,
  TRANSIT_VISUAL_LAYER_KEYS,
  VISUAL_LAYER_META,
  type VisualLayerVisibility,
} from "@/lib/map/visual-layers"
import type { LocalAmenityLevels } from "@/hooks/use-cursor-noise"
import { LOCAL_NOISE_AMENITIES } from "@/lib/map/venue-time"
import { noiseAudioEngine } from "@/lib/map/noise-audio-engine"
import { cn } from "@/lib/utils"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"

type NoiseLayerControlsProps = {
  visibility: NoiseLayerVisibility
  visualVisibility?: VisualLayerVisibility
  timeSlot: NoiseTimeSlot
  intensityPercentages: NoiseAudioChannelLevels
  localAmenityPercentages: LocalAmenityLevels
  audioEnabled: boolean
  audioSampleMode?: "cursor" | "center"
  onVisibilityChange: (next: NoiseLayerVisibility) => void
  onVisualVisibilityChange?: (next: VisualLayerVisibility) => void
  onTimeSlotChange: (slot: NoiseTimeSlot) => void
  onAudioEnabledChange: (enabled: boolean) => void
}

type LayerKey = keyof NoiseLayerVisibility

type LayerMeta = {
  emoji: string
  label: string
  gaugePhase: number
  gaugeColor: string
}

const LAYER_META: Record<LayerKey, LayerMeta> = {
  road: {
    emoji: NOISE_CONTRIBUTOR_META.road.emoji,
    label: DEFRA_MAP_LAYERS.road.label,
    gaugePhase: 0,
    gaugeColor: NOISE_CONTRIBUTOR_META.road.strokeColor,
  },
  rail: {
    emoji: NOISE_CONTRIBUTOR_META.rail.emoji,
    label: DEFRA_MAP_LAYERS.rail.label,
    gaugePhase: 1.2,
    gaugeColor: NOISE_CONTRIBUTOR_META.rail.strokeColor,
  },
  airport: {
    emoji: NOISE_CONTRIBUTOR_META.airport.emoji,
    label: DEFRA_MAP_LAYERS.airport.label,
    gaugePhase: 2.4,
    gaugeColor: NOISE_CONTRIBUTOR_META.airport.strokeColor,
  },
  nightlife: {
    emoji: NOISE_CONTRIBUTOR_META.nightlife.emoji,
    label: "Local noise sources",
    gaugePhase: 3.6,
    gaugeColor: NOISE_CONTRIBUTOR_META.nightlife.strokeColor,
  },
}

const LAYER_ORDER: LayerKey[] = ["road", "rail", "airport", "nightlife"]

const LAYER_GAUGE_LEVEL: Record<
  Exclude<LayerKey, "nightlife">,
  keyof NoiseAudioChannelLevels
> = {
  road: "road",
  rail: "rail",
  airport: "airport",
}

const buildNightlifeSegments = (
  localAmenityPercentages: LocalAmenityLevels
): GaugeSegment[] =>
  LOCAL_NOISE_AMENITIES.map((amenity) => ({
    id: amenity,
    value: localAmenityPercentages[amenity],
    color: LOCAL_AMENITY_META[amenity].strokeColor,
  })).filter((segment) => segment.value > 0)

const useTogglePress = () => {
  const [pressed, setPressed] = useState(false)

  return {
    pressed,
    pressHandlers: {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return
        setPressed(true)
      },
      onPointerUp: () => setPressed(false),
      onPointerLeave: () => setPressed(false),
      onPointerCancel: () => setPressed(false),
    },
  }
}

const toggleSurfaceClass = (
  active: boolean,
  pressed: boolean,
  shapeClass: string
) =>
  cn(
    "relative flex size-full items-center justify-center overflow-hidden border border-border bg-background",
    "ease transition-[transform,filter] duration-150 will-change-transform",
    "motion-reduce:transition-none",
    shapeClass,
    pressed ? "scale-[0.8]" : active ? "scale-100" : "scale-90",
    active ? "saturate-100" : "grayscale-[0.35] saturate-50"
  )

const LayerToggle = ({
  layerKey,
  active,
  level,
  segments,
  phase,
  color,
  onToggle,
}: {
  layerKey: LayerKey
  active: boolean
  level?: number
  segments?: GaugeSegment[]
  phase: number
  color: string
  onToggle: (key: LayerKey, next: boolean) => void
}) => {
  const meta = LAYER_META[layerKey]
  const { pressed, pressHandlers } = useTogglePress()
  const isMobile = useIsMobile()

  return (
    <OptionalMapTooltip
      enabled={!isMobile}
      side="bottom"
      className="whitespace-nowrap"
      content={meta.label}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`Toggle ${meta.label}`}
        onClick={() => onToggle(layerKey, !active)}
        {...pressHandlers}
        className="relative flex size-7 cursor-pointer touch-manipulation items-center justify-center rounded-full p-0 select-none md:size-8"
      >
        <span className={toggleSurfaceClass(active, pressed, "rounded-full")}>
          <NoiseLayerGaugeRing
            active={active}
            level={level}
            segments={segments}
            phase={phase}
            color={color}
          />
          <span
            className="relative z-10 text-sm leading-none"
            aria-hidden="true"
          >
            {meta.emoji}
          </span>
          {!active ? <VisualLayerStrike /> : null}
        </span>
      </button>
    </OptionalMapTooltip>
  )
}

const VisualLayerStrike = () => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
  >
    <span className="h-px w-[140%] rotate-45 bg-border/70" />
  </span>
)

const TubeLayerToggle = ({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: (next: boolean) => void
}) => {
  const { pressed, pressHandlers } = useTogglePress()
  const isMobile = useIsMobile()

  return (
    <OptionalMapTooltip
      enabled={!isMobile}
      side="bottom"
      className="whitespace-nowrap"
      content="Tube, Overground, Elizabeth, DLR & tram"
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={
          active
            ? "Hide Tube, Overground, Elizabeth, DLR, and tram layers"
            : "Show Tube, Overground, Elizabeth, DLR, and tram layers"
        }
        onClick={() => onToggle(!active)}
        {...pressHandlers}
        className="relative flex size-7 cursor-pointer touch-manipulation items-center justify-center rounded-full p-0 select-none md:size-8"
      >
        <span className={toggleSurfaceClass(active, pressed, "rounded-full")}>
          <span
            className="relative z-10 flex items-center justify-center"
            aria-hidden="true"
          >
            {VISUAL_LAYER_ICON.tube}
          </span>
          {!active ? <VisualLayerStrike /> : null}
        </span>
      </button>
    </OptionalMapTooltip>
  )
}

const GreenSpacesToggle = ({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: (next: boolean) => void
}) => {
  const { pressed, pressHandlers } = useTogglePress()
  const meta = VISUAL_LAYER_META.greenSpaces
  const isMobile = useIsMobile()

  return (
    <OptionalMapTooltip
      enabled={!isMobile}
      side="bottom"
      className="whitespace-nowrap"
      content={meta.label}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`Toggle ${meta.label}`}
        onClick={() => onToggle(!active)}
        {...pressHandlers}
        className="relative flex size-7 cursor-pointer touch-manipulation items-center justify-center rounded-full p-0 select-none md:size-8"
      >
        <span className={toggleSurfaceClass(active, pressed, "rounded-full")}>
          <span
            className="relative z-10 flex items-center justify-center"
            aria-hidden="true"
          >
            {VISUAL_LAYER_ICON.greenSpaces}
          </span>
          {!active ? <VisualLayerStrike /> : null}
        </span>
      </button>
    </OptionalMapTooltip>
  )
}

const getAudioTooltipText = (
  audioEnabled: boolean,
  audioSampleMode: "cursor" | "center"
) => {
  if (audioEnabled) {
    return audioSampleMode === "center"
      ? "On. Sound follows the map centre."
      : "On. Sound follows the cursor."
  }

  return audioSampleMode === "center"
    ? "Hear a rough mix from the map centre."
    : "Hear a rough mix under the cursor."
}

export const NoiseLayerControls = ({
  visibility,
  visualVisibility = DEFAULT_VISUAL_LAYER_VISIBILITY,
  timeSlot,
  intensityPercentages,
  localAmenityPercentages,
  audioEnabled,
  audioSampleMode = "cursor",
  onVisibilityChange,
  onVisualVisibilityChange,
  onTimeSlotChange,
  onAudioEnabledChange,
}: NoiseLayerControlsProps) => {
  const isMobile = useIsMobile()
  const unlockNoiseAudio = () => {
    noiseAudioEngine.unlockFromUserGesture()
    if (audioEnabled) {
      void noiseAudioEngine.enable()
    }
  }

  const handleToggle = (key: LayerKey, checked: boolean) => {
    unlockNoiseAudio()
    onVisibilityChange({ ...visibility, [key]: checked })
  }

  const transitLayersActive = TRANSIT_VISUAL_LAYER_KEYS.some(
    (key) => visualVisibility[key]
  )

  const handleTransitToggle = (checked: boolean) => {
    const next = { ...visualVisibility }
    for (const key of TRANSIT_VISUAL_LAYER_KEYS) {
      next[key] = checked
    }
    onVisualVisibilityChange?.(next)
  }

  const handleGreenSpacesToggle = (checked: boolean) => {
    onVisualVisibilityChange?.({
      ...visualVisibility,
      greenSpaces: checked,
    })
  }

  const handleAudioToggle = () => {
    noiseAudioEngine.unlockFromUserGesture()
    if (!audioEnabled) {
      void noiseAudioEngine.enable()
    }
    onAudioEnabledChange(!audioEnabled)
  }

  const nightlifeSegments = visibility.nightlife
    ? buildNightlifeSegments(localAmenityPercentages)
    : undefined

  return (
    <section
      aria-label="Noise map layers"
      className="pointer-events-none inline-flex w-fit max-w-[calc(100vw-2rem)] flex-col items-end"
    >
      <NoiseTimeGrid value={timeSlot} onChange={onTimeSlotChange} />

      <div className="map-layer-group mt-2 flex flex-col items-end">
        <div className="pointer-events-auto mb-1.5 hidden w-fit items-center justify-end gap-1 self-end md:flex">
          <OptionalMapTooltip
            enabled={!isMobile}
            side="bottom"
            className="max-w-56 whitespace-normal"
            content={getAudioTooltipText(audioEnabled, audioSampleMode)}
          >
            <button
              type="button"
              aria-pressed={audioEnabled}
              aria-label={
                audioEnabled
                  ? "Turn representative sound preview off"
                  : "Turn representative sound preview on"
              }
              onClick={handleAudioToggle}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background shadow-sm transition-colors md:size-4",
                audioEnabled
                  ? "text-primary hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {audioEnabled ? (
                <Volume2 className="size-3.5 md:size-2.5" aria-hidden="true" />
              ) : (
                <VolumeX className="size-3.5 md:size-2.5" aria-hidden="true" />
              )}
            </button>
          </OptionalMapTooltip>
          <p className="text-xs font-medium text-foreground max-md:text-[11px]">
            Noise layers
          </p>
          <OptionalMapTooltip
            enabled={!isMobile}
            side="bottom"
            className="max-w-56 flex-col items-start whitespace-normal"
            content="Yearly DEFRA averages, not live readings."
          >
            <button
              type="button"
              aria-label="About these layers"
              className="hidden text-muted-foreground/70 transition-colors hover:text-muted-foreground md:inline-flex"
            >
              <Info className="size-3" />
            </button>
          </OptionalMapTooltip>
        </div>

        <div
          role="group"
          aria-label="Noise layer visibility"
          className="map-layer-icons pointer-events-auto flex w-fit flex-row gap-1"
        >
          {LAYER_ORDER.map((key) => {
            const meta = LAYER_META[key]

            if (key === "nightlife") {
              return (
                <LayerToggle
                  key={key}
                  layerKey={key}
                  active={visibility[key]}
                  segments={nightlifeSegments}
                  phase={meta.gaugePhase}
                  color={meta.gaugeColor}
                  onToggle={handleToggle}
                />
              )
            }

            const gaugeKey = LAYER_GAUGE_LEVEL[key]

            return (
              <LayerToggle
                key={key}
                layerKey={key}
                active={visibility[key]}
                level={visibility[key] ? intensityPercentages[gaugeKey] : 0}
                phase={meta.gaugePhase}
                color={meta.gaugeColor}
                onToggle={handleToggle}
              />
            )
          })}
        </div>
      </div>

      <div className="map-layer-group mt-2 flex flex-col items-end">
        <div className="pointer-events-auto mb-1.5 hidden w-fit items-center justify-end gap-0.5 self-end md:flex">
          <p className="text-xs font-medium text-foreground max-md:text-[11px]">
            Visual layers
          </p>
          <OptionalMapTooltip
            enabled={!isMobile}
            side="bottom"
            className="max-w-56 flex-col items-start whitespace-normal"
            content="TfL lines and greenery. Not noise."
          >
            <button
              type="button"
              aria-label="About visual layers"
              className="hidden text-muted-foreground/70 transition-colors hover:text-muted-foreground md:inline-flex"
            >
              <Info className="size-3" />
            </button>
          </OptionalMapTooltip>
        </div>

        <div
          role="group"
          aria-label="Visual layer visibility"
          className="map-layer-icons pointer-events-auto flex w-fit flex-row gap-1"
        >
          <TubeLayerToggle
            active={transitLayersActive}
            onToggle={handleTransitToggle}
          />
          <GreenSpacesToggle
            active={visualVisibility.greenSpaces}
            onToggle={handleGreenSpacesToggle}
          />
        </div>
      </div>
    </section>
  )
}
