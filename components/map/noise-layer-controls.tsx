"use client"

import { Info } from "lucide-react"

import { NoiseTimeGrid } from "@/components/map/noise-time-grid"
import type { NoiseLayerVisibility } from "@/components/map/noise-map-layers"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getDefraCredit, OSM_NIGHTLIFE_CREDIT, OSM_RAIL_CREDIT } from "@/lib/map/data-credits"
import { DEFRA_MAP_LAYERS } from "@/lib/map/defra-layers"
import { cn } from "@/lib/utils"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"

type NoiseLayerControlsProps = {
  visibility: NoiseLayerVisibility;
  timeSlot: NoiseTimeSlot;
  onVisibilityChange: (next: NoiseLayerVisibility) => void;
  onTimeSlotChange: (slot: NoiseTimeSlot) => void;
};

type LayerKey = keyof NoiseLayerVisibility;

type LayerMeta = {
  emoji: string;
  label: string;
  description: string;
  datasetUrl: string;
};

const LAYER_META: Record<LayerKey, LayerMeta> = {
  road: {
    emoji: "🚗",
    label: DEFRA_MAP_LAYERS.road.label,
    description: DEFRA_MAP_LAYERS.road.description,
    datasetUrl: getDefraCredit("road").datasetUrl,
  },
  rail: {
    emoji: "🚆",
    label: DEFRA_MAP_LAYERS.rail.label,
    description: DEFRA_MAP_LAYERS.rail.description,
    datasetUrl: getDefraCredit("rail").datasetUrl,
  },
  airport: {
    emoji: "✈️",
    label: DEFRA_MAP_LAYERS.airport.label,
    description: DEFRA_MAP_LAYERS.airport.description,
    datasetUrl: getDefraCredit("airport").datasetUrl,
  },
  railLines: {
    emoji: "🛤️",
    label: "Rail tracks",
    description:
      "OSM overground track geometry — reference layer under rail noise heatmap",
    datasetUrl: OSM_RAIL_CREDIT.datasetUrl,
  },
  nightlife: {
    emoji: "🍺",
    label: "Nightlife venues",
    description:
      "OSM pubs, bars, clubs, and music venues. Time-slot activity from opening hours or amenity heuristics.",
    datasetUrl: OSM_NIGHTLIFE_CREDIT.datasetUrl,
  },
};

const LAYER_ORDER: LayerKey[] = ["road", "rail", "airport", "railLines", "nightlife"];

const LayerToggle = ({
  layerKey,
  active,
  onToggle,
}: {
  layerKey: LayerKey;
  active: boolean;
  onToggle: (key: LayerKey, next: boolean) => void;
}) => {
  const meta = LAYER_META[layerKey];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={active}
          aria-label={`Toggle ${meta.label}`}
          onClick={() => onToggle(layerKey, !active)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border transition-colors",
            active
              ? "border-primary bg-primary ring-1 ring-primary/30"
              : "border-border bg-muted hover:bg-accent"
          )}
        >
          <span
            className={cn("text-lg leading-none", !active && "opacity-60")}
            aria-hidden="true"
          >
            {meta.emoji}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="max-w-56 flex-col items-start gap-1 whitespace-normal py-2"
      >
        <p className="font-medium">{meta.label}</p>
        <p className="text-background/75">{meta.description}</p>
        <a
          href={meta.datasetUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-background"
        >
          Dataset details ↗
        </a>
      </TooltipContent>
    </Tooltip>
  );
};

export const NoiseLayerControls = ({
  visibility,
  timeSlot,
  onVisibilityChange,
  onTimeSlotChange,
}: NoiseLayerControlsProps) => {
  const handleToggle = (key: LayerKey, checked: boolean) => {
    onVisibilityChange({ ...visibility, [key]: checked });
  };

  return (
    <section
      aria-label="Noise map layers"
      className="inline-flex w-fit max-w-[calc(100vw-2rem)] flex-col items-end rounded-2xl bg-transparent p-3"
    >
      <NoiseTimeGrid value={timeSlot} onChange={onTimeSlotChange} />

      <div className="mb-2 mt-3 flex items-center gap-1">
        <p className="text-sm font-medium text-foreground">Noise layers</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About these layers"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-56 flex-col items-start whitespace-normal">
            Strategic DEFRA maps — annual averages, not live measurement.
          </TooltipContent>
        </Tooltip>
      </div>

      <div
        role="group"
        aria-label="Noise layer visibility"
        className="flex w-fit flex-col gap-2"
      >
        {LAYER_ORDER.map((key) => (
          <LayerToggle
            key={key}
            layerKey={key}
            active={visibility[key]}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </section>
  );
};
