import { cn } from "@/lib/utils"

/** Wikimedia-derived roundel proportions (bar extends past the disc). */
const VIEW_W = 615.3
const VIEW_H = 500
const CX = 308.123
const CY = 249.985
const OUTER_R = 250
const BAR_Y = 199.5
const BAR_H = 101.1

const TFL_BLUE = "#0019A8"
const UNDERGROUND_RING_RED = "#E1251F"

type PlaceholderRoundelProps = {
  className?: string
  discColor?: string
  barColor?: string
  label?: string
}

/**
 * Filled-disc + rounded-bar placeholder. Not the trademarked hollow-ring roundel.
 * Ported from TfL-Components `PlaceholderRoundelSvg` (official artwork mode omitted).
 */
export const PlaceholderRoundel = ({
  className,
  discColor = UNDERGROUND_RING_RED,
  barColor = TFL_BLUE,
  label = "London Underground (placeholder mark)",
}: PlaceholderRoundelProps) => {
  const barRx = BAR_H / 2

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      className={cn("shrink-0", className)}
    >
      <circle cx={CX} cy={CY} r={OUTER_R} fill={discColor} />
      <rect
        x={0}
        y={BAR_Y}
        width={VIEW_W}
        height={BAR_H}
        rx={barRx}
        ry={barRx}
        fill={barColor}
      />
    </svg>
  )
}
