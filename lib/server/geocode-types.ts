export type CoordinatePrecision =
  | "exact_address"
  | "building"
  | "street"
  | "postcode"
  | "unknown";

export type GeocodeResult = {
  testPointId?: string;
  inputAddress: string;
  normalizedAddress: string;
  latitude: number;
  longitude: number;
  postcode: string | null;
  coordinatePrecision: CoordinatePrecision;
  geocoderName: string;
  geocoderConfidence: "high" | "medium" | "low";
  source: string;
  sourceEndpoint: string;
  retrievedAt: string;
  sourceLicence: string;
  warnings: string[];
  rawResponse: unknown;
};

export const UK_POSTCODE_REGEX =
  /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

export const extractUkPostcode = (address: string): string | null => {
  const match = address.match(UK_POSTCODE_REGEX);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/\s+/g, " ").toUpperCase();
};

export const inferPrecisionFromNominatim = (
  type: string | undefined,
  className: string | undefined
): CoordinatePrecision => {
  if (className === "building" || type === "house" || type === "address") {
    return "building";
  }

  if (type === "road" || type === "street" || className === "highway") {
    return "street";
  }

  if (type === "postcode" || className === "place") {
    return "postcode";
  }

  return "unknown";
};

export const confidenceFromPrecision = (
  precision: CoordinatePrecision
): GeocodeResult["geocoderConfidence"] => {
  if (precision === "exact_address" || precision === "building") {
    return "high";
  }

  if (precision === "street") {
    return "medium";
  }

  return "low";
};
