import { getDefraNoiseSample } from "@/lib/server/defra";
import { getNearestDftTraffic } from "@/lib/server/dft";
import { getOsmLocalContext } from "@/lib/server/osm";
import { getNearbyPlanningApplications } from "@/lib/server/planning";
import { getTestPoint } from "@/lib/server/test-points";

export const buildEvidenceBundleFromCoordinates = async (
  latitude: number,
  longitude: number,
  testPointId = "custom"
) => {
  const retrievedAt = new Date().toISOString();

  const [road, rail, airport, osm, dft, planning] = await Promise.all([
    getDefraNoiseSample({ kind: "road", lat: latitude, lng: longitude }),
    getDefraNoiseSample({
      kind: "rail",
      lat: latitude,
      lng: longitude,
      radiusMeters: 100,
    }),
    getDefraNoiseSample({ kind: "airport", lat: latitude, lng: longitude }),
    getOsmLocalContext({ lat: latitude, lng: longitude, radiusMeters: 300 }),
    getNearestDftTraffic({ lat: latitude, lng: longitude, radiusMeters: 500 }),
    getNearbyPlanningApplications({
      lat: latitude,
      lng: longitude,
      radiusMeters: 300,
    }),
  ]);

  const warnings = [
    ...road.warnings,
    ...rail.warnings,
    ...airport.warnings,
    ...osm.warnings,
    ...dft.warnings,
    ...planning.warnings,
  ];

  return {
    testPointId,
    inputAddress: `${latitude}, ${longitude}`,
    normalizedAddress: `${latitude}, ${longitude}`,
    latitude,
    longitude,
    coordinatePrecision: "exact_coordinates",
    retrievedAt,
    expectedStory: null,
    sources: {
      road,
      rail,
      airport,
      osm,
      dft,
      planning,
    },
    warnings,
  };
};

export const buildEvidenceBundle = async (testPointId: string) => {
  const testPoint = getTestPoint(testPointId);
  if (!testPoint) {
    return null;
  }

  const bundle = await buildEvidenceBundleFromCoordinates(
    testPoint.latitude,
    testPoint.longitude,
    testPoint.id
  );

  return {
    ...bundle,
    inputAddress: testPoint.inputAddress,
    normalizedAddress: testPoint.inputAddress,
    coordinatePrecision: "seeded_test_point",
    expectedStory: testPoint.expectedStory,
  };
};
