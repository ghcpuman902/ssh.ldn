import type { LocalNoiseAmenity } from "@/lib/map/venue-time"

export type IntensityBand = "Low" | "Mid" | "High" | "Extreme"

export type LocalAmenityHint = {
  amenity: LocalNoiseAmenity
  count: number
  nearestMeters: number
}

export type NearbyVenueHint = {
  primaryType: string | null
  categoryLabel: string
  distanceMeters: number
}

export const intensityBandFromScore = (score: number): IntensityBand => {
  if (score >= 75) return "Extreme"
  if (score >= 50) return "High"
  if (score >= 25) return "Mid"
  return "Low"
}

const ROAD_COPY: Record<IntensityBand, string> = {
  Low: "Little traffic on the map here.",
  Mid: "A busy road is nearby.",
  High: "A main road sits close.",
  Extreme: "You're on a major traffic corridor.",
}

const RAIL_COPY: Record<IntensityBand, string> = {
  Low: "No rail noise on the map.",
  Mid: "A line or station is within earshot.",
  High: "Trains pass close by.",
  Extreme: "You're right on a rail corridor.",
}

const AIRCRAFT_COPY: Record<IntensityBand, string> = {
  Low: "Outside the mapped flight-noise contours.",
  Mid: "Under a flight path at times.",
  High: "Aircraft noise is a regular feature.",
  Extreme: "You're under a busy flight path.",
}

const PLANNING_COPY: Record<IntensityBand, string> = {
  Low: "No noisy works flagged nearby.",
  Mid: "Some development nearby.",
  High: "Building work could add noise.",
  Extreme: "Major works are close.",
}

const TRAFFIC_COPY: Record<IntensityBand, string> = {
  Low: "Traffic looks light on the map.",
  Mid: "Traffic builds at peak hours.",
  High: "Heavy traffic is close.",
  Extreme: "You're on a congested route.",
}

const closePhrase = (meters: number) => {
  if (meters < 80) return "very close"
  if (meters < 160) return "close"
  return "nearby"
}

const classifyVenueAmenity = ({
  primaryType,
  categoryLabel,
}: NearbyVenueHint): LocalNoiseAmenity | null => {
  const haystack = `${categoryLabel} ${primaryType ?? ""}`
    .toLowerCase()
    .replaceAll("_", " ")

  if (haystack.includes("hospital") || haystack.includes("urgent care")) {
    return "hospital"
  }
  if (haystack.includes("night club") || haystack.includes("nightclub")) {
    return "nightclub"
  }
  if (
    haystack.includes("music") ||
    haystack.includes("concert") ||
    haystack.includes("theater") ||
    haystack.includes("venue")
  ) {
    return "music_venue"
  }
  if (haystack.includes("pub")) return "pub"
  if (haystack.includes("bar") || haystack.includes("casino")) return "bar"
  return null
}

const nearestOf = (
  hints: LocalAmenityHint[],
  amenities: LocalNoiseAmenity[]
) =>
  hints
    .filter((hint) => amenities.includes(hint.amenity))
    .sort((left, right) => left.nearestMeters - right.nearestMeters)[0]

const countOf = (hints: LocalAmenityHint[], amenities: LocalNoiseAmenity[]) =>
  hints
    .filter((hint) => amenities.includes(hint.amenity))
    .reduce((total, hint) => total + hint.count, 0)

const hintsFromVenues = (venues: NearbyVenueHint[]): LocalAmenityHint[] => {
  const byAmenity = new Map<LocalNoiseAmenity, LocalAmenityHint>()

  for (const venue of venues) {
    const amenity = classifyVenueAmenity(venue)
    if (!amenity) continue

    const current = byAmenity.get(amenity)
    if (!current) {
      byAmenity.set(amenity, {
        amenity,
        count: 1,
        nearestMeters: venue.distanceMeters,
      })
      continue
    }

    current.count += 1
    current.nearestMeters = Math.min(current.nearestMeters, venue.distanceMeters)
  }

  return [...byAmenity.values()]
}

