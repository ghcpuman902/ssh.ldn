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
  /** Tailwind background colour class for gauges/bars. */
  barClassName: string
}

export const NOISE_CONTRIBUTOR_META: Record<
  NoiseContributorSource,
  NoiseContributorMeta
> = {
  road: { emoji: "🚗", label: "Road", barClassName: "bg-orange-500" },
  rail: { emoji: "🚆", label: "Rail", barClassName: "bg-sky-500" },
  airport: { emoji: "✈️", label: "Aircraft", barClassName: "bg-indigo-500" },
  nightlife: {
    emoji: "🔊",
    label: "Local sources",
    barClassName: "bg-fuchsia-500",
  },
  traffic: { emoji: "🚦", label: "Traffic", barClassName: "bg-amber-500" },
  planning: {
    emoji: "🏗️",
    label: "Development",
    barClassName: "bg-emerald-500",
  },
}

const FALLBACK_META: NoiseContributorMeta = {
  emoji: "🔹",
  label: "Other",
  barClassName: "bg-muted-foreground",
}

export const isNoiseContributorSource = (
  source: string
): source is NoiseContributorSource => source in NOISE_CONTRIBUTOR_META

export const getNoiseContributorMeta = (source: string): NoiseContributorMeta =>
  isNoiseContributorSource(source)
    ? NOISE_CONTRIBUTOR_META[source]
    : { ...FALLBACK_META, label: source }
