import {
  type CoordinatePrecision,
  type GeocodeResult,
  confidenceFromPrecision,
  extractUkPostcode,
  inferPrecisionFromNominatim,
} from "@/lib/server/geocode-types";
import { nominatimReverse, nominatimSearch } from "@/lib/server/nominatim-client";
import { LONDON_BBOX } from "@/lib/map/config";
import { cacheLife } from "next/cache";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const LONDON_VIEWBOX = `${LONDON_BBOX.west},${LONDON_BBOX.north},${LONDON_BBOX.east},${LONDON_BBOX.south}`;

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

export type NominatimReverseGeocodeInput = {
  latitude: number;
  longitude: number;
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
  "use cache";
  cacheLife("days");

  const warnings: string[] = [
    "Address data provided by OpenStreetMap contributors.",
  ];

  const params = new URLSearchParams({
    q: address.includes("London") ? address : `${address}, London, UK`,
    limit: "1",
    countrycodes: "gb",
    addressdetails: "1",
    viewbox: LONDON_VIEWBOX,
    dedupe: "1",
  });

  const rawResponse = (await nominatimSearch(params)) as NominatimResult[];

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

export const reverseGeocodeWithNominatim = async ({
  latitude,
  longitude,
}: NominatimReverseGeocodeInput): Promise<GeocodeResult> => {
  "use cache";
  cacheLife("days");

  const warnings: string[] = [
    "Location data provided by OpenStreetMap contributors.",
  ];

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    addressdetails: "1",
    zoom: "18",
  });

  const rawResponse = (await nominatimReverse(params)) as
    | (NominatimResult & { error?: string })
    | { error: string };

  if (!rawResponse || "error" in rawResponse) {
    throw new Error(
      (rawResponse as { error?: string })?.error ??
        "Nominatim returned no results for coordinates"
    );
  }

  const coordinatePrecision =
    mapAddresstypeToPrecision(rawResponse.addresstype, rawResponse.class) !==
    "unknown"
      ? mapAddresstypeToPrecision(rawResponse.addresstype, rawResponse.class)
      : inferPrecisionFromNominatim(rawResponse.type, rawResponse.class);

  const postcode = rawResponse.address?.postcode ?? null;

  return {
    inputAddress: `${latitude}, ${longitude}`,
    normalizedAddress: rawResponse.display_name,
    latitude: Number(rawResponse.lat),
    longitude: Number(rawResponse.lon),
    postcode,
    coordinatePrecision,
    geocoderName: "nominatim",
    geocoderConfidence: confidenceFromPrecision(coordinatePrecision),
    source: "nominatim",
    sourceEndpoint: `GET ${NOMINATIM_BASE}/reverse`,
    retrievedAt: new Date().toISOString(),
    sourceLicence: "ODbL (OpenStreetMap contributors)",
    warnings,
    rawResponse,
  };
};
