import type { LocalNoiseAmenity } from "@/lib/map/venue-time"

/** Shared visual identity for each noise-score contributor — used by the layer toggles and the Analyse panel gauges. */
export type NoiseContributorSource =
  | "road"
  | "rail"
  | "airport"
  | "nightlife"
  | "traffic"
  | "planning"

export type NoiseContributorMeta = {
  emoji: string
  label: string
  /** CSS custom property for this source colour, e.g. `--noise-road`. */
  cssVar: `--noise-${string}`
  /** Tailwind background colour class for gauges/bars (theme token). */
  barClassName: string
  /** SVG / inline fill colour referencing the CSS variable. */
  strokeColor: string
}

export const NOISE_CONTRIBUTOR_META: Record<
  NoiseContributorSource,
  NoiseContributorMeta
> = {
  road: {
    emoji: "🚗",
    label: "Road",
    cssVar: "--noise-road",
    barClassName: "bg-noise-road",
    strokeColor: "var(--noise-road)",
  },
  rail: {
    emoji: "🚆",
    label: "Rail",
    cssVar: "--noise-rail",
    barClassName: "bg-noise-rail",
    strokeColor: "var(--noise-rail)",
  },
  airport: {
    emoji: "✈️",
    label: "Aircraft",
    cssVar: "--noise-airport",
    barClassName: "bg-noise-airport",
    strokeColor: "var(--noise-airport)",
  },
  nightlife: {
    emoji: "🔊",
    label: "Local sources",
    cssVar: "--noise-nightlife",
    barClassName: "bg-noise-nightlife",
    strokeColor: "var(--noise-nightlife)",
  },
  traffic: {
    emoji: "🚦",
    label: "Traffic",
    cssVar: "--noise-traffic",
    barClassName: "bg-noise-traffic",
    strokeColor: "var(--noise-traffic)",
  },
  planning: {
    emoji: "🏗️",
    label: "Development",
    cssVar: "--noise-planning",
    barClassName: "bg-noise-planning",
    strokeColor: "var(--noise-planning)",
  },
}

export type LocalAmenityMeta = {
  label: string
  cssVar: `--noise-${string}`
  barClassName: string
  strokeColor: string
}

/** Per-amenity colours for the nightlife multi-segment gauge ring. */
export const LOCAL_AMENITY_META: Record<LocalNoiseAmenity, LocalAmenityMeta> = {
  pub: {
    label: "Pub",
    cssVar: "--noise-pub",
    barClassName: "bg-noise-pub",
    strokeColor: "var(--noise-pub)",
  },
  bar: {
    label: "Bar",
    cssVar: "--noise-bar",
    barClassName: "bg-noise-bar",
    strokeColor: "var(--noise-bar)",
  },
  nightclub: {
    label: "Nightclub",
    cssVar: "--noise-nightclub",
    barClassName: "bg-noise-nightclub",
    strokeColor: "var(--noise-nightclub)",
  },
  music_venue: {
    label: "Live music",
    cssVar: "--noise-music-venue",
    barClassName: "bg-noise-music-venue",
    strokeColor: "var(--noise-music-venue)",
  },
  hospital: {
    label: "Hospital",
    cssVar: "--noise-hospital",
    barClassName: "bg-noise-hospital",
    strokeColor: "var(--noise-hospital)",
  },
}

const FALLBACK_META: NoiseContributorMeta = {
  emoji: "🔹",
  label: "Other",
  cssVar: "--noise-other",
  barClassName: "bg-noise-other",
  strokeColor: "var(--noise-other)",
}

export const isNoiseContributorSource = (
  source: string
): source is NoiseContributorSource => source in NOISE_CONTRIBUTOR_META

export const getNoiseContributorMeta = (source: string): NoiseContributorMeta =>
  isNoiseContributorSource(source)
    ? NOISE_CONTRIBUTOR_META[source]
    : { ...FALLBACK_META, label: source }

export const getNoiseContributorColor = (source: string) =>
  getNoiseContributorMeta(source).strokeColor