const describeLocalNoise = (
  score: number,
  osmAmenities: LocalAmenityHint[],
  venues: NearbyVenueHint[]
) => {
  const band = intensityBandFromScore(score)
  const venueHints = hintsFromVenues(venues)
  const hints = osmAmenities.length > 0 ? osmAmenities : venueHints
  const hospital = nearestOf(hints, ["hospital"])
  const club = nearestOf(hints, ["nightclub", "music_venue"])
  const drinking = nearestOf(hints, ["pub", "bar"])
  const drinkingCount = countOf(hints, ["pub", "bar"])

  if (hospital && hospital.nearestMeters < 120) {
    return {
      band,
      sentence: `You're ${closePhrase(hospital.nearestMeters)} to a hospital.`,
    }
  }

  if (club && club.nearestMeters < 180) {
    return {
      band,
      sentence:
        club.amenity === "music_venue"
          ? `Live music is ${closePhrase(club.nearestMeters)}.`
          : `A nightclub is ${closePhrase(club.nearestMeters)}.`,
    }
  }

  if (drinking) {
    if (drinkingCount >= 3) {
      return { band, sentence: "Lots of drinking near you." }
    }
    if (drinkingCount === 2) {
      return { band, sentence: "A few pubs sit nearby." }
    }
    return {
      band,
      sentence:
        drinking.amenity === "bar"
          ? `A bar is ${closePhrase(drinking.nearestMeters)}.`
          : `A pub is ${closePhrase(drinking.nearestMeters)}.`,
    }
  }

  if (hospital) {
    return {
      band,
      sentence: `A hospital is ${closePhrase(hospital.nearestMeters)}.`,
    }
  }

  if (club) {
    return {
      band,
      sentence:
        club.amenity === "music_venue"
          ? "Live music nearby."
          : "A nightclub is nearby.",
    }
  }

  if (band === "Low") {
    return { band, sentence: "No pubs, clubs, or hospitals mapped nearby." }
  }

  return { band, sentence: "Local venues show up nearby." }
}

export const summarizeLocalAmenities = (
  features: Array<{ amenity: LocalNoiseAmenity; distanceMeters: number }>
): LocalAmenityHint[] => {
  const byAmenity = new Map<LocalNoiseAmenity, LocalAmenityHint>()

  for (const feature of features) {
    const current = byAmenity.get(feature.amenity)
    if (!current) {
      byAmenity.set(feature.amenity, {
        amenity: feature.amenity,
        count: 1,
        nearestMeters: Math.round(feature.distanceMeters),
      })
      continue
    }

    current.count += 1
    current.nearestMeters = Math.min(
      current.nearestMeters,
      Math.round(feature.distanceMeters)
    )
  }

  return [...byAmenity.values()].sort(
    (left, right) => left.nearestMeters - right.nearestMeters
  )
}

export const describeContributor = ({
  source,
  score,
  localAmenities = [],
  nearbyVenues = [],
}: {
  source: string
  score: number
  localAmenities?: LocalAmenityHint[]
  nearbyVenues?: NearbyVenueHint[]
}): { band: IntensityBand; sentence: string } => {
  const band = intensityBandFromScore(score)

  if (source === "nightlife") {
    return describeLocalNoise(score, localAmenities, nearbyVenues)
  }
  if (source === "road") return { band, sentence: ROAD_COPY[band] }
  if (source === "rail") return { band, sentence: RAIL_COPY[band] }
  if (source === "airport") return { band, sentence: AIRCRAFT_COPY[band] }
  if (source === "planning") return { band, sentence: PLANNING_COPY[band] }
  if (source === "traffic") return { band, sentence: TRAFFIC_COPY[band] }

  return {
    band,
    sentence: band === "Low" ? "Not a driver here." : "Shows up on the map.",
  }
}
