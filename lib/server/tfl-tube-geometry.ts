import { withTubeLineOffsets } from "@/lib/map/tube-line-offsets";
import { defaultLineColor } from "@/lib/map/visual-layers";
import {
  dedupeConsecutiveCoords,
  parseLineStringEntries,
  stripStationLabel,
} from "@/lib/map/tube-line-paths";
import type {
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types";
import {
  fetchOverpass,
  type OverpassRelation,
  type OverpassWay,
} from "@/lib/server/osm-overpass";
import { withOsmDiskCache } from "@/lib/server/osm-cache";

const CACHE_KEY = "london-v6";
const LONDON_BBOX = "51.24,-0.57,51.73,0.36";
const TFL_API = "https://api.tfl.gov.uk";

type CoordPair = [number, number];

type TflMatchedStop = {
  id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  zone?: string;
};

type TflRouteSequence = {
  lineName?: string;
  lineStrings?: string[];
  stations?: TflMatchedStop[];
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: { "User-Agent": "ssh.ldn-map/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`TfL request failed (${response.status}): ${url}`);
  }

  return response.json() as Promise<T>;
};

const fetchTubeLineIds = async () => {
  const lines = await fetchJson<Array<{ id?: string }>>(
    `${TFL_API}/Line/Mode/tube`,
  );

  return lines
    .map((line) => line.id)
    .filter((id): id is string => Boolean(id));
};

const fetchRouteSequence = (lineId: string) =>
  fetchJson<TflRouteSequence>(
    `${TFL_API}/Line/${lineId}/Route/Sequence/inbound?serviceTypes=Regular`,
  );

const upsertStation = (
  stationMap: Map<string, TubeStationFeatureCollection["features"][number]>,
  stop: TflMatchedStop,
  lineId: string,
) => {
  if (
    !stop.id ||
    typeof stop.lat !== "number" ||
    typeof stop.lon !== "number"
  ) {
    return;
  }

  const existing = stationMap.get(stop.id);
  if (existing) {
    if (!existing.properties.lineIds.includes(lineId)) {
      existing.properties.lineIds.push(lineId);
    }
    if (stop.zone) {
      existing.properties.zone = stop.zone;
    }
    return;
  }

  stationMap.set(stop.id, {
    type: "Feature",
    id: stop.id,
    properties: {
      featureId: stop.id,
      name: stop.name ?? null,
      label: stripStationLabel(stop.name),
      lineIds: [lineId],
      zone: stop.zone ?? null,
    },
    geometry: {
      type: "Point",
      coordinates: [stop.lon, stop.lat],
    },
  });
};

const lineFeaturesFromSequence = (
  lineId: string,
  sequence: TflRouteSequence,
) => {
  const color = defaultLineColor(lineId);
  const lineName = sequence.lineName ?? lineId;
  const features: TubeLineFeatureCollection["features"] = [];

  for (const [stringIndex, lineString] of (sequence.lineStrings ?? []).entries()) {
    const segments = parseLineStringEntries(lineString);

    for (const [segmentIndex, rawCoordinates] of segments.entries()) {
      const coordinates = dedupeConsecutiveCoords(rawCoordinates);
      if (coordinates.length < 2) continue;

      features.push({
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

  return features;
};

const fetchTubeFromTfl = async (): Promise<{
  lines: TubeLineFeatureCollection;
  stations: TubeStationFeatureCollection;
}> => {
  const lineIds = await fetchTubeLineIds();
  const sequences = await Promise.all(
    lineIds.map(async (lineId) => ({
      lineId,
      sequence: await fetchRouteSequence(lineId),
    })),
  );

  const lineFeatures: TubeLineFeatureCollection["features"] = [];
  const stationMap = new Map<
    string,
    TubeStationFeatureCollection["features"][number]
  >();

  for (const { lineId, sequence } of sequences) {
    lineFeatures.push(...lineFeaturesFromSequence(lineId, sequence));

    for (const stop of sequence.stations ?? []) {
      upsertStation(stationMap, stop, lineId);
    }
  }

  const retrievedAt = new Date().toISOString();

  return {
    lines: {
      type: "FeatureCollection",
      features: lineFeatures,
      meta: {
        source: "tfl-unified-api",
        filter: "London Underground official route polylines",
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

const isRouteRelation = (element: unknown): element is OverpassRelation =>
  typeof element === "object" &&
  element !== null &&
  (element as OverpassRelation).type === "relation";

const isTrackWayMember = (member: { type: string; role: string }) =>
  member.type === "way" &&
  (member.role === "" || member.role === "forward" || member.role === "backward");

const coordDistance = (a: CoordPair, b: CoordPair) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

const orientWaySegment = (
  segment: CoordPair[],
  previousEnd: CoordPair | null,
  role: string,
): CoordPair[] => {
  if (segment.length < 2) return segment;

  if (role === "backward") {
    return [...segment].reverse();
  }

  if (!previousEnd) return segment;

  const start = segment[0];
  const end = segment[segment.length - 1];

  if (coordDistance(previousEnd, end) < coordDistance(previousEnd, start)) {
    return [...segment].reverse();
  }

  return segment;
};

const appendSegment = (target: CoordPair[], segment: CoordPair[]) => {
  for (const coordinate of segment) {
    const previous = target[target.length - 1];
    if (
      previous &&
      Math.abs(previous[0] - coordinate[0]) < 1e-6 &&
      Math.abs(previous[1] - coordinate[1]) < 1e-6
    ) {
      continue;
    }

    target.push(coordinate);
  }
};

const assembleRelationCoordinates = (
  relation: OverpassRelation,
  wayById: Map<number, OverpassWay>,
): CoordPair[] => {
  const coordinates: CoordPair[] = [];

  for (const member of relation.members ?? []) {
    if (!isTrackWayMember(member)) continue;

    const way = wayById.get(member.ref);
    if (!way?.geometry?.length) continue;

    const segment = orientWaySegment(
      way.geometry.map((point) => [point.lon, point.lat] as CoordPair),
      coordinates.length > 0 ? coordinates[coordinates.length - 1] : null,
      member.role,
    );

    appendSegment(coordinates, segment);
  }

  return dedupeConsecutiveCoords(coordinates);
};

const osmRefToLineId = (ref: string) =>
  ref.toLowerCase().replace(/\s*&\s*/g, "-").replace(/\s+/g, "-");

/** Dense track-following geometry from OSM route relations (not schematic). */
const fetchTubeLinesFromOsmRelations = async (): Promise<
  TubeLineFeatureCollection["features"]
> => {
  const query = `[out:json][timeout:90];
relation["type"="route"]["route"="subway"]["network"="London Underground"](${LONDON_BBOX});
out body;
>;
out geom;`;

  const payload = await fetchOverpass(query);
  const wayById = new Map<number, OverpassWay>();

  for (const element of payload.elements ?? []) {
    if (isSubwayWay(element)) {
      wayById.set(element.id, element);
    }
  }

  const bestByRef = new Map<
    string,
    { lineId: string; lineName: string; coordinates: CoordPair[] }
  >();

  for (const element of payload.elements ?? []) {
    if (!isRouteRelation(element)) continue;

    const ref = element.tags?.ref?.trim();
    if (!ref) continue;

    const coordinates = assembleRelationCoordinates(element, wayById);
    if (coordinates.length < 2) continue;

    const lineId = osmRefToLineId(ref);
    const existing = bestByRef.get(lineId);

    if (!existing || coordinates.length > existing.coordinates.length) {
      bestByRef.set(lineId, {
        lineId,
        lineName: element.tags?.name ?? ref,
        coordinates,
      });
    }
  }

  return [...bestByRef.values()].map(({ lineId, lineName, coordinates }) => ({
    type: "Feature" as const,
    id: `relation/${lineId}`,
    properties: {
      featureId: `relation/${lineId}`,
      lineId,
      lineName,
      color: defaultLineColor(lineId),
    },
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  }));
};

const fetchTubeLinesFromOsm = async (): Promise<TubeLineFeatureCollection["features"]> => {
  const query = `[out:json][timeout:90];
(
  way["railway"="subway"](${LONDON_BBOX});
  way["railway"="light_rail"]["network"="London Underground"](${LONDON_BBOX});
);
out geom;`;

  const payload = await fetchOverpass(query);

  return (payload.elements ?? [])
    .filter(isSubwayWay)
    .map((way) => ({
      type: "Feature" as const,
      id: `way/${way.id}`,
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
        coordinates: dedupeConsecutiveCoords(
          way.geometry.map((point) => [point.lon, point.lat] as CoordPair),
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
  node["railway"="station"]["station"="subway"](${LONDON_BBOX});
  node["railway"="station"]["network"="London Underground"](${LONDON_BBOX});
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

      const name = element.tags?.name ?? null;

      stationFeatures.push({
        type: "Feature",
        id: featureId,
        properties: {
          featureId,
          name,
          label: stripStationLabel(name),
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

const bundleWithLineOffsets = (bundle: TubeGeometryBundle): TubeGeometryBundle => ({
  ...bundle,
  lines: withTubeLineOffsets(bundle.lines),
});

export const getTubeGeometryGeoJson = async (): Promise<TubeGeometryBundle> =>
  withOsmDiskCache(
    "tube-geometry",
    [CACHE_KEY],
    async () => {
      const retrievedAt = new Date().toISOString();

      try {
        const [osmLineFeatures, tfl] = await Promise.all([
          fetchTubeLinesFromOsmRelations(),
          fetchTubeFromTfl(),
        ]);

        if (osmLineFeatures.length > 0) {
          return bundleWithLineOffsets({
            lines: {
              type: "FeatureCollection",
              features: osmLineFeatures,
              meta: {
                source: "osm-route-relations",
                filter:
                  "London Underground route relations — track-following geometry",
                featureCount: osmLineFeatures.length,
                retrievedAt,
              },
            },
            stations: tfl.stations,
          });
        }

        if (tfl.lines.features.length > 0) {
          return bundleWithLineOffsets(tfl);
        }
      } catch {
        // Fall through to generic OSM / TfL fallbacks below.
      }

      try {
        const tfl = await fetchTubeFromTfl();
        if (tfl.lines.features.length > 0) {
          return bundleWithLineOffsets(tfl);
        }
      } catch {
        // OSM fallback handles both lines and stations.
      }

      return bundleWithLineOffsets(await fetchTubeFromOsm());
    },
    30 * 24 * 60 * 60 * 1000,
  );
