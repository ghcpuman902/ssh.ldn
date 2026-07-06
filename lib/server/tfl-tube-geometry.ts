import TflClient from "tfl-ts";

import { defaultLineColor } from "@/lib/map/visual-layers";
import type {
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types";
import { fetchOverpass, type OverpassWay } from "@/lib/server/osm-overpass";
import { withOsmDiskCache } from "@/lib/server/osm-cache";

const CACHE_KEY = "london-v2";

let tflClient: TflClient | null = null;

const getTflClient = () => {
  if (tflClient) {
    return tflClient;
  }

  const appId = process.env.TFL_APP_ID;
  const appKey = process.env.TFL_APP_KEY;

  if (!appId || !appKey) {
    throw new Error(
      "Missing TfL credentials. Set TFL_APP_ID and TFL_APP_KEY in .env.local.",
    );
  }

  tflClient = new TflClient({
    appId,
    appKey,
    timeout: 12_000,
    maxRetries: 1,
  });

  return tflClient;
};

type CoordPair = [number, number];

const isCoordPair = (value: unknown): value is CoordPair =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number";

const isLineStringCoords = (value: unknown): value is CoordPair[] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  value.every(isCoordPair);

/** TfL returns GeoJSON LineStrings or raw nested coordinate arrays. */
const parseLineStringEntries = (value: string): CoordPair[][] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as { type?: string }).type === "LineString" &&
      "coordinates" in parsed &&
      isLineStringCoords((parsed as { coordinates: unknown }).coordinates)
    ) {
      return [(parsed as { coordinates: CoordPair[] }).coordinates];
    }

    if (isLineStringCoords(parsed)) {
      return [parsed];
    }

    if (Array.isArray(parsed) && parsed.every(isLineStringCoords)) {
      return parsed;
    }

    return [];
  } catch {
    return [];
  }
};

const fetchTubeFromTfl = async (): Promise<{
  lines: TubeLineFeatureCollection;
  stations: TubeStationFeatureCollection;
}> => {
  const client = getTflClient();
  const tubeLines = await client.line.get({ modes: ["tube"] });
  const lineIds = tubeLines
    .map((line) => line.id)
    .filter((id): id is string => Boolean(id));

  const lineFeatures: TubeLineFeatureCollection["features"] = [];
  const stationMap = new Map<
    string,
    TubeStationFeatureCollection["features"][number]
  >();

  for (const lineId of lineIds) {
    const sequence = await client.line.getRouteSequence({
      id: lineId,
      direction: "inbound",
      serviceTypes: ["Regular"],
    });

    const color = defaultLineColor(lineId);
    const lineName = sequence.lineName ?? lineId;

    for (const [stringIndex, lineString] of (sequence.lineStrings ?? []).entries()) {
      const segments = parseLineStringEntries(lineString);

      for (const [segmentIndex, coordinates] of segments.entries()) {
        if (coordinates.length < 2) continue;

        lineFeatures.push({
          type: "Feature",
          id: `${lineId}-${stringIndex}-${segmentIndex}`,
          properties: {
            featureId: `${lineId}-${stringIndex}-${segmentIndex}`,
            lineId,
            lineName,
            color,
          },
          geometry: {
            type: "LineString",
            coordinates,
          },
        });
      }
    }

    for (const stop of sequence.stations ?? []) {
      if (
        typeof stop.lat !== "number" ||
        typeof stop.lon !== "number" ||
        !stop.id
      ) {
        continue;
      }

      const existing = stationMap.get(stop.id);
      if (existing) {
        if (!existing.properties.lineIds.includes(lineId)) {
          existing.properties.lineIds.push(lineId);
        }
        continue;
      }

      stationMap.set(stop.id, {
        type: "Feature",
        id: stop.id,
        properties: {
          featureId: stop.id,
          name: stop.name ?? null,
          lineIds: [lineId],
          zone: stop.zone ?? null,
        },
        geometry: {
          type: "Point",
          coordinates: [stop.lon, stop.lat],
        },
      });
    }
  }

  const retrievedAt = new Date().toISOString();

  return {
    lines: {
      type: "FeatureCollection",
      features: lineFeatures,
      meta: {
        source: "tfl-unified-api",
        filter: "London Underground inbound route sequences",
        featureCount: lineFeatures.length,
        retrievedAt,
      },
    },
    stations: {
      type: "FeatureCollection",
      features: [...stationMap.values()],
      meta: {
        source: "tfl-unified-api",
        filter: "London Underground stations",
        featureCount: stationMap.size,
        retrievedAt,
      },
    },
  };
};

