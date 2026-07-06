"use client"

import { Info, Volume2, VolumeX } from "lucide-react"

import {
  MapTooltipContent,
  NoiseTimeGrid,
} from "@/components/map/noise-time-grid"
import {
  NoiseLayerGaugeRing,
  type GaugeSegment,
} from "@/components/map/noise-layer-gauge-ring"
import type { NoiseLayerVisibility } from "@/components/map/noise-map-layers"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { getDefraCredit, OSM_NIGHTLIFE_CREDIT } from "@/lib/map/data-credits"
import { DEFRA_MAP_LAYERS } from "@/lib/map/defra-layers"
import type { NoiseAudioChannelLevels } from "@/lib/map/noise-audio-map"
import {
  LOCAL_AMENITY_META,
  NOISE_CONTRIBUTOR_META,
} from "@/lib/map/noise-contributor-meta"
import {
  DEFAULT_VISUAL_LAYER_VISIBILITY,
  VISUAL_LAYER_META,
  VISUAL_LAYER_ORDER,
  type VisualLayerKey,
  type VisualLayerVisibility,
} from "@/lib/map/visual-layers"
import type { LocalAmenityLevels } from "@/hooks/use-cursor-noise"
import { LOCAL_NOISE_AMENITIES } from "@/lib/map/venue-time"
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
  description: string
  datasetUrl: string
  gaugePhase: number
  gaugeColor: string
}

