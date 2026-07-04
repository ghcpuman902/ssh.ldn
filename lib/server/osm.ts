import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { bearingDegrees, haversineMeters } from "@/lib/server/geo";

const execFileAsync = promisify(execFile);

export type OsmContextInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const buildOverpassQuery = (lat: number, lng: number, radiusMeters: number) =>
  `[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lng})["amenity"~"pub|bar|nightclub"];
  way(around:${radiusMeters},${lat},${lng})["amenity"~"pub|bar|nightclub"];
  node(around:${radiusMeters},${lat},${lng})["railway"~"rail|subway|light_rail|station"];
  way(around:${radiusMeters},${lat},${lng})["railway"~"rail|subway|light_rail"];
  way(around:${radiusMeters},${lat},${lng})["highway"~"motorway|trunk|primary|secondary"];
);
out center 120 tags;`;

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

const fetchOverpass = async (query: string) => {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "-sS",
          "-G",
          endpoint,
          "--data-urlencode",
          `data=${query}`,
          "-H",
          "User-Agent: ssh.ldn-discovery/1.0 (B1 endpoint testing)",
          "-H",
          "Accept: application/json",
          "--max-time",
          "45",
        ],
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const payload = JSON.parse(stdout) as { elements?: OverpassElement[] };
      return { payload, endpoint };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Overpass curl request failed");
    }
  }

  throw lastError ?? new Error("Overpass request failed");
};

const getElementLatLng = (element: OverpassElement) => {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { latitude: element.lat, longitude: element.lon };
  }

  if (element.center) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }

  return null;
};

export const getOsmLocalContext = async ({
  lat,
  lng,
  radiusMeters = 300,
}: OsmContextInput) => {
  const query = buildOverpassQuery(lat, lng, radiusMeters);
  const { payload, endpoint } = await fetchOverpass(query);

  const seen = new Set<string>();
  const features = (payload.elements ?? [])
    .map((element) => {
      const coordinates = getElementLatLng(element);
      if (!coordinates) {
        return null;
      }

      const featureId = `${element.type}/${element.id}`;
      if (seen.has(featureId)) {
        return null;
      }
      seen.add(featureId);

      const distanceMeters = haversineMeters(
        lat,
        lng,
        coordinates.latitude,
        coordinates.longitude
      );

      return {
        featureId,
        osmId: element.id,
        osmType: element.type,
        name: element.tags?.name ?? null,
        amenity: element.tags?.amenity ?? null,
        highway: element.tags?.highway ?? null,
        railway: element.tags?.railway ?? null,
        building: element.tags?.building ?? null,
        buildingLevels: element.tags?.["building:levels"] ?? null,
        openingHours: element.tags?.opening_hours ?? null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        geometry: {
          type: "Point" as const,
          coordinates: [coordinates.longitude, coordinates.latitude],
        },
        distanceMeters: Math.round(distanceMeters),
        bearingDegrees: Math.round(
          bearingDegrees(
            lat,
            lng,
            coordinates.latitude,
            coordinates.longitude
          )
        ),
        sourceProperties: element.tags ?? {},
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return {
    source: "osm",
    sourceEndpoint: endpoint,
    sourceLicence: "ODbL",
    sourceVersion: "OpenStreetMap live",
    retrievedAt: new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    radiusMeters,
    featureCount: features.length,
    features,
    warnings: features.length === 0 ? ["No OSM features returned in radius."] : [],
  };
};
