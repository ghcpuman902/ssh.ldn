"use client"

import { NoiseTimeGrid } from "@/components/map/noise-time-grid"
import type { NoiseLayerVisibility } from "@/components/map/noise-map-layers"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DEFRA_MAP_KINDS,
  DEFRA_MAP_LAYERS,
} from "@/lib/map/defra-layers"
import type { NoiseTimeSlot } from "@/lib/map/noise-time"

type NoiseLayerControlsProps = {
  visibility: NoiseLayerVisibility;
  timeSlot: NoiseTimeSlot;
  onVisibilityChange: (next: NoiseLayerVisibility) => void;
  onTimeSlotChange: (slot: NoiseTimeSlot) => void;
};

const RAIL_LINES_META = {
  label: "Rail tracks",
  description: "OSM overground lines (excludes tube tunnels)",
};

export const NoiseLayerControls = ({
  visibility,
  timeSlot,
  onVisibilityChange,
  onTimeSlotChange,
}: NoiseLayerControlsProps) => {
  const handleToggle = (key: keyof NoiseLayerVisibility, checked: boolean) => {
    onVisibilityChange({ ...visibility, [key]: checked });
  };

  return (
    <section
      aria-label="Noise map layers"
      className="pointer-events-auto w-[min(100%,20rem)] rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur-md"
    >
      <NoiseTimeGrid value={timeSlot} onChange={onTimeSlotChange} />

      <div className="mb-2 mt-3">
        <p className="text-sm font-medium text-foreground">Noise layers</p>
        <p className="text-xs text-muted-foreground">
          Strategic maps — not live measurement
        </p>
      </div>

      <ul className="space-y-2">
        {DEFRA_MAP_KINDS.map((kind) => (
          <li key={kind} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor={`layer-${kind}`} className="text-sm font-normal">
                {DEFRA_MAP_LAYERS[kind].label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {DEFRA_MAP_LAYERS[kind].description}
              </p>
            </div>
            <Switch
              id={`layer-${kind}`}
              checked={visibility[kind]}
              onCheckedChange={(checked) => handleToggle(kind, checked)}
              aria-label={`Toggle ${DEFRA_MAP_LAYERS[kind].label}`}
            />
          </li>
        ))}

        <li className="flex items-start justify-between gap-3 border-t border-border/50 pt-2">
          <div className="min-w-0">
            <Label htmlFor="layer-railLines" className="text-sm font-normal">
              {RAIL_LINES_META.label}
            </Label>
            <p className="text-xs text-muted-foreground">
              {RAIL_LINES_META.description}
            </p>
          </div>
          <Switch
            id="layer-railLines"
            checked={visibility.railLines}
            onCheckedChange={(checked) => handleToggle("railLines", checked)}
            aria-label={`Toggle ${RAIL_LINES_META.label}`}
          />
        </li>
      </ul>
    </section>
  );
};