const LAYER_META: Record<LayerKey, LayerMeta> = {
  road: {
    emoji: NOISE_CONTRIBUTOR_META.road.emoji,
    label: DEFRA_MAP_LAYERS.road.label,
    description: DEFRA_MAP_LAYERS.road.description,
    datasetUrl: getDefraCredit("road").datasetUrl,
    gaugePhase: 0,
    gaugeColor: NOISE_CONTRIBUTOR_META.road.strokeColor,
  },
  rail: {
    emoji: NOISE_CONTRIBUTOR_META.rail.emoji,
    label: DEFRA_MAP_LAYERS.rail.label,
    description: DEFRA_MAP_LAYERS.rail.description,
    datasetUrl: getDefraCredit("rail").datasetUrl,
    gaugePhase: 1.2,
    gaugeColor: NOISE_CONTRIBUTOR_META.rail.strokeColor,
  },
  airport: {
    emoji: NOISE_CONTRIBUTOR_META.airport.emoji,
    label: DEFRA_MAP_LAYERS.airport.label,
    description: DEFRA_MAP_LAYERS.airport.description,
    datasetUrl: getDefraCredit("airport").datasetUrl,
    gaugePhase: 2.4,
    gaugeColor: NOISE_CONTRIBUTOR_META.airport.strokeColor,
  },
  nightlife: {
    emoji: NOISE_CONTRIBUTOR_META.nightlife.emoji,
    label: "Local noise sources",
    description:
      "OSM pubs, bars, clubs, music venues, and hospitals — activity from opening hours",
    datasetUrl: OSM_NIGHTLIFE_CREDIT.datasetUrl,
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={active}
          aria-label={`Toggle ${meta.label}`}
          onClick={() => onToggle(layerKey, !active)}
          className={cn(
            "relative flex size-[29px] items-center justify-center overflow-hidden rounded-full border transition-colors",
            active ? "border-border bg-white" : "border-border/40 bg-white/50"
          )}
        >
          <NoiseLayerGaugeRing
            active={active}
            level={level}
            segments={segments}
            phase={phase}
            color={color}
          />
          <span className="relative z-10 text-sm leading-none" aria-hidden="true">
            {meta.emoji}
          </span>
          {!active ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <span className="h-px w-[140%] rotate-45 bg-border/70" />
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <MapTooltipContent
        side="left"
        className="max-w-56 flex-col items-start gap-1 py-2 whitespace-normal"
      >
        <p className="font-medium">{meta.label}</p>
        <p className="text-muted-foreground">{meta.description}</p>
        <a
          href={meta.datasetUrl}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2 hover:text-primary"
        >
          Dataset details ↗
        </a>
      </MapTooltipContent>
    </Tooltip>
  )
}

const VisualLayerToggle = ({
  layerKey,
  active,
  onToggle,
}: {
  layerKey: VisualLayerKey
  active: boolean
  onToggle: (key: VisualLayerKey, next: boolean) => void
}) => {
  const meta = VISUAL_LAYER_META[layerKey]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={active}
          aria-label={`Toggle ${meta.label}`}
          onClick={() => onToggle(layerKey, !active)}
          className={cn(
            "relative flex size-[29px] items-center justify-center overflow-hidden rounded-full border transition-colors",
            active ? "border-border bg-white" : "border-border/40 bg-white/50"
          )}
        >
          <span className="text-sm leading-none" aria-hidden="true">
            {meta.emoji}
          </span>
          {!active ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="h-px w-[140%] rotate-45 bg-border/70" />
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <MapTooltipContent
        side="left"
        className="max-w-56 flex-col items-start gap-1 py-2 whitespace-normal"
      >
        <p className="font-medium">{meta.label}</p>
        <p className="text-muted-foreground">{meta.description}</p>
        <a
          href={meta.datasetUrl}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2 hover:text-primary"
        >
          Dataset details ↗
        </a>
      </MapTooltipContent>
    </Tooltip>
  )
}

const getAudioTooltipText = (
  audioEnabled: boolean,
  audioSampleMode: "cursor" | "center"
) => {
  if (audioEnabled) {
    return audioSampleMode === "center"
      ? "Sound preview on — pan the map under the crosshair."
      : "Sound preview on — move over visible noise layers."
  }

  return audioSampleMode === "center"
    ? "Turn representative sound preview on — samples map centre."
    : "Turn representative sound preview on — samples cursor position."
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
  const handleToggle = (key: LayerKey, checked: boolean) => {
    onVisibilityChange({ ...visibility, [key]: checked })
  }

  const handleVisualToggle = (key: VisualLayerKey, checked: boolean) => {
    onVisualVisibilityChange?.({ ...visualVisibility, [key]: checked })
  }

  const handleAudioToggle = () => {
    onAudioEnabledChange(!audioEnabled)
  }

  const nightlifeSegments = visibility.nightlife
    ? buildNightlifeSegments(localAmenityPercentages)
    : undefined

  return (
    <section
      aria-label="Noise map layers"
      className="inline-flex w-fit max-w-[calc(100vw-2rem)] flex-col items-end rounded-2xl bg-transparent"
    >
      <NoiseTimeGrid value={timeSlot} onChange={onTimeSlotChange} />

      <div className="mt-3 mb-2 flex w-full items-center justify-end gap-0.5">
        <p className="text-xs font-medium text-foreground">Noise layers</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About these layers"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3" />
            </button>
          </TooltipTrigger>
          <MapTooltipContent
            side="left"
            className="max-w-56 flex-col items-start whitespace-normal"
          >
            Strategic DEFRA maps — annual averages, not live measurement.
          </MapTooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
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
                "flex size-6 items-center justify-center rounded-full text-foreground transition-colors",
                audioEnabled
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-muted-foreground/70 hover:bg-muted/60 hover:text-muted-foreground"
              )}
            >
              {audioEnabled ? (
                <Volume2 className="size-3.5" aria-hidden="true" />
              ) : (
                <VolumeX className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <MapTooltipContent side="left" className="max-w-56 whitespace-normal">
            {getAudioTooltipText(audioEnabled, audioSampleMode)}
          </MapTooltipContent>
        </Tooltip>
      </div>

      <div
        role="group"
        aria-label="Noise layer visibility"
        className="flex w-fit flex-row gap-1"
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

      <div className="mt-3 mb-2 flex w-full items-center justify-end gap-0.5">
        <p className="text-xs font-medium text-foreground">Visual layers</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About visual layers"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3" />
            </button>
          </TooltipTrigger>
          <MapTooltipContent
            side="left"
            className="max-w-56 flex-col items-start whitespace-normal"
          >
            Context overlays for transport and greenery — not noise measurements.
          </MapTooltipContent>
        </Tooltip>
      </div>

      <div
        role="group"
        aria-label="Visual layer visibility"
        className="flex w-fit flex-row gap-1"
      >
        {VISUAL_LAYER_ORDER.map((key) => (
          <VisualLayerToggle
            key={key}
            layerKey={key}
            active={visualVisibility[key]}
            onToggle={handleVisualToggle}
          />
        ))}
      </div>
    </section>
  )
}
