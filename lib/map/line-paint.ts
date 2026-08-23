import type { MapTheme } from "@/lib/map/basemap-style"
import type { TubeLineFeatureCollection } from "@/lib/map/geojson-types"

/** OpenFreeMap Positron / Dark Matter background fills. */
export const MAP_BACKGROUND_HEX: Record<MapTheme, string> = {
  light: "#f2f3f0",
  dark: "#0c0c0c",
}

const RAIL_STROKE_HEX = "#475569"
const TRANSIT_CASING_HEX = "#ffffff"

const parseHex = (value: string) => {
  const hex = value.replace("#", "")
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

const toHex = (channel: number) =>
  Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, "0")

/** Mix foreground onto the basemap so the stroke can paint at opacity 1. */
export const mixHexOntoBackground = (
  foreground: string,
  background: string,
  opacity: number
) => {
  const fg = parseHex(foreground)
  const bg = parseHex(background)
  const keep = 1 - opacity
  return `#${toHex(fg.r * opacity + bg.r * keep)}${toHex(fg.g * opacity + bg.g * keep)}${toHex(fg.b * opacity + bg.b * keep)}`
}

export const railStrokeColor = (theme: MapTheme) =>
  mixHexOntoBackground(RAIL_STROKE_HEX, MAP_BACKGROUND_HEX[theme], 0.85)

export const transitCasingColor = (theme: MapTheme) =>
  mixHexOntoBackground(TRANSIT_CASING_HEX, MAP_BACKGROUND_HEX[theme], 0.92)

export const mixTransitLineColors = (
  lines: TubeLineFeatureCollection,
  theme: MapTheme
): TubeLineFeatureCollection => {
  const background = MAP_BACKGROUND_HEX[theme]
  return {
    ...lines,
    features: lines.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        color: mixHexOntoBackground(
          feature.properties.color || "#6366f1",
          background,
          0.95
        ),
      },
    })),
  }
}
