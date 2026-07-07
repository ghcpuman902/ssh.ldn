import { extractUkPostcode } from "@/lib/server/geocode-types";
import type { GeocodeResult } from "@/lib/server/geocode-types";
import {
  getTestPoint,
  TEST_POINTS as SERVER_TEST_POINTS,
} from "@/lib/server/test-points";

export type TestPoint = {
  id: string;
  address: string;
  expectedStory: string;
  latitude: number;
  longitude: number;
};

export const TEST_POINTS: TestPoint[] = SERVER_TEST_POINTS.map((point) => ({
  id: point.id,
  address: point.inputAddress,
  expectedStory: point.expectedStory,
  latitude: point.latitude,
  longitude: point.longitude,
}));

export const getTestPointById = (id: string): TestPoint | undefined =>
  TEST_POINTS.find((point) => point.id === id);

export const resolvePresetFromQuery = (
  query: string
): { address: string; testPointId: string } | null => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const exactId = TEST_POINTS.find((point) => point.id === normalized);
  if (exactId) {
    return { address: exactId.address, testPointId: exactId.id };
  }

  const match = TEST_POINTS.find(
    (point) =>
      point.address.toLowerCase() === normalized ||
      point.address.toLowerCase().includes(normalized) ||
      normalized.includes(point.id.replaceAll("_", " "))
  );

  if (!match) {
    return null;
  }

  return { address: match.address, testPointId: match.id };
};

export const buildGeocodeFromTestPoint = (testPointId: string): GeocodeResult => {
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
    sourceEndpoint: "client://test-point",
    retrievedAt: new Date().toISOString(),
    sourceLicence: "internal demo data",
    warnings: [],
    rawResponse: { testPointId: testPoint.id },
  };
};
