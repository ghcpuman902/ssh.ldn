import TflClient from "tfl-ts";

import { haversineMeters } from "@/lib/server/geo";
import { getTestPoint } from "@/lib/server/test-points";

const tfl = new TflClient({
  appId: process.env.TFL_APP_ID,
  appKey: process.env.TFL_APP_KEY,
  timeout: 8000,
  maxRetries: 1,
});

export type NearbyTflStopsInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
  searchQuery?: string;
  testPointId?: string;
};

const DEFAULT_STOP_TYPES = [
  "NaptanMetroStation",
  "NaptanPublicBusCoachTram",
  "NaptanRailStation",
  "NaptanBusCoachStation",
] as const;

const TEST_POINT_SEARCH_QUERIES: Record<string, string> = {
  ramen_space_dalston: "Dalston Junction",
  kings_cross_euston_road_noisy: "Kings Cross",
  wapping_pub_quiet_aircraft: "Wapping",
  fabric_day_night_pattern: "Farringdon",
  fulham_residential_quiet: "Parsons Green",
};

const isTflGeoNotFound = (error: unknown) =>
  error instanceof Error && /404/.test(error.message);

type SearchMatch = {
  id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  modes?: string[];
  zone?: string;
  icsId?: string;
  topMostParentId?: string;
};

const resolveSearchQuery = ({
  searchQuery,
  testPointId,
}: Pick<NearbyTflStopsInput, "searchQuery" | "testPointId">) => {
  const explicitQuery = searchQuery?.trim();
  if (explicitQuery) {
    return explicitQuery;
  }

  if (!testPointId) {
    return null;
  }

  const mappedQuery = TEST_POINT_SEARCH_QUERIES[testPointId];
  if (mappedQuery) {
    return mappedQuery;
  }

  if (!getTestPoint(testPointId)) {
    return null;
  }

  return null;
};

const getNearbyTflStopsBySearch = async ({
  lat,
  lng,
  radiusMeters,
  query,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  query: string;
}) => {
  const response = await tfl.stopPoint.search({
    query,
    maxResults: 20,
  });

  const stopPoints = (response.matches ?? [])
    .filter(
      (match): match is SearchMatch & { lat: number; lon: number } =>
        Number.isFinite(match.lat) && Number.isFinite(match.lon),
    )
    .map((match) => ({
      ...match,
      commonName: match.name,
      distanceMeters: Math.round(
        haversineMeters(lat, lng, match.lat, match.lon),
      ),
    }))
    .filter((match) => match.distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  return {
    source: "tfl",
    sourceEndpoint: "tfl.stopPoint.search",
    fallbackFrom: "tfl.stopPoint.getByGeoPoint",
    fallbackReason: "StopPoint_GetByGeoPoint returns 404 upstream",
    searchQuery: query,
    retrievedAt: new Date().toISOString(),
    radiusMeters,
    stopPointCount: stopPoints.length,
    stopPoints,
  };
};

export const getNearbyTflStops = async ({
  lat,
  lng,
  radiusMeters = 500,
  searchQuery,
  testPointId,
}: NearbyTflStopsInput) => {
  try {
    const response = await tfl.stopPoint.getByGeoPoint({
      lat,
      lon: lng,
      radius: radiusMeters,
      returnLines: true,
      stoptypes: [...DEFAULT_STOP_TYPES],
    });

    return {
      source: "tfl",
      sourceEndpoint: "tfl.stopPoint.getByGeoPoint",
      retrievedAt: new Date().toISOString(),
      radiusMeters,
      stopPointCount: response.stopPoints?.length ?? 0,
      stopPoints: response.stopPoints ?? [],
    };
  } catch (error) {
    if (!isTflGeoNotFound(error)) {
      throw error;
    }

    const query = resolveSearchQuery({ searchQuery, testPointId });
    if (!query) {
      throw new Error(
        "TfL geo lookup unavailable (404). Provide searchQuery or a known testPointId for name-based fallback.",
      );
    }

    return getNearbyTflStopsBySearch({ lat, lng, radiusMeters, query });
  }
};

export type TflLineStatusInput = {
  lineIds: string[];
  detail?: boolean;
};

export const getTflLineStatus = async ({
  lineIds,
  detail = true,
}: TflLineStatusInput) => {
  const lines = await tfl.line.getStatus({ lineIds, detail });

  return {
    source: "tfl",
    sourceEndpoint: "tfl.line.getStatus",
    retrievedAt: new Date().toISOString(),
    lineIds,
    lineCount: lines.length,
    lines,
  };
};
