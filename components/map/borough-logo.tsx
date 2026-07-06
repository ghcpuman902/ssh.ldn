import { getBoroughMeta } from "@/lib/map/borough-meta"
import { cn } from "@/lib/utils"

type BoroughLogoProps = {
  planningAuthority: string | null | undefined
  size?: "xs" | "sm" | "md"
  className?: string
  showLabel?: boolean
}

/** Wide council wordmarks — fixed height, auto width. */
const BAR_HEIGHT: Record<NonNullable<BoroughLogoProps["size"]>, string> = {
  xs: "h-3.5",
  sm: "h-4",
  md: "h-5",
}

const BAR_MAX_WIDTH: Record<NonNullable<BoroughLogoProps["size"]>, string> = {
  xs: "max-w-[88px]",
  sm: "max-w-[112px]",
  md: "max-w-[140px]",
}

const TEXT_CLASS: Record<NonNullable<BoroughLogoProps["size"]>, string> = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-xs",
}

export const BoroughLogo = ({
  planningAuthority,
  size = "sm",
  className,
  showLabel = false,
}: BoroughLogoProps) => {
  const borough = getBoroughMeta(planningAuthority)
  const logoSrc = borough.logoSrc

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
      title={borough.name}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- council logos from /public
        <img
          src={logoSrc}
          alt=""
          className={cn(
            "block w-auto shrink-0 object-contain object-right",
            BAR_HEIGHT[size],
            BAR_MAX_WIDTH[size]
          )}
          aria-hidden="true"
        />
      ) : (
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-semibold",
            borough.accentClassName,
            TEXT_CLASS[size]
          )}
          aria-hidden="true"
        >
          {borough.initials}
        </span>
      )}
      {showLabel ? (
        <span className="truncate text-xs font-medium text-foreground">
          {borough.name}
        </span>
      ) : null}
    </span>
  )
}
