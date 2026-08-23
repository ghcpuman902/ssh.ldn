export type VisualLayerKey =
  "tube" | "overground" | "elizabeth" | "dlr" | "tram" | "greenSpaces"

export type VisualLayerVisibility = Record<VisualLayerKey, boolean>

/** Coloured TfL overlays — the transit toggle turns all of these on or off. Rail is a permanent base layer. */
export const TRANSIT_VISUAL_LAYER_KEYS = [
  "tube",
  "overground",
  "elizabeth",
  "dlr",
  "tram",
] as const satisfies readonly VisualLayerKey[]

export type TransitVisualLayerKey = (typeof TRANSIT_VISUAL_LAYER_KEYS)[number]

export const DEFAULT_VISUAL_LAYER_VISIBILITY: VisualLayerVisibility = {
  tube: true,
  overground: true,
  elizabeth: true,
  dlr: true,
  tram: true,
  greenSpaces: false,
}

export type VisualLayerMeta = {
  label: string
  description: string
  datasetUrl: string
}

export const VISUAL_LAYER_META: Record<VisualLayerKey, VisualLayerMeta> = {
  tube: {
    label: "Tube lines & stations",
    description:
      "London Underground track geometry from OpenStreetMap route relations, with TfL station names and line colours.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  overground: {
    label: "Overground lines & stations",
    description:
      "Named Overground routes (Liberty, Lioness, Mildmay, etc.) with white-cased line colours — not the old solid orange style.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  elizabeth: {
    label: "Elizabeth line & stations",
    description:
      "Elizabeth line track geometry from OpenStreetMap, with TfL station names.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  dlr: {
    label: "DLR lines & stations",
    description:
      "Docklands Light Railway track geometry from OpenStreetMap, with TfL station names.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  tram: {
    label: "Tram lines & stations",
    description:
      "London Trams (Tramlink) track geometry from OpenStreetMap, with TfL station names.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
  greenSpaces: {
    label: "Parks & green space",
    description:
      "Parks, commons, woods, and recreation grounds from OpenStreetMap.",
    datasetUrl: "https://www.openstreetmap.org/copyright",
  },
}

export const VISUAL_LAYER_ORDER: VisualLayerKey[] = [
  "tube",
  "overground",
  "elizabeth",
  "dlr",
  "tram",
  "greenSpaces",
]

/** Official TfL line colours for transit route rendering. */
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
  liberty: "#606667",
  lioness: "#EF9600",
  mildmay: "#2774AE",
  windrush: "#D22730",
  weaver: "#893B67",
  suffragette: "#5BA763",
  dlr: "#00A4A7",
  tram: "#84B817",
}

export const defaultLineColor = (lineId: string) =>
  TFL_LINE_COLORS[lineId] ?? "#6366f1"
