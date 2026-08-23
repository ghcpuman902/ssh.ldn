import { TreePine } from "lucide-react"
import type { ReactNode } from "react"

import { PlaceholderRoundel } from "@/components/map/placeholder-roundel"
import type { VisualLayerKey } from "@/lib/map/visual-layers"

const ROUNDEL_ICON_CLASS = "h-5 w-auto max-w-none"

export const VISUAL_LAYER_ICON: Record<VisualLayerKey, ReactNode> = {
  tube: (
    <PlaceholderRoundel
      className={ROUNDEL_ICON_CLASS}
      label="London Underground placeholder mark"
    />
  ),
  overground: (
    <PlaceholderRoundel
      className={ROUNDEL_ICON_CLASS}
      discColor="#EE7C0E"
      barColor="#0019A8"
      label="London Overground placeholder mark"
    />
  ),
  elizabeth: (
    <PlaceholderRoundel
      className={ROUNDEL_ICON_CLASS}
      discColor="#6950A1"
      barColor="#0019A8"
      label="Elizabeth line placeholder mark"
    />
  ),
  dlr: (
    <PlaceholderRoundel
      className={ROUNDEL_ICON_CLASS}
      discColor="#00A4A7"
      barColor="#0019A8"
      label="Docklands Light Railway placeholder mark"
    />
  ),
  tram: (
    <PlaceholderRoundel
      className={ROUNDEL_ICON_CLASS}
      discColor="#84B817"
      barColor="#0019A8"
      label="London Trams placeholder mark"
    />
  ),
  greenSpaces: <TreePine className="size-5 shrink-0 text-green-700" />,
}
