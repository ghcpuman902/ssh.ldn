import { cn } from "@/lib/utils"

type SelectedLocationPinProps = {
  size?: "md" | "xs"
  className?: string
}

export const SelectedLocationPin = ({
  size = "md",
  className,
}: SelectedLocationPinProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "selected-location-pin relative inline-flex shrink-0 overflow-visible rounded-full border-white bg-primary",
      size === "md" && "size-8 border-2 text-[2rem]",
      size === "xs" && "size-4 border text-base",
      className
    )}
  >
    <span className="selected-location-pin-clip">
      <span className="selected-location-pin-lift">📍</span>
    </span>
  </span>
)
