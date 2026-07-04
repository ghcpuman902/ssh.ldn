import {
  type CoordinatePrecision,
  type GeocodeResult,
  confidenceFromPrecision,
  inferPrecisionFromNominatim,
} from "@/lib/server/geocode-types";
import { extractUkPostcode } from "@/lib/server/geocode-types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  class: string;
  importance: number;
  addresstype?: string;
  address?: {
    postcode?: string;
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    suburb?: string;
  };
};

export type NominatimGeocodeInput = {
  address: string;
  testPointId?: string;
};

const mapAddresstypeToPrecision = (
  addresstype: string | undefined,
  osmClass: string | undefined
): CoordinatePrecision => {
  if (
    addresstype === "building" ||
    addresstype === "place" ||
    addresstype === "amenity" ||
    osmClass === "building" ||
    osmClass === "amenity"
  ) {
    return "building";
  }

  if (addresstype === "road" || osmClass === "highway") {
    return "street";
  }

  if (addresstype === "postcode") {
    return "postcode";
  }

  return "unknown";
};

export const geocodeWithNominatim = async ({
  address,
  testPointId,
}: NominatimGeocodeInput): Promise<GeocodeResult> => {
  const warnings: string[] = [
    "Nominatim is for development only; respect 1 req/s rate limit and OSM usage policy.",
  ];

  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "gb",
    addressdetails: "1",
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ssh.ldn-hackathon-discovery/0.1 (local dev)",
    },
    next: { revalidate: 0 },
  });

  const rawResponse = (await response.json()) as NominatimResult[];

  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }

  const top = rawResponse[0];

  if (!top) {
    throw new Error("Nominatim returned no results for address");
  }

  const coordinatePrecision =
    mapAddresstypeToPrecision(top.addresstype, top.class) !== "unknown"
      ? mapAddresstypeToPrecision(top.addresstype, top.class)
      : inferPrecisionFromNominatim(top.type, top.class);

  const postcode =
    top.address?.postcode ?? extractUkPostcode(address) ?? null;

  return {
    testPointId,
    inputAddress: address,
    normalizedAddress: top.display_name,
    latitude: Number(top.lat),
    longitude: Number(top.lon),
    postcode,
    coordinatePrecision,
    geocoderName: "nominatim",
    geocoderConfidence: confidenceFromPrecision(coordinatePrecision),
    source: "nominatim",
    sourceEndpoint: `GET ${NOMINATIM_BASE}/search`,
    retrievedAt: new Date().toISOString(),
    sourceLicence: "ODbL (OpenStreetMap contributors)",
    warnings,
    rawResponse,
  };
};
