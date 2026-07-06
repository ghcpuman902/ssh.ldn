import { withTubeLineOffsets } from "@/lib/map/tube-line-offsets";
import {
  dedupeConsecutiveCoords,
  parseLineStringEntries,
  stripStationLabel,
} from "@/lib/map/tube-line-paths";
import type {
  TubeLineFeatureCollection,
  TubeStationFeatureCollection,
} from "@/lib/map/geojson-types";
import { defaultLineColor } from "@/lib/map/visual-layers";
import {
  fetchOverpass,
  type OverpassRelation,
  type OverpassWay,
} from "@/lib/server/osm-overpass";
import { withOsmDiskCache } from "@/lib/server/osm-cache";

const LONDON_BBOX = "51.24,-0.57,51.73,0.36";
const TFL_API = "https://api.tfl.gov.uk";

export type TransitMode = "tube" | "overground" | "elizabeth";

export type TransitGeometryBundle = {
  lines: TubeLineFeatureCollection;
  stations: TubeStationFeatureCollection;
};

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

type TransitModeConfig = {
  cacheKey: string;
  tflMode: string;
  osmRelationQuery: string;
  osmFilterLabel: string;
  tflFilterLabel: string;
  resolveLineId: (relation: OverpassRelation) => string | null;
};

const OVERGROUND_LINE_RE =
  /^(Liberty|Lioness|Mildmay|Windrush|Weaver|Suffragette)$/i;

