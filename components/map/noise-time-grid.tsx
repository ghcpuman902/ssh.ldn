"use client"

import { Fragment, type ComponentProps } from "react"
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

export const MAP_TOOLTIP_CONTENT_CLASS =
  "border border-border bg-popover text-popover-foreground shadow-md";

export const MAP_TOOLTIP_ARROW_CLASS = "bg-popover fill-popover";

export const MapTooltipContent = ({
  className,
  ...props
}: ComponentProps<typeof TooltipContent>) => (
  <TooltipContent
    arrowClassName={MAP_TOOLTIP_ARROW_CLASS}
    className={cn(MAP_TOOLTIP_CONTENT_CLASS, className)}
    {...props}
  />
);

const WEEK_SEGMENTS = ["weekday", "weekend"] as const;

const WEEKDAY_BAR_COUNT = 5;
const WEEKEND_BAR_COUNT = 2;

const BAR_COUNT: Record<NoiseWeekSegment, number> = {
  weekday: WEEKDAY_BAR_COUNT,
  weekend: WEEKEND_BAR_COUNT,
};

/** w-1.5 (6px); bar gap and column gap are derived from this width. */
const NOISE_BAR_WIDTH_CLASS = "w-1.5";
const NOISE_BAR_GAP_CLASS = "gap-[3px]";
const NOISE_BAR_ROW_CLASS = cn("flex items-stretch", NOISE_BAR_GAP_CLASS);
const NOISE_GROUP_GAP_CLASS = "gap-x-1.5 gap-y-1";

const getButtonStyles = (
  slot: NoiseTimeSlot,
  isSelected: boolean
): string => {
  const { week, part } = slot;
  const isNight = part === "night";
  const isWeekend = week === "weekend";

  if (isSelected) {
    if (isWeekend && isNight) return "border-violet-700 bg-background";
    if (isWeekend) return "border-violet-500 bg-background";
    if (isNight) return "border-zinc-600 bg-background";
    return "border-primary bg-background";
  }

  if (isWeekend && isNight) {
    return "border-transparent bg-muted/55 hover:bg-muted/70";
  }
  if (isWeekend) {
    return "border-transparent bg-background/30 hover:bg-background/45";
  }
  if (isNight) {
    return "border-transparent bg-muted/55 hover:bg-muted/70";
  }
  return "border-transparent bg-background/30 hover:bg-background/45";
};

const getBarStyles = (slot: NoiseTimeSlot, isSelected: boolean): string => {
  const { week, part } = slot;
  const isNight = part === "night";
  const isWeekend = week === "weekend";

  if (isSelected) {
    if (isWeekend && isNight) return "bg-violet-700";
    if (isWeekend) return "bg-violet-500";
    if (isNight) return "bg-zinc-600";
    return "bg-primary";
  }

  if (isWeekend && isNight) return "bg-violet-600/50";
  if (isWeekend) return "bg-violet-500/40";
  if (isNight) return "bg-zinc-400/55";
  return "bg-primary/35";
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
            "inline-flex w-fit items-center justify-center rounded-lg border p-1 transition-colors",
            slot.part === "day" ? "h-7" : "h-5",
            getButtonStyles(slot, isSelected)
          )}
        >
          <div className={cn("h-full", NOISE_BAR_ROW_CLASS)} aria-hidden="true">
            {Array.from({ length: barCount }, (_, index) => (
              <span
                key={index}
                className={cn(NOISE_BAR_WIDTH_CLASS, "rounded-sm", getBarStyles(slot, isSelected))}
              />
            ))}
          </div>
        </button>
      </TooltipTrigger>
      <MapTooltipContent side={slot.part === "day" ? "top" : "bottom"}>
        {WEEK_SEGMENT_LABELS[slot.week]} {partLabel.toLowerCase()} · {hours}
      </MapTooltipContent>
    </Tooltip>
  );
};

export const NoiseTimeGrid = ({ value, onChange }: NoiseTimeGridProps) => {
  const selectedId = encodeNoiseTimeSlot(value);

  return (
    <div className="pointer-events-auto w-fit space-y-1 border-b border-border/50 pb-2">
      <div className="flex w-fit items-center justify-end gap-0.5">
        <p className="text-xs font-medium text-foreground">When</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About these time periods"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3" />
            </button>
          </TooltipTrigger>
          <MapTooltipContent
            side="right"
            className="max-w-56 flex-col items-start whitespace-normal"
          >
            {DEFRA_TIME_SLOT_NOTE}
          </MapTooltipContent>
        </Tooltip>
      </div>

      <div
        role="group"
        aria-label="Weekday or weekend and day or night noise period"
        className={cn(
          "grid w-fit grid-cols-[auto_auto_auto] items-center",
          NOISE_GROUP_GAP_CLASS
        )}
      >
        <div aria-hidden="true" />
        {WEEK_SEGMENTS.map((week) => (
          <p
            key={week}
            className="text-center text-[9px] font-medium leading-none tracking-[-0.06em] text-muted-foreground"
          >
            {WEEK_SEGMENT_LETTERS[week].replace(/ /g, "")}
          </p>
        ))}

        {NOISE_DAY_PARTS.map(({ part, label }) => (
          <Fragment key={part}>
            <p className="pr-0.5 text-[10px] font-medium text-muted-foreground">
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
