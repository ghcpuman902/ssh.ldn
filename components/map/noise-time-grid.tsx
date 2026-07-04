"use client"

import { cn } from "@/lib/utils"
import {
  DEFRA_TIME_SLOT_NOTE,
  encodeNoiseTimeSlot,
  formatNoiseTimeSlot,
  NOISE_DAY_PARTS,
  type NoiseDayPart,
  type NoiseTimeSlot,
  type NoiseWeekSegment,
  WEEK_SEGMENT_LABELS,
} from "@/lib/map/noise-time"

type NoiseTimeGridProps = {
  value: NoiseTimeSlot;
  onChange: (slot: NoiseTimeSlot) => void;
};

const WEEK_SEGMENTS: NoiseWeekSegment[] = ["weekday", "weekend"];

const TimeCell = ({
  slot,
  selectedId,
  onChange,
}: {
  slot: NoiseTimeSlot;
  selectedId: string;
  onChange: (slot: NoiseTimeSlot) => void;
}) => {
  const slotId = encodeNoiseTimeSlot(slot);
  const isSelected = slotId === selectedId;
  const partLabel = NOISE_DAY_PARTS.find((p) => p.part === slot.part)?.label ?? "";

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-label={`${WEEK_SEGMENT_LABELS[slot.week]} ${partLabel}`}
      onClick={() => onChange(slot)}
      className={cn(
        "h-8 rounded-md border px-2 text-xs font-medium transition-colors",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
        slot.part === "night" && !isSelected && "bg-muted/70"
      )}
    >
      {WEEK_SEGMENT_LABELS[slot.week]}
    </button>
  );
};

export const NoiseTimeGrid = ({ value, onChange }: NoiseTimeGridProps) => {
  const selectedId = encodeNoiseTimeSlot(value);

  return (
    <div className="space-y-2 border-b border-border/50 pb-3">
      <div>
        <p className="text-sm font-medium text-foreground">When</p>
        <p className="text-xs text-muted-foreground">
          {formatNoiseTimeSlot(value)} ·{" "}
          {NOISE_DAY_PARTS.find((p) => p.part === value.part)?.hours}
        </p>
      </div>

      <div
        role="grid"
        aria-label="Weekday or weekend and day or night noise period"
        className="grid grid-cols-2 gap-1.5"
      >
        {NOISE_DAY_PARTS.map(({ part, label }) => (
          <div key={part} role="row" className="contents">
            <span
              role="rowheader"
              className="col-span-2 text-[10px] font-medium text-muted-foreground"
            >
              {label}
            </span>
            {WEEK_SEGMENTS.map((week) => (
              <TimeCell
                key={encodeNoiseTimeSlot({ week, part })}
                slot={{ week, part: part as NoiseDayPart }}
                selectedId={selectedId}
                onChange={onChange}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        {DEFRA_TIME_SLOT_NOTE}
      </p>
    </div>
  );
};
