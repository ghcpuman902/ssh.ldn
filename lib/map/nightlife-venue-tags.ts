import type { LocalNoiseAmenity } from "@/lib/map/venue-time"
import { isLocalNoiseAmenity } from "@/lib/map/venue-time"

/** Core amenity values used in scoring, rendering, and density weights. */
export const NIGHTLIFE_AMENITY_FILTER =
  "^(pub|bar|nightclub|music_venue|hospital)$"

export const NIGHTLIFE_CACHE_VERSION = "v4-concert-venues"

type OsmTags = Record<string, string> | undefined

const LIVE_MUSIC_AMENITIES = new Set([
  "pub",
  "bar",
  "nightclub",
  "theatre",
  "events_venue",
])

const CONCERT_THEATRE_TYPES = new Set(["concert_hall", "music_venue"])

export const isConcertVenue = (tags: OsmTags): boolean => {
  if (!tags) return false

  if (tags.amenity === "music_venue") return true
  if (tags.leisure === "music_venue") return true

  if (
    tags.live_music === "yes" &&
    tags.amenity &&
    LIVE_MUSIC_AMENITIES.has(tags.amenity)
  ) {
    return true
  }

  if (
    tags.amenity === "theatre" &&
    tags["theatre:type"] &&
    CONCERT_THEATRE_TYPES.has(tags["theatre:type"])
  ) {
    return true
  }

  if (
    tags.amenity === "events_venue" &&
    (tags.music || tags["music:venue"] || tags.music_venue)
  ) {
    return true
  }

  return false
}

/** Map OSM tags to a local noise amenity used by map layers and scoring. */
export const normalizeNightlifeAmenity = (
  tags: OsmTags
): LocalNoiseAmenity | string | null => {
  const rawAmenity = tags?.amenity ?? null

  if (isConcertVenue(tags)) {
    if (rawAmenity === "pub" || rawAmenity === "bar" || rawAmenity === "nightclub") {
      return rawAmenity
    }

    return "music_venue"
  }

  if (isLocalNoiseAmenity(rawAmenity)) {
    return rawAmenity
  }

  return rawAmenity
}

const bboxClause = (
  south: number,
  west: number,
  north: number,
  east: number,
  filter: string
) => `  nwr(${south},${west},${north},${east})${filter};`

const radiusClause = (
  radiusMeters: number,
  lat: number,
  lng: number,
  filter: string
) => `  nwr(around:${radiusMeters},${lat},${lng})${filter};`

/** Overpass sub-clauses for nightlife / concert venues inside a bbox. */
export const buildNightlifeBboxClauses = ({
  south,
  west,
  north,
  east,
}: {
  south: number
  west: number
  north: number
  east: number
}) =>
  [
    bboxClause(south, west, north, east, `["amenity"~"${NIGHTLIFE_AMENITY_FILTER}"]`),
    bboxClause(
      south,
      west,
      north,
      east,
      `["amenity"~"^(pub|bar)$"]["live_music"="yes"]`
    ),
    bboxClause(south, west, north, east, `["leisure"="music_venue"]`),
    bboxClause(
      south,
      west,
      north,
      east,
      `["amenity"="theatre"]["theatre:type"~"^(concert_hall|music_venue)$"]`
    ),
    bboxClause(
      south,
      west,
      north,
      east,
      `["amenity"="events_venue"]["music"]`
    ),
    bboxClause(
      south,
      west,
      north,
      east,
      `["amenity"="events_venue"]["music:venue"]`
    ),
    bboxClause(
      south,
      west,
      north,
      east,
      `["amenity"="events_venue"]["music_venue"]`
    ),
    bboxClause(
      south,
      west,
      north,
      east,
      `["live_music"="yes"]["amenity"~"^(nightclub|theatre|events_venue)$"]`
    ),
  ].join("\n")

/** Overpass sub-clauses for nightlife / concert venues around a point. */
export const buildNightlifeRadiusClauses = (
  lat: number,
  lng: number,
  radiusMeters: number
) =>
  [
    radiusClause(
      radiusMeters,
      lat,
      lng,
      `["amenity"~"${NIGHTLIFE_AMENITY_FILTER}"]`
    ),
    radiusClause(
      radiusMeters,
      lat,
      lng,
      `["amenity"~"^(pub|bar)$"]["live_music"="yes"]`
    ),
    radiusClause(radiusMeters, lat, lng, `["leisure"="music_venue"]`),
    radiusClause(
      radiusMeters,
      lat,
      lng,
      `["amenity"="theatre"]["theatre:type"~"^(concert_hall|music_venue)$"]`
    ),
    radiusClause(radiusMeters, lat, lng, `["amenity"="events_venue"]["music"]`),
    radiusClause(
      radiusMeters,
      lat,
      lng,
      `["amenity"="events_venue"]["music:venue"]`
    ),
    radiusClause(
      radiusMeters,
      lat,
      lng,
      `["amenity"="events_venue"]["music_venue"]`
    ),
    radiusClause(
      radiusMeters,
      lat,
      lng,
      `["live_music"="yes"]["amenity"~"^(nightclub|theatre|events_venue)$"]`
    ),
  ].join("\n")

export const buildNightlifeBboxQuery = (bbox: {
  south: number
  west: number
  north: number
  east: number
}) => `[out:json][timeout:60];
(
${buildNightlifeBboxClauses(bbox)}
);
out center tags;`

export const buildNightlifeRadiusQuery = (
  lat: number,
  lng: number,
  radiusMeters: number
) => `[out:json][timeout:60];
(
${buildNightlifeRadiusClauses(lat, lng, radiusMeters)}
);
out center tags;`

export const nightlifeFilterDescription =
  "pub|bar|nightclub|music_venue|hospital|concert_venues|live_music=yes"
