/** Shared venue tag logic for Node scripts (mirrors nightlife-venue-tags.ts). */

export const NIGHTLIFE_AMENITY_FILTER =
  "^(pub|bar|nightclub|music_venue|hospital)$"

export const NIGHTLIFE_CACHE_VERSION = "v4-concert-venues"

const LIVE_MUSIC_AMENITIES = new Set([
  "pub",
  "bar",
  "nightclub",
  "theatre",
  "events_venue",
])

const CONCERT_THEATRE_TYPES = new Set(["concert_hall", "music_venue"])

const LOCAL_NOISE_AMENITIES = new Set([
  "pub",
  "bar",
  "nightclub",
  "music_venue",
  "hospital",
])

export const isConcertVenue = (tags) => {
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

export const normalizeNightlifeAmenity = (tags) => {
  const rawAmenity = tags?.amenity ?? null

  if (isConcertVenue(tags)) {
    if (rawAmenity === "pub" || rawAmenity === "bar" || rawAmenity === "nightclub") {
      return rawAmenity
    }

    return "music_venue"
  }

  if (rawAmenity && LOCAL_NOISE_AMENITIES.has(rawAmenity)) {
    return rawAmenity
  }

  return rawAmenity
}

const bboxClause = (south, west, north, east, filter) =>
  `  nwr(${south},${west},${north},${east})${filter};`

export const buildNightlifeBboxClauses = ({ south, west, north, east }) =>
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
    bboxClause(south, west, north, east, `["amenity"="events_venue"]["music"]`),
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

export const buildNightlifeBboxQuery = ({ south, west, north, east }) =>
  `[out:json][timeout:180];
(
${buildNightlifeBboxClauses({ south, west, north, east })}
);
out center tags;`
