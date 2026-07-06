import type { ResolvedPlace } from "@/lib/map/google-places";
import type { GeocodeResult } from "@/lib/server/geocode-types";
import { confidenceFromPrecision } from "@/lib/server/geocode-types";

export const buildGeocodeResultFromPlace = (
  inputAddress: string,
  place: ResolvedPlace
): GeocodeResult => ({
  inputAddress,
  normalizedAddress: place.normalizedAddress,
  latitude: place.latitude,
  longitude: place.longitude,
  postcode: place.postcode,
  coordinatePrecision: place.coordinatePrecision,
  geocoderName: "google-places",
  geocoderConfidence: confidenceFromPrecision(place.coordinatePrecision),
  source: "google-places (client)",
  sourceEndpoint: "google.maps.places.AutocompleteSuggestion",
  retrievedAt: new Date().toISOString(),
  sourceLicence: "Google Maps Platform (Places API)",
  warnings: [],
  rawResponse: { placeId: place.placeId },
});
