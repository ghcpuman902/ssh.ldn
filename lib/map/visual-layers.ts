export type VisualLayerKey = "rail" | "tube" | "greenSpaces"

export type VisualLayerVisibility = Record<VisualLayerKey, boolean>

export const DEFAULT_VISUAL_LAYER_VISIBILITY: VisualLayerVisibility = {
  rail: false,
  tube: false,
  greenSpaces: false,
}

export type VisualLayerMeta = {
  emoji: string
  label: string
  description: string
  datasetUrl: string
}

export const VISUAL_LAYER_META: Record<VisualLayerKey, VisualLayerMeta> = {
  rail: {
    emoji: "🚆",
    label: "Railways & stations",
    description:
      "Overground rail lines and station stops from OpenStreetMap — excludes underground segments.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  tube: {
    emoji: "🚇",
    label: "Tube lines & stations",
    description:
      "London Underground track geometry from OpenStreetMap route relations, with TfL station names and line colours.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  greenSpaces: {
    emoji: "🌿",
    label: "Parks & green space",
    description:
      "Parks, commons, woods, and recreation grounds from OpenStreetMap.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
}

export const VISUAL_LAYER_ORDER: VisualLayerKey[] = [
  "rail",
  "tube",
  "greenSpaces",
]

/** Official TfL line colours for tube route rendering. */
export const TFL_LINE_COLORS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#DC241F",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
  elizabeth: "#6950A1",
  overground: "#EE7A00",
  dlr: "#00A4A7",
  tram: "#84B817",
}

export const defaultLineColor = (lineId: string) =>
  TFL_LINE_COLORS[lineId] ?? "#6366f1"
