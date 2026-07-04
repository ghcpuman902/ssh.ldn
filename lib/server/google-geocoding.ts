import {
  type CoordinatePrecision,
  type GeocodeResult,
  confidenceFromPrecision,
  extractUkPostcode,
} from "@/lib/server/geocode-types";

const GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  geometry: {
    location: { lat: number; lng: number };
    location_type: string;
  };
  place_id: string;
  types: string[];
};

type GoogleGeocodeResponse = {
  results: GoogleGeocodeResult[];
  status: string;
  error_message?: string;
};

export type GoogleGeocodeInput = {
  address: string;
  testPointId?: string;
};

const getGoogleApiKey = (): string => {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }

  return apiKey.trim();
};

const extractPostcodeFromComponents = (
  components: GoogleAddressComponent[]
): string | null => {
  const postcodeComponent = components.find((component) =>
    component.types.includes("postal_code")
  );

  return postcodeComponent?.long_name ?? null;
};

const inferPrecisionFromGoogle = (
  locationType: string,
  types: string[]
): CoordinatePrecision => {
  if (locationType === "ROOFTOP") {
    if (
      types.includes("street_address") ||
      types.includes("premise") ||
      types.includes("subpremise")
    ) {
      return "exact_address";
    }

    return "building";
  }

  if (locationType === "RANGE_INTERPOLATED") {
    return "building";
  }

  if (types.includes("route")) {
    return "street";
  }

  if (locationType === "GEOMETRIC_CENTER" && types.includes("route")) {
    return "street";
  }

  if (types.includes("postal_code") || locationType === "APPROXIMATE") {
    return "postcode";
  }

  return "unknown";
};

export const geocodeWithGoogle = async ({
  address,
  testPointId,
}: GoogleGeocodeInput): Promise<GeocodeResult> => {
  const apiKey = getGoogleApiKey();
  const warnings: string[] = [
    "Google Geocoding API is billable; use server-side only and respect quota limits.",
  ];

  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: "gb",
    components: "country:GB",
  });

  const response = await fetch(`${GOOGLE_GEOCODE_BASE}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  const rawResponse = (await response.json()) as GoogleGeocodeResponse;

  if (!response.ok) {
    throw new Error(`Google Geocoding request failed (${response.status})`);
  }

  if (rawResponse.status === "ZERO_RESULTS") {
    throw new Error("Google Geocoding returned no results for address");
  }

  if (rawResponse.status !== "OK") {
    throw new Error(
      rawResponse.error_message ??
        `Google Geocoding failed with status ${rawResponse.status}`
    );
  }

  const top = rawResponse.results[0];

  if (!top) {
    throw new Error("Google Geocoding returned no results for address");
  }

  const coordinatePrecision = inferPrecisionFromGoogle(
    top.geometry.location_type,
    top.types
  );

  const postcode =
    extractPostcodeFromComponents(top.address_components) ??
    extractUkPostcode(address) ??
    null;

  if (coordinatePrecision === "postcode") {
    warnings.push(
      "Google returned postcode-level or approximate coordinates; lower confidence."
    );
  }

  return {
    testPointId,
    inputAddress: address,
    normalizedAddress: top.formatted_address,
    latitude: top.geometry.location.lat,
    longitude: top.geometry.location.lng,
    postcode,
    coordinatePrecision,
    geocoderName: "google",
    geocoderConfidence: confidenceFromPrecision(coordinatePrecision),
    source: "google-geocoding",
    sourceEndpoint: `GET ${GOOGLE_GEOCODE_BASE}`,
    retrievedAt: new Date().toISOString(),
    sourceLicence: "Google Maps Platform (Geocoding API)",
    warnings,
    rawResponse,
  };
};
