import type { DefraMapKind } from "@/lib/map/defra-layers"
import type { LocalNoiseAmenity } from "@/lib/map/venue-time"

/** All noise sources that can drive cursor-point audio preview. */
export type NoiseAudioSourceKind = DefraMapKind | LocalNoiseAmenity

export type NoiseAudioClip = {
  /** Repo path served from `/public` */
  file: string
  /** Human label for UI pill / accessibility */
  label: string
  /** Short description of what the clip represents */
  description: string
  /** Loop length in seconds (from source file) */
  durationSec: number
  /** Original download filename for traceability */
  sourceFilename: string
  /** Suggested default gain 0–1 when this source dominates the mix */
  defaultGain: number
}

/**
 * Canonical mapping: noise source kind → ambience clip.
 *
 * Six unique files in `public/audio/noise/` — pub/bar and
 * nightclub/music_venue share clips per user-named downloads.
 */
export const NOISE_AUDIO_CLIPS: Record<NoiseAudioSourceKind, NoiseAudioClip> = {
  // ── DEFRA strategic layers ──────────────────────────────────────────────
  road: {
    file: "/audio/noise/road.mp3",
    label: "Road traffic",
    description: "Steady road traffic hum — DEFRA road noise layer",
    durationSec: 7.08,
    sourceFilename: "road.mp3",
    defaultGain: 0.7,
  },
  rail: {
    file: "/audio/noise/train.mp3",
    label: "Train pass-by",
    description: "Train pass-by rumble — DEFRA rail noise layer",
    durationSec: 5.4,
    sourceFilename: "train.mp3",
    defaultGain: 0.75,
  },
  airport: {
    file: "/audio/noise/flight.mp3",
    label: "Aircraft overhead",
    description: "Jet pass-over — DEFRA airport noise layer",
    durationSec: 3.0,
    sourceFilename: "flight.mp3",
    defaultGain: 0.65,
  },

  // ── OSM local sources (nightlife layer) ─────────────────────────────────
  pub: {
    file: "/audio/noise/pub-bar.mp3",
    label: "Pub chatter",
    description: "Pub and bar garden chatter",
    durationSec: 5.56,
    sourceFilename: "pub and bar.mp3",
    defaultGain: 0.55,
  },
  bar: {
    file: "/audio/noise/pub-bar.mp3",
    label: "Bar chatter",
    description: "Pub and bar garden chatter",
    durationSec: 5.56,
    sourceFilename: "pub and bar.mp3",
    defaultGain: 0.6,
  },
  nightclub: {
    file: "/audio/noise/nightclub-music-venue.mp3",
    label: "Nightclub bass",
    description: "Club bass and crowd — late-night activity",
    durationSec: 4.68,
    sourceFilename: "night club and music venues.mp3",
    defaultGain: 0.85,
  },
  music_venue: {
    file: "/audio/noise/nightclub-music-venue.mp3",
    label: "Live music",
    description: "Live music and club crowd",
    durationSec: 4.68,
    sourceFilename: "night club and music venues.mp3",
    defaultGain: 0.8,
  },
  hospital: {
    file: "/audio/noise/ambulance.mp3",
    label: "Ambulance siren",
    description: "Distant siren — hospital emergency activity",
    durationSec: 3.2,
    sourceFilename: "ambulance.mp3",
    defaultGain: 0.45,
  },
}

/** Unique clip files (deduplicated by path). */
export const NOISE_AUDIO_UNIQUE_FILES = [
  {
    file: "/audio/noise/road.mp3",
    sourceFilename: "road.mp3",
    durationSec: 7.08,
    mapsTo: ["road"] as const,
  },
  {
    file: "/audio/noise/train.mp3",
    sourceFilename: "train.mp3",
    durationSec: 5.4,
    mapsTo: ["rail"] as const,
  },
  {
    file: "/audio/noise/flight.mp3",
    sourceFilename: "flight.mp3",
    durationSec: 3.0,
    mapsTo: ["airport"] as const,
  },
  {
    file: "/audio/noise/pub-bar.mp3",
    sourceFilename: "pub and bar.mp3",
    durationSec: 5.56,
    mapsTo: ["pub", "bar"] as const,
  },
  {
    file: "/audio/noise/nightclub-music-venue.mp3",
    sourceFilename: "night club and music venues.mp3",
    durationSec: 4.68,
    mapsTo: ["nightclub", "music_venue"] as const,
  },
  {
    file: "/audio/noise/ambulance.mp3",
    sourceFilename: "ambulance.mp3",
    durationSec: 3.2,
    mapsTo: ["hospital"] as const,
  },
] as const

