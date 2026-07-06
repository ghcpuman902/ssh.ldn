import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

import { LONDON_BBOX, LONDON_CENTER } from "@/lib/map/config";
import type { CoordinatePrecision } from "@/lib/server/geocode-types";

export type PlaceSuggestion = {
  id: string;
  label: string;
  address: string;
  placeId: string;
};

export type ResolvedPlace = {
  placeId: string;
  normalizedAddress: string;
  latitude: number;
  longitude: number;
  postcode: string | null;
  coordinatePrecision: CoordinatePrecision;
};

let optionsConfigured = false;
let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null;
const predictionCache = new Map<string, google.maps.places.PlacePrediction>();

export const hasGooglePlacesClientKey = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_GOOGLE_API?.trim());

const configureGoogleMaps = () => {
  if (optionsConfigured || typeof window === "undefined") {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API?.trim();

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_API is not configured");
  }

  setOptions({
    key: apiKey,
    v: "weekly",
  });

  optionsConfigured = true;
};

export const loadPlacesLibrary = async (): Promise<google.maps.PlacesLibrary> => {
  if (typeof window === "undefined") {
    throw new Error("Google Places is only available in the browser");
  }

  configureGoogleMaps();

  if (!placesLibraryPromise) {
    placesLibraryPromise = importLibrary("places");
  }

  return placesLibraryPromise;
};

const formattableText = (
  value: google.maps.places.FormattableText | null | undefined
) => value?.text?.trim() ?? "";

const extractPostcode = (
  addressComponents: google.maps.places.AddressComponent[] | undefined
): string | null => {
  const postcode = addressComponents?.find((component) =>
    component.types.includes("postal_code")
  );

  return postcode?.longText ?? postcode?.shortText ?? null;
};

const inferPrecisionFromPlace = (
  types: string[] | undefined
): CoordinatePrecision => {
  if (
    types?.includes("street_address") ||
    types?.includes("premise") ||
    types?.includes("subpremise")
  ) {
    return "exact_address";
  }

  if (types?.includes("route")) {
    return "street";
  }

  if (types?.includes("postal_code")) {
    return "postcode";
  }

  return "building";
};

const placeToResolved = (
  place: google.maps.places.Place,
  placeId: string
): ResolvedPlace => {
  const latitude = place.location?.lat();
  const longitude = place.location?.lng();

  if (latitude == null || longitude == null) {
    throw new Error("Google Places did not return coordinates for this location");
  }

  const normalizedAddress =
    place.formattedAddress?.trim() ??
    place.displayName?.trim() ??
    "Selected location";

  return {
    placeId,
    normalizedAddress,
    latitude,
    longitude,
    postcode: extractPostcode(place.addressComponents ?? undefined),
    coordinatePrecision: inferPrecisionFromPlace(place.types ?? undefined),
  };
};

export const fetchPlaceSuggestions = async ({
  input,
  sessionToken,
}: {
  input: string;
  sessionToken: google.maps.places.AutocompleteSessionToken;
}): Promise<PlaceSuggestion[]> => {
  const trimmed = input.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const { AutocompleteSuggestion } = await loadPlacesLibrary();

  const request: google.maps.places.AutocompleteRequest = {
    input: trimmed,
    sessionToken,
    includedRegionCodes: ["gb"],
    region: "gb",
    language: "en-GB",
    locationRestriction: {
      west: LONDON_BBOX.west,
      north: LONDON_BBOX.north,
      east: LONDON_BBOX.east,
      south: LONDON_BBOX.south,
    },
    origin: {
      lat: LONDON_CENTER.latitude,
      lng: LONDON_CENTER.longitude,
    },
  };

  const { suggestions } =
    await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

  predictionCache.clear();

  return suggestions
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;

      if (!prediction?.placeId) {
        return null;
      }

      predictionCache.set(prediction.placeId, prediction);

      const mainText = formattableText(prediction.mainText);
      const secondaryText = formattableText(prediction.secondaryText);
      const fullText = formattableText(prediction.text);
      const label =
        mainText && secondaryText
          ? `${mainText}, ${secondaryText}`
          : fullText || mainText || secondaryText;

      if (!label) {
        return null;
      }

      return {
        id: `google:${prediction.placeId}`,
        label,
        address: fullText || label,
        placeId: prediction.placeId,
      };
    })
    .filter((item): item is PlaceSuggestion => item !== null)
    .slice(0, 8);
};

export const createAutocompleteSessionToken =
  async (): Promise<google.maps.places.AutocompleteSessionToken> => {
    const { AutocompleteSessionToken } = await loadPlacesLibrary();
    return new AutocompleteSessionToken();
  };

export const resolvePlacePrediction = async ({
  placeId,
}: {
  placeId: string;
}): Promise<ResolvedPlace> => {
  const { Place } = await loadPlacesLibrary();
  const cachedPrediction = predictionCache.get(placeId);
  const place = cachedPrediction
    ? cachedPrediction.toPlace()
    : new Place({
        id: placeId,
        requestedLanguage: "en-GB",
      });

  await place.fetchFields({
    fields: [
      "id",
      "formattedAddress",
      "location",
      "addressComponents",
      "types",
      "displayName",
    ],
  });

  return placeToResolved(place, placeId);
};
