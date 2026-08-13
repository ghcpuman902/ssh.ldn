import type { OsmGridCell } from "@/lib/map/osm-grid";
import { osmGridCellKey } from "@/lib/map/osm-grid";
import type { GreenSpaceFeatureCollection } from "@/lib/map/geojson-types";
import {
  fetchOverpass,
  type OverpassElement,
  type OverpassWay,
} from "@/lib/server/osm-overpass";
import { withOsmCache } from "@/lib/server/osm-cache";

/** Offline Overpass rebuild helpers. Map cell GET routes stream data/osm-static. */

export type OsmGreenSpacesBboxInput = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const bboxFragment = (
  south: number,
  west: number,
  north: number,
  east: number,
) => `${south},${west},${north},${east}`;

const resolveGreenKind = (tags: Record<string, string> | undefined) => {
  if (!tags) return null;
  return tags.leisure ?? tags.landuse ?? tags.natural ?? null;
};

const isGreenWay = (
  element: OverpassElement,
): element is OverpassWay & { geometry: Array<{ lat: number; lon: number }> } =>
  element.type === "way" &&
  Array.isArray(element.geometry) &&
  element.geometry.length >= 3;

const ringToPolygon = (geometry: Array<{ lat: number; lon: number }>) => {
  const ring = geometry.map((point) => [point.lon, point.lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push(first);
  }

  return ring;
};

const waysToGreenCollection = (
  elements: OverpassElement[] | undefined,
  meta: Record<string, unknown>,
): GreenSpaceFeatureCollection => {
  const features = (elements ?? [])
    .filter(isGreenWay)
    .map((way) => {
      const kind = resolveGreenKind(way.tags);
      if (!kind) return null;

      return {
        type: "Feature" as const,
        id: way.id,
        properties: {
          featureId: `way/${way.id}`,
          name: way.tags?.name ?? way.tags?.["name:en"] ?? null,
          kind,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [ringToPolygon(way.geometry)],
        },
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

  return {
    type: "FeatureCollection",
    features,
    meta: {
      source: "osm-overpass",
      filter: "parks, commons, woods, recreation grounds",
      featureCount: features.length,
      retrievedAt: new Date().toISOString(),
      ...meta,
    },
  };
};

const fetchGreenSpacesForBbox = async (bbox: OsmGreenSpacesBboxInput) => {
  const fragment = bboxFragment(bbox.south, bbox.west, bbox.north, bbox.east);
  const query = `[out:json][timeout:45];
(
  way["leisure"~"^(park|garden|nature_reserve|common)$"](${fragment});
  way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green)$"](${fragment});
  way["natural"="wood"](${fragment});
);
out geom;`;

  const payload = await fetchOverpass(query);
  return waysToGreenCollection(payload.elements, { bbox: fragment });
};

export const getGreenSpacesGeoJsonForCell = async (cell: OsmGridCell) =>
  withOsmCache(
    "green-spaces",
    [
      osmGridCellKey(cell.row, cell.col),
      cell.west.toFixed(4),
      cell.south.toFixed(4),
    ],
    () => fetchGreenSpacesForBbox(cell),
  );
