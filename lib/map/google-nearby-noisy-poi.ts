import {
  hasGooglePlacesClientKey,
  loadPlacesLibrary,
} from "@/lib/map/google-places";
import { NIGHTLIFE_AMENITY_EMOJI } from "@/lib/map/nightlife-emoji-images";
import { haversineMeters } from "@/lib/server/geo";

/**
 * Radius within which a bar/club/venue can plausibly be heard from a home —
 * matches `LOCAL_RADIUS_METERS` used for OSM-based nightlife scoring so the
 * Google venue list and the DEFRA/OSM noise score agree on "nearby".
 */
export const NOISY_POI_SEARCH_RADIUS_METERS = 300;
const MAX_RESULTS = 8;
const PHOTO_MAX_WIDTH_PX = 480;
const PHOTO_MAX_HEIGHT_PX = 320;
const NOISE_REVIEW_PATTERN =
  /noisy|loud|music|sound|bass|volume|hear|quiet|vibrat|drunk|crowd|party|club/i;
const REVIEW_SNIPPET_CONTEXT_CHARS = 45;

/** Google primary types most likely to contribute local noise near a home. */
const NOISY_PRIMARY_TYPES = [
  "bar",
  "night_club",
  "pub",
  "event_venue",
  "performing_arts_theater",
  "stadium",
  "casino",
] as const;

const NEARBY_FIELDS = [
  "displayName",
  "location",
  "primaryType",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "businessStatus",
  "googleMapsURI",
  "hasLiveMusic",
  "reviews",
  "photos",
] as const;

/** How likely you are to actually hear this venue from home, at this distance. */
export type NoisyPoiProximityTier = "immediate" | "nearby" | "audible";

/** Open/closed at each evenly-spaced sample across a day/night window — preserves gaps (e.g. open noon–3pm, shut, open again 6–9pm) instead of collapsing to one fraction. */
export type DaySampleSeries = boolean[];

/**
 * Per calendar day, open/closed samples across two 12-hour blocks —
 * `weekdayMidday`/`weekdayMidnight` run Mon→Fri, `weekendMidday`/
 * `weekendMidnight` run Sat→Sun, aligned with the `M T W T F` / `S S`
 * headers. Each block is noon→midnight or midnight→noon.
 */
export type OpeningCoverage = {
  weekdayMidday: DaySampleSeries[];
  weekdayMidnight: DaySampleSeries[];
  weekendMidday: DaySampleSeries[];
  weekendMidnight: DaySampleSeries[];
  /** Google hours text keyed by day index (0 = Sun … 6 = Sat). */
  hoursByDay: Partial<Record<number, string>>;
};

export type NearbyNoisyPoiSummary = {
  placeId: string;
  name: string;
  categoryLabel: string;
  primaryType: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  proximityTier: NoisyPoiProximityTier;
  rating: number | null;
  reviewCount: number | null;
  openingCoverage: OpeningCoverage | null;
  hasLiveMusic: boolean | null;
  businessStatus: string | null;
  reviewSnippet: string | null;
  reviewRelativeTime: string | null;
  googleMapsUrl: string | null;
  photoUrl: string | null;
};

const formatPlaceName = (displayName: string | null | undefined) =>
  displayName?.trim() ?? "";

