import { type GeocodeResult } from "@/lib/server/geocode-types";
import { geocodeWithNominatim } from "@/lib/server/nominatim";
import { geocodeWithPostcodesIo } from "@/lib/server/postcodes-io";

export type GeocodeAddressInput = {
  address: string;
  testPointId?: string;
};

export const geocodeAddress = async ({
  address,
  testPointId,
}: GeocodeAddressInput): Promise<GeocodeResult> => {
  try {
    const nominatimResult = await geocodeWithNominatim({ address, testPointId });

    if (
      nominatimResult.coordinatePrecision === "postcode" ||
      nominatimResult.coordinatePrecision === "unknown"
    ) {
      nominatimResult.warnings.push(
        "Nominatim precision is postcode-level or unknown; consider postcode fallback metadata."
      );
    }

    return nominatimResult;
  } catch (nominatimError) {
    const nominatimMessage =
      nominatimError instanceof Error
        ? nominatimError.message
        : "Nominatim geocoding failed";

    try {
      const fallback = await geocodeWithPostcodesIo({ address, testPointId });
      fallback.warnings.unshift(
        `Primary geocoder (Nominatim) failed: ${nominatimMessage}`
      );
      fallback.warnings.push("Using Postcodes.io postcode-centroid fallback.");
      return fallback;
    } catch (postcodesError) {
      const postcodesMessage =
        postcodesError instanceof Error
          ? postcodesError.message
          : "Postcodes.io geocoding failed";

      throw new Error(
        `All geocoders failed. Nominatim: ${nominatimMessage}. Postcodes.io: ${postcodesMessage}.`
      );
    }
  }
};
