import {
  type GeocodeResult,
  extractUkPostcode,
} from "@/lib/server/geocode-types";
import { cacheLife } from "next/cache";

const POSTCODES_IO_BASE = "https://api.postcodes.io";

type PostcodesIoResponse = {
  status: number;
  result: {
    postcode: string;
    latitude: number;
    longitude: number;
    admin_district: string | null;
    parish: string | null;
    region: string | null;
  } | null;
  error?: string;
};

export type PostcodesIoGeocodeInput = {
  address: string;
  testPointId?: string;
};

export const geocodeWithPostcodesIo = async ({
  address,
  testPointId,
}: PostcodesIoGeocodeInput): Promise<GeocodeResult> => {
  "use cache";
  cacheLife("days");

  const postcode = extractUkPostcode(address);
  const warnings: string[] = [];

  if (!postcode) {
    throw new Error("No UK postcode found in address for Postcodes.io lookup");
  }

  const encodedPostcode = encodeURIComponent(postcode.replace(/\s+/g, ""));
  const response = await fetch(
    `${POSTCODES_IO_BASE}/postcodes/${encodedPostcode}`,
    {
      headers: { Accept: "application/json" },
    }
  );

  const rawResponse = (await response.json()) as PostcodesIoResponse;

  if (!response.ok || !rawResponse.result) {
    throw new Error(
      rawResponse.error ?? `Postcodes.io request failed (${response.status})`
    );
  }

  warnings.push(
    "This shows the centre of the postcode area rather than the exact address — try adding a house number or street name for a more precise pin."
  );

  const { result } = rawResponse;

  return {
    testPointId,
    inputAddress: address,
    normalizedAddress: `${postcode}, ${result.admin_district ?? "London"}`,
    latitude: result.latitude,
    longitude: result.longitude,
    postcode: result.postcode,
    coordinatePrecision: "postcode",
    geocoderName: "postcodes.io",
    geocoderConfidence: "low",
    source: "postcodes.io",
    sourceEndpoint: `GET ${POSTCODES_IO_BASE}/postcodes/{postcode}`,
    retrievedAt: new Date().toISOString(),
    sourceLicence: "OS OpenData (ONSPD via Postcodes.io)",
    warnings,
    rawResponse,
  };
};