const formatCategoryLabel = (place: google.maps.places.Place) => {
  const primaryLabel = place.primaryTypeDisplayName?.trim();
  if (primaryLabel) {
    return primaryLabel;
  }

  const primaryType = place.primaryType?.replaceAll("_", " ");
  if (primaryType) {
    return primaryType.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return "Venue";
};

export const proximityTierFromDistance = (
  distanceMeters: number
): NoisyPoiProximityTier => {
  if (distanceMeters <= 100) {
    return "immediate";
  }
  if (distanceMeters <= 200) {
    return "nearby";
  }
  return "audible";
};

export const PROXIMITY_TIER_LABEL: Record<NoisyPoiProximityTier, string> = {
  immediate: "Right next door",
  nearby: "Likely audible",
  audible: "Occasionally audible",
};

const NOISY_POI_CATEGORY_COLOR: Record<string, string> = {
  bar: "var(--noise-bar)",
  night_club: "var(--noise-nightclub)",
  pub: "var(--noise-pub)",
  event_venue: "var(--noise-music-venue)",
  performing_arts_theater: "var(--noise-music-venue)",
  stadium: "var(--noise-nightclub)",
  casino: "var(--noise-bar)",
};
const FALLBACK_POI_COLOR = "var(--primary)";

/**
 * Most-specific-first keyword → the same emoji set used for OSM nightlife
 * points on the map, so a Google category like "Gastropub" or "Wine bar"
 * still renders as the familiar 🍺 / 🍸 icon instead of a new symbol.
 */
const CATEGORY_EMOJI_KEYWORDS: Array<
  [pattern: string, key: keyof typeof NIGHTLIFE_AMENITY_EMOJI]
> = [
  ["night club", "nightclub"],
  ["nightclub", "nightclub"],
  ["karaoke", "music_venue"],
  ["live music", "music_venue"],
  ["concert", "music_venue"],
  ["music venue", "music_venue"],
  ["hospital", "hospital"],
  ["urgent care", "hospital"],
  ["pub", "pub"],
  ["bar", "bar"],
];

export const getCategoryEmoji = (
  categoryLabel: string,
  primaryType: string | null
) => {
  const haystack = `${categoryLabel} ${primaryType ?? ""}`
    .toLowerCase()
    .replaceAll("_", " ");
  const match = CATEGORY_EMOJI_KEYWORDS.find(([pattern]) =>
    haystack.includes(pattern)
  );

  return NIGHTLIFE_AMENITY_EMOJI[match?.[1] ?? "default"];
};

export const getNoisyPoiStyle = (
  primaryType: string | null,
  categoryLabel: string
) => ({
  color: (primaryType && NOISY_POI_CATEGORY_COLOR[primaryType]) || FALLBACK_POI_COLOR,
  emoji: getCategoryEmoji(categoryLabel, primaryType),
});

const WEEK_MINUTES = 7 * 24 * 60;
const SAMPLE_STEP_MINUTES = 15;
/** Two equal 12-hour blocks per calendar day — easier to read than DEFRA day/night windows. */
const HALF_DAY_MINUTES = 12 * 60;
const MIDDAY_BLOCK_START_MINUTE = 12 * 60; // noon
const MIDNIGHT_BLOCK_START_MINUTE = 0; // midnight

/**
 * Sun=0…Sat=6, matching Google's `OpeningHoursPoint.day` and JS
 * `Date.getDay()`. Exported so the panel can label each `OpeningCoverage`
 * bar with the calendar day it represents.
 */
export const WEEKDAY_INDICES = [1, 2, 3, 4, 5];
export const WEEKEND_INDICES = [6, 0];

const GOOGLE_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const parseHoursByDay = (
  descriptions: string[] | undefined
): Partial<Record<number, string>> => {
  const hoursByDay: Partial<Record<number, string>> = {};

  for (const line of descriptions ?? []) {
    for (let day = 0; day < GOOGLE_DAY_NAMES.length; day += 1) {
      const dayName = GOOGLE_DAY_NAMES[day];
      if (!line.toLowerCase().startsWith(dayName.toLowerCase())) {
        continue;
      }

      hoursByDay[day] = line.replace(/^[^:]+:\s*/, "").trim() || line;
      break;
    }
  }

  return hoursByDay;
};

const isOpenAtMinuteOfWeek = (
  periods: google.maps.places.OpeningHoursPeriod[],
  minuteOfWeek: number
): boolean =>
  periods.some((period) => {
    const open = period.open;
    if (!open) return false;

    const openMinute = open.day * 1440 + open.hour * 60 + open.minute;
    const close = period.close;
    if (!close) return true; // no close time reported — treated as always open

    let closeMinute = close.day * 1440 + close.hour * 60 + close.minute;
    if (closeMinute <= openMinute) closeMinute += WEEK_MINUTES;

    return (
      (minuteOfWeek >= openMinute && minuteOfWeek < closeMinute) ||
      (minuteOfWeek + WEEK_MINUTES >= openMinute &&
        minuteOfWeek + WEEK_MINUTES < closeMinute)
    );
  });

const openSamplesInBlock = (
  periods: google.maps.places.OpeningHoursPeriod[],
  day: number,
  blockStartMinute: number
): DaySampleSeries => {
  const samples: DaySampleSeries = [];

  for (
    let offset = 0;
    offset < HALF_DAY_MINUTES;
    offset += SAMPLE_STEP_MINUTES
  ) {
    samples.push(
      isOpenAtMinuteOfWeek(periods, day * 1440 + blockStartMinute + offset)
    );
  }

  return samples;
};

/** Samples each calendar day as two 12-hour blocks (noon→midnight, midnight→noon). */
const computeOpeningCoverage = (
  openingHours: google.maps.places.OpeningHours | null | undefined
): OpeningCoverage | null => {
  const periods = openingHours?.periods;
  if (!periods?.length) {
    return null;
  }

  return {
    weekdayMidday: WEEKDAY_INDICES.map((day) =>
      openSamplesInBlock(periods, day, MIDDAY_BLOCK_START_MINUTE)
    ),
    weekdayMidnight: WEEKDAY_INDICES.map((day) =>
      openSamplesInBlock(periods, day, MIDNIGHT_BLOCK_START_MINUTE)
    ),
    weekendMidday: WEEKEND_INDICES.map((day) =>
      openSamplesInBlock(periods, day, MIDDAY_BLOCK_START_MINUTE)
    ),
    weekendMidnight: WEEKEND_INDICES.map((day) =>
      openSamplesInBlock(periods, day, MIDNIGHT_BLOCK_START_MINUTE)
    ),
    hoursByDay: parseHoursByDay(openingHours?.weekdayDescriptions),
  };
};

/** "…noise-keyword-in-context…" excerpt, never the full review. */
const extractNoiseSnippet = (text: string) => {
  const match = NOISE_REVIEW_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const matchStart = match.index;
  const matchEnd = matchStart + match[0].length;
  const start = Math.max(0, matchStart - REVIEW_SNIPPET_CONTEXT_CHARS);
  const end = Math.min(text.length, matchEnd + REVIEW_SNIPPET_CONTEXT_CHARS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
};

/** Only surfaces a review if it actually mentions noise — otherwise no snippet at all. */
const pickReviewSnippet = (place: google.maps.places.Place) => {
  for (const review of place.reviews ?? []) {
    const text = review.text ?? review.originalText ?? "";
    const snippet = extractNoiseSnippet(text);
    if (snippet) {
      return {
        text: snippet,
        relativeTime: review.relativePublishTimeDescription ?? null,
      };
    }
  }

  return null;
};

const pickPhotoUrl = (place: google.maps.places.Place) => {
  const photo = place.photos?.[0];
  if (!photo) {
    return null;
  }

  try {
    return photo.getURI({
      maxWidth: PHOTO_MAX_WIDTH_PX,
      maxHeight: PHOTO_MAX_HEIGHT_PX,
    });
  } catch {
    return null;
  }
};

const placeToSummary = ({
  place,
  originLatitude,
  originLongitude,
}: {
  place: google.maps.places.Place;
  originLatitude: number;
  originLongitude: number;
}): NearbyNoisyPoiSummary | null => {
  const latitude = place.location?.lat();
  const longitude = place.location?.lng();
  const name = formatPlaceName(place.displayName);

  if (latitude == null || longitude == null || !name) {
    return null;
  }

  const distanceMeters = Math.round(
    haversineMeters(originLatitude, originLongitude, latitude, longitude)
  );
  const review = pickReviewSnippet(place);

  return {
    placeId: place.id,
    name,
    categoryLabel: formatCategoryLabel(place),
    primaryType: place.primaryType ?? null,
    latitude,
    longitude,
    distanceMeters,
    proximityTier: proximityTierFromDistance(distanceMeters),
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    openingCoverage: computeOpeningCoverage(place.regularOpeningHours),
    hasLiveMusic: place.hasLiveMusic ?? null,
    businessStatus: place.businessStatus ?? null,
    reviewSnippet: review?.text ?? null,
    reviewRelativeTime: review?.relativeTime ?? null,
    googleMapsUrl: place.googleMapsURI ?? null,
    photoUrl: pickPhotoUrl(place),
  };
};

/**
 * Single Google Places Nearby Search call for the noisiest venue types
 * within `NOISY_POI_SEARCH_RADIUS_METERS`, ranked by distance. Returns up to
 * `MAX_RESULTS` venues so the panel can show a scrollable set, not just the
 * closest one.
 */
export const fetchNearbyNoisyPois = async ({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<NearbyNoisyPoiSummary[]> => {
  if (!hasGooglePlacesClientKey()) {
    return [];
  }

  const { Place, SearchNearbyRankPreference } = await loadPlacesLibrary();

  const { places } = await Place.searchNearby({
    fields: [...NEARBY_FIELDS],
    includedPrimaryTypes: [...NOISY_PRIMARY_TYPES],
    language: "en-GB",
    region: "gb",
    locationRestriction: {
      center: { lat: latitude, lng: longitude },
      radius: NOISY_POI_SEARCH_RADIUS_METERS,
    },
    maxResultCount: 10,
    rankPreference: SearchNearbyRankPreference.DISTANCE,
  });

  if (!places.length) {
    return [];
  }

  return places
    .map((place) =>
      placeToSummary({ place, originLatitude: latitude, originLongitude: longitude })
    )
    .filter((summary): summary is NearbyNoisyPoiSummary => summary !== null)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, MAX_RESULTS);
};
