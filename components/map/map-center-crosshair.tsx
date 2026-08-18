import { cn } from "@/lib/utils"

type MapCenterCrosshairProps = {
  className?: string
}

export const MapCenterCrosshair = ({ className }: MapCenterCrosshairProps) => (
  <div
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center",
      className
    )}
  >
    <span className="absolute h-px w-9 rounded-full bg-foreground/80 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
    <span className="absolute h-9 w-px rounded-full bg-foreground/80 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
    <span className="size-2 rounded-full border border-white bg-primary shadow-sm" />
  </div>
)
