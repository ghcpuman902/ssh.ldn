"use client"

import { Fragment } from "react"
import { Info } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  DEFRA_TIME_SLOT_NOTE,
  encodeNoiseTimeSlot,
  NOISE_DAY_PARTS,
  type NoiseDayPart,
  type NoiseTimeSlot,
  type NoiseWeekSegment,
  WEEK_SEGMENT_LABELS,
  WEEK_SEGMENT_LETTERS,
} from "@/lib/map/noise-time"

type NoiseTimeGridProps = {
  value: NoiseTimeSlot;
  onChange: (slot: NoiseTimeSlot) => void;
};

const WEEK_SEGMENTS = ["weekday", "weekend"] as const;

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
  const hours = partMeta?.hours ?? "";
  const barCount = BAR_COUNT[slot.week];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={isSelected}
          aria-label={`${WEEK_SEGMENT_LABELS[slot.week]} ${partLabel}, ${hours}`}
          onClick={() => onChange(slot)}
          className={cn(
            "inline-flex w-fit items-center justify-center rounded-2xl border p-1.5 transition-colors",
            slot.part === "day" ? "h-10" : "h-7",
            getButtonStyles(slot, isSelected)
          )}
        >
          <div className="flex h-full items-stretch gap-0.5" aria-hidden="true">
            {Array.from({ length: barCount }, (_, index) => (
              <span
                key={index}
                className={cn("w-2 rounded-lg", getBarStyles(slot, isSelected))}
              />
            ))}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {WEEK_SEGMENT_LABELS[slot.week]} {partLabel.toLowerCase()} · {hours}
      </TooltipContent>
    </Tooltip>
  );
};

export const NoiseTimeGrid = ({ value, onChange }: NoiseTimeGridProps) => {
  const selectedId = encodeNoiseTimeSlot(value);

  return (
    <div className="w-fit space-y-1.5 border-b border-border/50 pb-3">
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium text-foreground">When</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About these time periods"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-56 flex-col items-start whitespace-normal">
            {DEFRA_TIME_SLOT_NOTE}
          </TooltipContent>
        </Tooltip>
      </div>

      <div
        role="group"
        aria-label="Weekday or weekend and day or night noise period"
        className="grid w-fit grid-cols-[auto_auto_auto] items-center gap-1.5"
      >
        <div aria-hidden="true" />
        {WEEK_SEGMENTS.map((week) => (
          <p
            key={week}
            className="text-center text-[10px] font-medium tracking-wide text-muted-foreground"
          >
            {WEEK_SEGMENT_LETTERS[week]}
          </p>
        ))}

        {NOISE_DAY_PARTS.map(({ part, label }) => (
          <Fragment key={part}>
            <p className="pr-1 text-xs font-medium text-muted-foreground">
              {label}
            </p>
            {WEEK_SEGMENTS.map((week) => (
              <TimeSlotButton
                key={encodeNoiseTimeSlot({ week, part: part as NoiseDayPart })}
                slot={{ week, part: part as NoiseDayPart }}
                selectedId={selectedId}
                onChange={onChange}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
};
