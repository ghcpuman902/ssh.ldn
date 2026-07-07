import { type GeocodeResult, extractUkPostcode } from "@/lib/server/geocode-types";
import {
  geocodeWithGoogle,
  hasGoogleGeocodingKey,
  reverseGeocodeWithGoogle,
} from "@/lib/server/google-geocoding";
import { geocodeWithNominatim, reverseGeocodeWithNominatim } from "@/lib/server/nominatim";
import { geocodeWithPostcodesIo } from "@/lib/server/postcodes-io";
import { getTestPoint } from "@/lib/server/test-points";

export type GeocodeAddressInput = {
  address: string;
  testPointId?: string;
};

export type ReverseGeocodeInput = {
  latitude: number;
  longitude: number;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isPostcodeOnlyQuery = (address: string) => {
  const postcode = extractUkPostcode(address);
  if (!postcode) {
    return false;
  }

  const compactQuery = address.trim().replace(/\s+/g, "").toUpperCase();
  const compactPostcode = postcode.replace(/\s+/g, "").toUpperCase();

  return compactQuery === compactPostcode;
};

export const geocodeFromTestPoint = (testPointId: string): GeocodeResult => {
  const testPoint = getTestPoint(testPointId);

  if (!testPoint) {
    throw new Error(`Unknown testPointId: ${testPointId}`);
  }

  return {
    testPointId: testPoint.id,
    inputAddress: testPoint.inputAddress,
    normalizedAddress: testPoint.inputAddress,
    latitude: testPoint.latitude,
    longitude: testPoint.longitude,
    postcode: extractUkPostcode(testPoint.inputAddress),
    coordinatePrecision: "building",
    geocoderName: "seeded-test-point",
    geocoderConfidence: "high",
    source: "ssh-ldn demo seed",
    sourceEndpoint: "/api/discovery/geocode?testPointId",
    retrievedAt: new Date().toISOString(),
    sourceLicence: "internal demo data",
    warnings: [],
    rawResponse: { testPointId: testPoint.id },
  };
};

export const geocodeAddress = async ({
  address,
  testPointId,
}: GeocodeAddressInput): Promise<GeocodeResult> => {
  if (testPointId) {
    return geocodeFromTestPoint(testPointId);
  }

  const upstreamFailures: string[] = [];

  if (hasGoogleGeocodingKey()) {
    try {
      return await geocodeWithGoogle({ address, testPointId });
    } catch (googleError) {
      upstreamFailures.push(
        `Google: ${errorMessage(googleError, "geocoding failed")}`
      );
    }
  }

  try {
    const nominatimResult = await geocodeWithNominatim({ address, testPointId });

    if (upstreamFailures.length > 0) {
      nominatimResult.warnings.unshift(
        "Our primary address lookup was unavailable, so we've used a backup source instead."
      );
    }

    const postcode = extractUkPostcode(address);
    const shouldPreferPostcodeCentroid =
      postcode !== null &&
      (isPostcodeOnlyQuery(address) ||
        nominatimResult.coordinatePrecision === "postcode");

    if (shouldPreferPostcodeCentroid) {
      try {
        const postcodeResult = await geocodeWithPostcodesIo({
          address,
          testPointId,
        });
        postcodeResult.warnings.unshift(
          "Showing the centre point of this postcode — add a street name or house number for a more precise pin."
        );
        return postcodeResult;
      } catch {
        nominatimResult.warnings.push(
          "Showing the closest match we could find for this postcode."
        );
      }
    }

    if (nominatimResult.coordinatePrecision === "unknown") {
      nominatimResult.warnings.push(
        "This location may be approximate — try adding a house number or street name for a more precise pin."
      );
    }

    return nominatimResult;
  } catch (nominatimError) {
    upstreamFailures.push(
      `Nominatim: ${errorMessage(nominatimError, "geocoding failed")}`
    );

    try {
      const fallback = await geocodeWithPostcodesIo({ address, testPointId });
      fallback.warnings.unshift(
        "Our address lookup services were unavailable, so we've shown the postcode centre instead."
      );
      return fallback;
    } catch (postcodesError) {
      const postcodesMessage = errorMessage(
        postcodesError,
        "Postcodes.io geocoding failed"
      );

      throw new Error(
        `All geocoders failed. ${upstreamFailures.join("; ")}. Postcodes.io: ${postcodesMessage}.`
      );
    }
  }
};

export const reverseGeocodeCoordinates = async ({
  latitude,
  longitude,
}: ReverseGeocodeInput): Promise<GeocodeResult> => {
  const upstreamFailures: string[] = [];

  if (hasGoogleGeocodingKey()) {
    try {
      return await reverseGeocodeWithGoogle({ latitude, longitude });
    } catch (googleError) {
      upstreamFailures.push(
        `Google: ${errorMessage(googleError, "reverse geocoding failed")}`
      );
    }
  }

  try {
    const nominatimResult = await reverseGeocodeWithNominatim({
      latitude,
      longitude,
    });

    if (upstreamFailures.length > 0) {
      nominatimResult.warnings.unshift(
        "Our primary location lookup was unavailable, so we've used a backup source instead."
      );
    }

    return nominatimResult;
  } catch (nominatimError) {
    upstreamFailures.push(
      `Nominatim: ${errorMessage(nominatimError, "reverse geocoding failed")}`
    );

    throw new Error(
      `All reverse geocoders failed. ${upstreamFailures.join("; ")}.`
    );
  }
};
