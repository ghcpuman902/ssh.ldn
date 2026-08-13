import type { OsmGridCell } from "@/lib/map/osm-grid";
import { osmGridCellKey } from "@/lib/map/osm-grid";
import type {
  RailLineFeatureCollection,
  RailStationFeatureCollection,
} from "@/lib/map/geojson-types";
import {
  fetchOverpass,
  type OverpassElement,
  type OverpassWay,
} from "@/lib/server/osm-overpass";
import { withOsmCache } from "@/lib/server/osm-cache";

/** Offline Overpass rebuild helpers. Map cell GET routes stream data/osm-static. */

const bboxFragment = (
  south: number,
  west: number,
  north: number,
  east: number,
) => `${south},${west},${north},${east}`;

const isOvergroundWay = (
  element: OverpassElement,
): element is OverpassWay & { geometry: Array<{ lat: number; lon: number }> } =>
  element.type === "way" &&
  Array.isArray(element.geometry) &&
  element.geometry.length >= 2;

const waysToLineCollection = (
  elements: OverpassElement[] | undefined,
  meta: Record<string, unknown>,
): RailLineFeatureCollection => {
  const features = (elements ?? [])
    .filter(isOvergroundWay)
    .map((way) => ({
      type: "Feature" as const,
      id: way.id,
      properties: {
        railway: way.tags?.railway ?? "rail",
        name: way.tags?.name ?? way.tags?.ref ?? null,
        usage: way.tags?.usage ?? null,
        electrified: way.tags?.electrified ?? null,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: way.geometry.map(
          (point) => [point.lon, point.lat] as [number, number],
        ),
      },
    }));

  return {
    type: "FeatureCollection",
    features,
    meta: {
      source: "osm-overpass",
      filter: "overground-only (excludes tunnel=yes, subway, underground)",
      featureCount: features.length,
      retrievedAt: new Date().toISOString(),
      ...meta,
    },
  };
};

const nodesToStationCollection = (
  elements: OverpassElement[] | undefined,
  meta: Record<string, unknown>,
): RailStationFeatureCollection => {
  const seen = new Set<string>();
  const features = (elements ?? [])
    .filter(
      (element): element is OverpassElement & { lat: number; lon: number } =>
        element.type === "node" &&
        typeof element.lat === "number" &&
        typeof element.lon === "number",
    )
    .map((node) => {
      const featureId = `node/${node.id}`;
      if (seen.has(featureId)) return null;
      seen.add(featureId);

      return {
        type: "Feature" as const,
        id: node.id,
        properties: {
          featureId,
          name: node.tags?.name ?? node.tags?.["name:en"] ?? null,
          railway: node.tags?.railway ?? null,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [node.lon, node.lat] as [number, number],
        },
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

  return {
    type: "FeatureCollection",
    features,
    meta: {
      source: "osm-overpass",
      filter: "rail stations and halts (excludes subway)",
      featureCount: features.length,
      retrievedAt: new Date().toISOString(),
      ...meta,
    },
  };
};

export type OsmRailBboxInput = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const fetchRailLinesForBbox = async (bbox: OsmRailBboxInput) => {
  const fragment = bboxFragment(bbox.south, bbox.west, bbox.north, bbox.east);
  const query = `[out:json][timeout:45];
(
  way["railway"~"^(rail|light_rail|tram|narrow_gauge)$"]["tunnel"!="yes"]["location"!="underground"]["location"!="tunnel"](${fragment});
  way["railway"~"^(rail|light_rail|tram)$"]["tunnel"="no"](${fragment});
);
out geom;`;

  const payload = await fetchOverpass(query);
  return waysToLineCollection(payload.elements, { bbox: fragment });
};

const fetchRailStationsForBbox = async (bbox: OsmRailBboxInput) => {
  const fragment = bboxFragment(bbox.south, bbox.west, bbox.north, bbox.east);
  const query = `[out:json][timeout:45];
(
  node["railway"="station"]["station"!="subway"](${fragment});
  node["railway"="halt"](${fragment});
  node["public_transport"="station"]["train"="yes"](${fragment});
);
out body;`;

  const payload = await fetchOverpass(query);
  return nodesToStationCollection(payload.elements, { bbox: fragment });
};

export const getRailLinesGeoJsonForCell = async (cell: OsmGridCell) =>
  withOsmCache(
    "rail-lines",
    [
      osmGridCellKey(cell.row, cell.col),
      cell.west.toFixed(4),
      cell.south.toFixed(4),
    ],
    () => fetchRailLinesForBbox(cell),
  );

export const getRailStationsGeoJsonForCell = async (cell: OsmGridCell) =>
  withOsmCache(
    "rail-stations",
    [
      osmGridCellKey(cell.row, cell.col),
      cell.west.toFixed(4),
      cell.south.toFixed(4),
    ],
    () => fetchRailStationsForBbox(cell),
  );

export type OsmRailLinesInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

/** Radius-based fetch kept for the existing discovery route. */
export const getOvergroundRailGeoJson = async ({
  lat,
  lng,
  radiusMeters = 6_000,
}: OsmRailLinesInput) =>
  withOsmCache(
    "rail-lines",
    [lat.toFixed(3), lng.toFixed(3), radiusMeters],
    async () => {
      const query = `[out:json][timeout:45];
(
  way["railway"~"^(rail|light_rail|tram|narrow_gauge)$"]["tunnel"!="yes"]["location"!="underground"]["location"!="tunnel"](around:${radiusMeters},${lat},${lng});
  way["railway"~"^(rail|light_rail|tram)$"]["tunnel"="no"](around:${radiusMeters},${lat},${lng});
);
out geom;`;

      const payload = await fetchOverpass(query);
      return waysToLineCollection(payload.elements, {
        radiusMeters,
        center: { lat, lng },
      });
    },
  );