const TRANSIT_MODE_CONFIG: Record<TransitMode, TransitModeConfig> = {
  tube: {
    cacheKey: "london-v7",
    tflMode: "tube",
    osmRelationQuery: `relation["type"="route"]["route"="subway"]["network"="London Underground"](${LONDON_BBOX});`,
    osmFilterLabel: "London Underground route relations — track-following geometry",
    tflFilterLabel: "London Underground stations",
    resolveLineId: (relation) => {
      const ref = relation.tags?.ref?.trim();
      return ref ? osmRefToLineId(ref) : null;
    },
  },
  overground: {
    cacheKey: "overground-v1",
    tflMode: "overground",
    osmRelationQuery: `relation["route"="train"]["network"="London Overground"](${LONDON_BBOX});
  relation["type"="route"]["route"="train"]["ref"~"Liberty|Lioness|Mildmay|Windrush|Weaver|Suffragette"](${LONDON_BBOX});`,
    osmFilterLabel:
      "London Overground route relations — named line geometry (Liberty, Lioness, etc.)",
    tflFilterLabel: "London Overground stations",
    resolveLineId: (relation) => {
      const ref = relation.tags?.ref?.trim();
      if (ref && OVERGROUND_LINE_RE.test(ref)) {
        return osmRefToLineId(ref);
      }

      const name = relation.tags?.name ?? "";
      const match = name.match(
        /^(Liberty|Lioness|Mildmay|Windrush|Weaver|Suffragette)\b/i,
      );
      return match ? osmRefToLineId(match[1]) : null;
    },
  },
  elizabeth: {
    cacheKey: "elizabeth-v1",
    tflMode: "elizabeth-line",
    osmRelationQuery: `relation["route"="train"]["name"~"Elizabeth line",i](${LONDON_BBOX});`,
    osmFilterLabel: "Elizabeth line route relations — track-following geometry",
    tflFilterLabel: "Elizabeth line stations",
    resolveLineId: () => "elizabeth",
  },
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

const fetchLineIdsByMode = async (mode: string) => {
  const lines = await fetchJson<Array<{ id?: string }>>(
    `${TFL_API}/Line/Mode/${mode}`,
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

const fetchStationsFromTfl = async (tflMode: string, filterLabel: string) => {
  const lineIds = await fetchLineIdsByMode(tflMode);
  const sequences = await Promise.all(
    lineIds.map(async (lineId) => ({
      lineId,
      sequence: await fetchRouteSequence(lineId),
    })),
  );

  const stationMap = new Map<
    string,
    TubeStationFeatureCollection["features"][number]
  >();

  for (const { lineId, sequence } of sequences) {
    for (const stop of sequence.stations ?? []) {
      upsertStation(stationMap, stop, lineId);
    }
  }

  const retrievedAt = new Date().toISOString();

  return {
    type: "FeatureCollection" as const,
    features: [...stationMap.values()],
    meta: {
      source: "tfl-unified-api",
      filter: filterLabel,
      featureCount: stationMap.size,
      retrievedAt,
    },
  };
};

const fetchLinesFromTfl = async (tflMode: string, filterLabel: string) => {
  const lineIds = await fetchLineIdsByMode(tflMode);
  const sequences = await Promise.all(
    lineIds.map(async (lineId) => ({
      lineId,
      sequence: await fetchRouteSequence(lineId),
    })),
  );

  const lineFeatures: TubeLineFeatureCollection["features"] = [];

  for (const { lineId, sequence } of sequences) {
    lineFeatures.push(...lineFeaturesFromSequence(lineId, sequence));
  }

  const retrievedAt = new Date().toISOString();

  return {
    type: "FeatureCollection" as const,
    features: lineFeatures,
    meta: {
      source: "tfl-unified-api",
      filter: filterLabel,
      featureCount: lineFeatures.length,
      retrievedAt,
    },
  };
};

const isGeometryWay = (
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

const fetchLinesFromOsmRelations = async (
  config: TransitModeConfig,
): Promise<TubeLineFeatureCollection["features"]> => {
  const query = `[out:json][timeout:90];
(
${config.osmRelationQuery}
);
out body;
>;
out geom;`;

  const payload = await fetchOverpass(query);
  const wayById = new Map<number, OverpassWay>();

  for (const element of payload.elements ?? []) {
    if (isGeometryWay(element)) {
      wayById.set(element.id, element);
    }
  }

  const bestByLineId = new Map<
    string,
    { lineId: string; lineName: string; coordinates: CoordPair[] }
  >();

  for (const element of payload.elements ?? []) {
    if (!isRouteRelation(element)) continue;

    const lineId = config.resolveLineId(element);
    if (!lineId) continue;

    const coordinates = assembleRelationCoordinates(element, wayById);
    if (coordinates.length < 2) continue;

    const lineName =
      element.tags?.name?.split(":")[0]?.trim() ??
      element.tags?.ref ??
      lineId;
    const existing = bestByLineId.get(lineId);

    if (!existing || coordinates.length > existing.coordinates.length) {
      bestByLineId.set(lineId, {
        lineId,
        lineName,
        coordinates,
      });
    }
  }

  return [...bestByLineId.values()].map(({ lineId, lineName, coordinates }) => ({
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

const bundleWithLineOffsets = (
  bundle: TransitGeometryBundle,
): TransitGeometryBundle => ({
  ...bundle,
  lines: withTubeLineOffsets(bundle.lines),
});

const buildTransitGeometry = async (
  mode: TransitMode,
): Promise<TransitGeometryBundle> => {
  const config = TRANSIT_MODE_CONFIG[mode];
  const retrievedAt = new Date().toISOString();

  try {
    const [osmLineFeatures, stations] = await Promise.all([
      fetchLinesFromOsmRelations(config),
      fetchStationsFromTfl(config.tflMode, config.tflFilterLabel),
    ]);

    if (osmLineFeatures.length > 0) {
      return bundleWithLineOffsets({
        lines: {
          type: "FeatureCollection",
          features: osmLineFeatures,
          meta: {
            source: "osm-route-relations",
            filter: config.osmFilterLabel,
            featureCount: osmLineFeatures.length,
            retrievedAt,
          },
        },
        stations,
      });
    }
  } catch {
    // Fall through to TfL line geometry.
  }

  const [lines, stations] = await Promise.all([
    fetchLinesFromTfl(config.tflMode, config.osmFilterLabel),
    fetchStationsFromTfl(config.tflMode, config.tflFilterLabel),
  ]);

  return bundleWithLineOffsets({ lines, stations });
};

export const getTransitGeometryGeoJson = async (
  mode: TransitMode,
): Promise<TransitGeometryBundle> => {
  const config = TRANSIT_MODE_CONFIG[mode];

  return withOsmDiskCache(
    `${mode}-geometry`,
    [config.cacheKey],
    () => buildTransitGeometry(mode),
    30 * 24 * 60 * 60 * 1000,
  );
};

export const getTubeGeometryGeoJson = () => getTransitGeometryGeoJson("tube");
export const getOvergroundGeometryGeoJson = () =>
  getTransitGeometryGeoJson("overground");
export const getElizabethGeometryGeoJson = () =>
  getTransitGeometryGeoJson("elizabeth");

/** @deprecated Use TransitGeometryBundle */
export type TubeGeometryBundle = TransitGeometryBundle;
