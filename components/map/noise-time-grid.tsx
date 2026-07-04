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

const WEEKDAY_BAR_COUNT = 5;
const WEEKEND_BAR_COUNT = 2;

const BAR_COUNT: Record<NoiseWeekSegment, number> = {
  weekday: WEEKDAY_BAR_COUNT,
  weekend: WEEKEND_BAR_COUNT,
};

const getButtonStyles = (
  slot: NoiseTimeSlot,
  isSelected: boolean
): string => {
  const { week, part } = slot;
  const isNight = part === "night";
  const isWeekend = week === "weekend";

  if (isSelected) {
    if (isWeekend && isNight) {
      return "border-violet-400/70 bg-violet-200/50 ring-1 ring-violet-400/30";
    }
    if (isWeekend) {
      return "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30";
    }
    if (isNight) {
      return "border-zinc-400 bg-zinc-300/70 ring-1 ring-zinc-400/30";
    }
    return "border-primary bg-primary/10 ring-1 ring-primary/30";
  }

  if (isWeekend && isNight) {
    return "border-zinc-300/80 bg-zinc-200/70 hover:border-violet-400/50 hover:bg-violet-100/70";
  }
  if (isWeekend) {
    return "border-violet-200/80 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-100/80";
  }
  if (isNight) {
    return "border-zinc-300/80 bg-zinc-200/70 hover:border-zinc-400 hover:bg-zinc-300/70";
  }
  return "border-border/60 bg-muted/30 hover:border-border hover:bg-muted/50";
};

const getBarStyles = (slot: NoiseTimeSlot, isSelected: boolean): string => {
  const { week, part } = slot;
  const isNight = part === "night";
  const isWeekend = week === "weekend";

  if (isSelected) {
    if (isWeekend) return "bg-violet-500";
    if (isNight) return "bg-zinc-500";
    return "bg-primary";
  }

  if (isWeekend && isNight) return "bg-violet-400/65";
  if (isWeekend) return "bg-violet-400/55";
  if (isNight) return "bg-zinc-400/70";
  return "bg-foreground/25";
};

const TimeSlotButton = ({
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
  const partMeta = NOISE_DAY_PARTS.find((p) => p.part === slot.part);
  const partLabel = partMeta?.label ?? "";
  const barCount = BAR_COUNT[slot.week];

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`${WEEK_SEGMENT_LABELS[slot.week]} ${partLabel}`}
      onClick={() => onChange(slot)}
      className={cn(
        "inline-flex items-stretch rounded-2xl border p-1.5 transition-colors",
        slot.part === "day" ? "h-10" : "h-7",
        getButtonStyles(slot, isSelected)
      )}
    >
      <div className="flex items-stretch gap-0.5" aria-hidden="true">
        {Array.from({ length: barCount }, (_, index) => (
          <span
            key={index}
            className={cn(
              "w-2 rounded-lg",
              getBarStyles(slot, isSelected)
            )}
          />
        ))}
      </div>
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
        role="group"
        aria-label="Weekday or weekend and day or night noise period"
        className="inline-grid w-fit grid-cols-[auto_auto] gap-1"
      >
        {NOISE_DAY_PARTS.flatMap(({ part }) =>
          (["weekday", "weekend"] as const).map((week) => (
            <TimeSlotButton
              key={encodeNoiseTimeSlot({ week, part })}
              slot={{ week, part: part as NoiseDayPart }}
              selectedId={selectedId}
              onChange={onChange}
            />
          ))
        )}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        {DEFRA_TIME_SLOT_NOTE}
      </p>
    </div>
  );
};
