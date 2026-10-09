"use client"

import { type ComponentProps, type ReactNode } from "react"
import { Info, Moon, Sun } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DEFRA_TIME_SLOT_NOTE,
  formatNoiseTimeSlotTitle,
  NOISE_DAY_PARTS,
  type NoiseDayPart,
  type NoiseTimeSlot,
  type NoiseWeekSegment,
  WEEK_SEGMENT_DAYS,
  WEEK_SEGMENT_LABELS,
  WEEK_SEGMENTS,
} from "@/lib/map/noise-time"
import { cn } from "@/lib/utils"

type NoiseTimePickerProps = {
  value: NoiseTimeSlot
  onChange: (slot: NoiseTimeSlot) => void
}

export const MAP_TOOLTIP_CONTENT_CLASS =
  "border border-border bg-popover text-popover-foreground shadow-md"

export const MAP_TOOLTIP_ARROW_CLASS = "bg-popover fill-popover"

export const MapTooltipContent = ({
  className,
  ...props
}: ComponentProps<typeof TooltipContent>) => (
  <TooltipContent
    arrowClassName={MAP_TOOLTIP_ARROW_CLASS}
    className={cn(MAP_TOOLTIP_CONTENT_CLASS, className)}
    {...props}
  />
)

export const OptionalMapTooltip = ({
  enabled,
  content,
  children,
  ...tooltipContentProps
}: {
  enabled: boolean
  content: ReactNode
  children: ReactNode
} & Omit<ComponentProps<typeof MapTooltipContent>, "content" | "children">) => {
  if (!enabled) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <MapTooltipContent {...tooltipContentProps}>{content}</MapTooltipContent>
    </Tooltip>
  )
}

const PART_ICON: Record<NoiseDayPart, typeof Sun> = { day: Sun, night: Moon }

/** Selected chips preview the screen: Day lit like the light map, Night dark. */
const PART_SELECTED_CLASS: Record<NoiseDayPart, string> = {
  day: "bg-amber-50 text-amber-950 ring-amber-300/70",
  night: "bg-indigo-950 text-indigo-50 ring-indigo-400/50",
}

const WEEK_SELECTED_CLASS: Record<NoiseWeekSegment, string> = {
  weekday: "bg-background text-foreground ring-border",
  weekend: "map-time-weekend-chip text-foreground ring-amber-400/40",
}

const SegmentButton = ({
  selected,
  selectedClassName,
  label,
  tooltip,
  showTooltip,
  onClick,
  children,
}: {
  selected: boolean
  selectedClassName: string
  label: string
  tooltip: string
  showTooltip: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <OptionalMapTooltip
    enabled={showTooltip}
    side="top"
    className="whitespace-nowrap"
    content={tooltip}
  >
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-5.5 flex-1 cursor-pointer touch-manipulation items-center justify-center gap-0.5 rounded-full px-1.5 text-[10px] leading-none font-medium whitespace-nowrap select-none",
        "transition-[background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        selected
          ? cn("shadow-sm ring-1", selectedClassName)
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  </OptionalMapTooltip>
)

const SEGMENT_TRACK_CLASS =
  "flex w-full items-center gap-0.5 rounded-full bg-muted/70 p-0.5"

/**
 * Compact time picker: the slice in words on top, then two segmented rows
 * (Day/Night, weekday/weekend days). Hours live in the tooltips, aria labels
 * and the live region. The card sizes to its content, so nothing truncates.
 */
export const NoiseTimePicker = ({ value, onChange }: NoiseTimePickerProps) => {
  const isMobile = useIsMobile()
  const title = formatNoiseTimeSlotTitle(value)
  const hours =
    NOISE_DAY_PARTS.find((item) => item.part === value.part)?.hours ?? ""
  const weekDays = WEEK_SEGMENT_DAYS[value.part]

  return (
    <div className="map-float-chrome pointer-events-auto flex w-fit flex-col gap-1 rounded-[1.125rem] p-1.5 pt-1">
      <div className="flex items-center justify-center gap-1 px-1">
        <p className="text-[11px] leading-4 font-semibold whitespace-nowrap text-foreground">
          {title}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About these time periods"
              className="hidden text-muted-foreground/70 transition-colors hover:text-muted-foreground md:inline-flex"
            >
              <Info className="size-3" />
            </button>
          </TooltipTrigger>
          <MapTooltipContent
            side="bottom"
            align="end"
            className="max-w-56 flex-col items-start whitespace-normal"
          >
            {`${title}, ${hours}. ${DEFRA_TIME_SLOT_NOTE}`}
          </MapTooltipContent>
        </Tooltip>
      </div>

      <div role="group" aria-label="Day or night" className={SEGMENT_TRACK_CLASS}>
        {NOISE_DAY_PARTS.map(({ part, label, hours: partHours }) => {
          const Icon = PART_ICON[part]
          return (
            <SegmentButton
              key={part}
              selected={value.part === part}
              selectedClassName={PART_SELECTED_CLASS[part]}
              label={`${label}, ${partHours}`}
              tooltip={
                part === "day"
                  ? `${partHours} · light map`
                  : `${partHours} · noise glows on a dark map`
              }
              showTooltip={!isMobile}
              onClick={() => onChange({ ...value, part })}
            >
              <Icon aria-hidden="true" className="size-3" />
              {label}
            </SegmentButton>
          )
        })}
      </div>

      <div
        role="group"
        aria-label="Weekday or weekend"
        className={SEGMENT_TRACK_CLASS}
      >
        {WEEK_SEGMENTS.map((week) => (
          <SegmentButton
            key={week}
            selected={value.week === week}
            selectedClassName={WEEK_SELECTED_CLASS[week]}
            label={`${WEEK_SEGMENT_LABELS[week]}, ${weekDays[week]}${value.part === "night" ? " nights" : ""}`}
            tooltip={
              week === "weekday"
                ? `${WEEK_SEGMENT_LABELS[week]} · ${weekDays[week]}${value.part === "night" ? " nights" : ""}`
                : `${WEEK_SEGMENT_LABELS[week]} · ${weekDays[week]}${value.part === "night" ? " nights" : ""} · warm frame`
            }
            showTooltip={!isMobile}
            onClick={() => onChange({ ...value, week })}
          >
            {weekDays[week]}
          </SegmentButton>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {`Showing ${title.toLowerCase()} noise, ${hours}.`}
      </p>
    </div>
  )
}
