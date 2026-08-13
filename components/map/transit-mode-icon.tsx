import { TreePine } from "lucide-react"
import type { ReactNode } from "react"

import type { VisualLayerKey } from "@/lib/map/visual-layers"
import { cn } from "@/lib/utils"

type TransitIconProps = {
  className?: string
}

export const TRANSIT_LOGO_SOURCES = {
  underground:
    "https://commons.wikimedia.org/wiki/File:Underground.svg",
  elizabeth:
    "https://commons.wikimedia.org/wiki/File:Elizabeth_line_roundel.svg",
  overground:
    "https://commons.wikimedia.org/wiki/File:Overground_roundel.svg",
  dlr: "https://commons.wikimedia.org/wiki/File:DLR_roundel.svg",
  tram: "https://commons.wikimedia.org/wiki/File:Tramlink_roundel.svg",
  nationalRail:
    "https://upload.wikimedia.org/wikipedia/sco/3/31/National_Rail_logo.svg",
} as const

const TRANSIT_LOGO_PATH = {
  tube: "/transit-logos/underground.svg",
  elizabeth: "/transit-logos/elizabeth-line-roundel.svg",
  overground: "/transit-logos/overground-roundel.svg",
  dlr: "/transit-logos/dlr-roundel.svg",
  tram: "/transit-logos/tram-roundel.svg",
} as const

const TransitLogoIcon = ({
  src,
  alt,
  className,
}: TransitIconProps & { src: string; alt: string }) => (
  <img
    src={src}
    alt=""
    aria-hidden="true"
    className={cn("shrink-0 object-contain", className)}
  />
)

const ROUNDEL_ICON_CLASS = "h-[20px] w-auto max-w-none"

export const VISUAL_LAYER_ICON: Record<VisualLayerKey, ReactNode> = {
  tube: (
    <TransitLogoIcon
      src={TRANSIT_LOGO_PATH.tube}
      alt="London Underground"
      className={ROUNDEL_ICON_CLASS}
    />
  ),
  overground: (
    <TransitLogoIcon
      src={TRANSIT_LOGO_PATH.overground}
      alt="London Overground"
      className={ROUNDEL_ICON_CLASS}
    />
  ),
  elizabeth: (
    <TransitLogoIcon
      src={TRANSIT_LOGO_PATH.elizabeth}
      alt="Elizabeth line"
      className={ROUNDEL_ICON_CLASS}
    />
  ),
  dlr: (
    <TransitLogoIcon
      src={TRANSIT_LOGO_PATH.dlr}
      alt="Docklands Light Railway"
      className={ROUNDEL_ICON_CLASS}
    />
  ),
  tram: (
    <TransitLogoIcon
      src={TRANSIT_LOGO_PATH.tram}
      alt="London Trams"
      className={ROUNDEL_ICON_CLASS}
    />
  ),
  greenSpaces: <TreePine className="size-5 shrink-0 text-green-700" />,
}