const isSubwayWay = (
  element: unknown,
): element is OverpassWay & { geometry: Array<{ lat: number; lon: number }> } =>
  typeof element === "object" &&
  element !== null &&
  (element as OverpassWay).type === "way" &&
  Array.isArray((element as OverpassWay).geometry) &&
  (element as OverpassWay).geometry!.length >= 2;

const fetchTubeLinesFromOsm = async (): Promise<TubeLineFeatureCollection["features"]> => {
  const query = `[out:json][timeout:90];
(
  way["railway"="subway"](51.24,-0.57,51.73,0.36);
  way["railway"="light_rail"]["network"="London Underground"](51.24,-0.57,51.73,0.36);
);
out geom;`;

  const payload = await fetchOverpass(query);

  return (payload.elements ?? [])
    .filter(isSubwayWay)
    .map((way) => ({
      type: "Feature" as const,
      id: way.id,
      properties: {
        featureId: `way/${way.id}`,
        lineId: way.tags?.ref?.toLowerCase().replace(/\s+/g, "-") ?? "subway",
        lineName: way.tags?.name ?? way.tags?.ref ?? null,
        color: defaultLineColor(
          way.tags?.ref?.toLowerCase().replace(/\s+/g, "-") ?? "subway",
        ),
      },
      geometry: {
        type: "LineString" as const,
        coordinates: way.geometry.map(
          (point) => [point.lon, point.lat] as CoordPair,
        ),
      },
    }));
};

const fetchTubeFromOsm = async (): Promise<{
  lines: TubeLineFeatureCollection;
  stations: TubeStationFeatureCollection;
}> => {
  const query = `[out:json][timeout:60];
(
  node["railway"="station"]["station"="subway"](51.24,-0.57,51.73,0.36);
  node["railway"="station"]["network"="London Underground"](51.24,-0.57,51.73,0.36);
);
out body;`;

  const [payload, lineFeatures] = await Promise.all([
    fetchOverpass(query),
    fetchTubeLinesFromOsm(),
  ]);

  const stationFeatures: TubeStationFeatureCollection["features"] = [];
  const seenStations = new Set<string>();

  for (const element of payload.elements ?? []) {
    if (
      element.type === "node" &&
      typeof element.lat === "number" &&
      typeof element.lon === "number"
    ) {
      const featureId = `node/${element.id}`;
      if (seenStations.has(featureId)) continue;
      seenStations.add(featureId);

      stationFeatures.push({
        type: "Feature",
        id: featureId,
        properties: {
          featureId,
          name: element.tags?.name ?? null,
          lineIds: [],
          zone: element.tags?.zone ?? null,
        },
        geometry: {
          type: "Point",
          coordinates: [element.lon, element.lat],
        },
      });
    }
  }

  const retrievedAt = new Date().toISOString();

  return {
    lines: {
      type: "FeatureCollection",
      features: lineFeatures,
      meta: {
        source: "osm-overpass-fallback",
        filter: "London Underground railway ways",
        featureCount: lineFeatures.length,
        retrievedAt,
      },
    },
    stations: {
      type: "FeatureCollection",
      features: stationFeatures,
      meta: {
        source: "osm-overpass-fallback",
        filter: "London Underground stations",
        featureCount: stationFeatures.length,
        retrievedAt,
      },
    },
  };
};

export type TubeGeometryBundle = {
  lines: TubeLineFeatureCollection;
  stations: TubeStationFeatureCollection;
};

export const getTubeGeometryGeoJson = async (): Promise<TubeGeometryBundle> =>
  withOsmDiskCache(
    "tube-geometry",
    [CACHE_KEY],
    async () => {
      try {
        const tfl = await fetchTubeFromTfl();
        if (tfl.lines.features.length > 0) {
          return tfl;
        }

        return fetchTubeFromOsm();
      } catch {
        return fetchTubeFromOsm();
      }
    },
    30 * 24 * 60 * 60 * 1000,
  );