export type NoiseAudioChannelId =
  | "road"
  | "rail"
  | "airport"
  | "pubBar"
  | "nightclubMusicVenue"
  | "hospital"

export type NoiseAudioChannel = {
  id: NoiseAudioChannelId
  file: string
  label: string
  description: string
  defaultGain: number
  sourceKinds: readonly NoiseAudioSourceKind[]
}

/** Loopable audio channels after merging source kinds that share one file. */
export const NOISE_AUDIO_CHANNELS: Record<
  NoiseAudioChannelId,
  NoiseAudioChannel
> = {
  road: {
    id: "road",
    file: NOISE_AUDIO_CLIPS.road.file,
    label: "Road",
    description: NOISE_AUDIO_CLIPS.road.description,
    defaultGain: NOISE_AUDIO_CLIPS.road.defaultGain,
    sourceKinds: ["road"],
  },
  rail: {
    id: "rail",
    file: NOISE_AUDIO_CLIPS.rail.file,
    label: "Train",
    description: NOISE_AUDIO_CLIPS.rail.description,
    defaultGain: NOISE_AUDIO_CLIPS.rail.defaultGain,
    sourceKinds: ["rail"],
  },
  airport: {
    id: "airport",
    file: NOISE_AUDIO_CLIPS.airport.file,
    label: "Flight",
    description: NOISE_AUDIO_CLIPS.airport.description,
    defaultGain: NOISE_AUDIO_CLIPS.airport.defaultGain,
    sourceKinds: ["airport"],
  },
  pubBar: {
    id: "pubBar",
    file: NOISE_AUDIO_CLIPS.pub.file,
    label: "Pub/bar",
    description: NOISE_AUDIO_CLIPS.pub.description,
    defaultGain:
      (NOISE_AUDIO_CLIPS.pub.defaultGain + NOISE_AUDIO_CLIPS.bar.defaultGain) /
      2,
    sourceKinds: ["pub", "bar"],
  },
  nightclubMusicVenue: {
    id: "nightclubMusicVenue",
    file: NOISE_AUDIO_CLIPS.nightclub.file,
    label: "Club/music",
    description: NOISE_AUDIO_CLIPS.music_venue.description,
    defaultGain:
      (NOISE_AUDIO_CLIPS.nightclub.defaultGain +
        NOISE_AUDIO_CLIPS.music_venue.defaultGain) /
      2,
    sourceKinds: ["nightclub", "music_venue"],
  },
  hospital: {
    id: "hospital",
    file: NOISE_AUDIO_CLIPS.hospital.file,
    label: "Ambulance",
    description: NOISE_AUDIO_CLIPS.hospital.description,
    defaultGain: NOISE_AUDIO_CLIPS.hospital.defaultGain,
    sourceKinds: ["hospital"],
  },
}

export type NoiseAudioChannelLevels = Record<NoiseAudioChannelId, number>

export const NOISE_AUDIO_CHANNEL_IDS = Object.keys(
  NOISE_AUDIO_CHANNELS
) as NoiseAudioChannelId[]

export const createEmptyNoiseAudioChannelLevels = (): NoiseAudioChannelLevels =>
  NOISE_AUDIO_CHANNEL_IDS.reduce(
    (levels, id) => ({ ...levels, [id]: 0 }),
    {} as NoiseAudioChannelLevels
  )

export const NOISE_AUDIO_SOURCE_KINDS = Object.keys(
  NOISE_AUDIO_CLIPS
) as NoiseAudioSourceKind[]

export const getNoiseAudioClip = (kind: NoiseAudioSourceKind) =>
  NOISE_AUDIO_CLIPS[kind]
