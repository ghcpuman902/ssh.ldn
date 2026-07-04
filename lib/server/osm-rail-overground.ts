import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type OverpassWay = {
  type: "way";
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

const buildOvergroundRailQuery = (
  lat: number,
  lng: number,
  radiusMeters: number
) => `[out:json][timeout:45];
(
  way["railway"~"^(rail|light_rail|tram|narrow_gauge)$"]["tunnel"!="yes"]["location"!="underground"]["location"!="tunnel"](around:${radiusMeters},${lat},${lng});
  way["railway"~"^(rail|light_rail|tram)$"]["tunnel"="no"](around:${radiusMeters},${lat},${lng});
);
out geom;`;

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
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
          "User-Agent: ssh.ldn-map/1.0",
          "-H",
          "Accept: application/json",
          "--max-time",
          "60",
        ],
        { maxBuffer: 20 * 1024 * 1024 }
      );

      return JSON.parse(stdout) as { elements?: OverpassWay[] };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Overpass request failed");
    }
  }

  throw lastError ?? new Error("Overpass request failed");
};

export type OsmRailLinesInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export const getOvergroundRailGeoJson = async ({
  lat,
  lng,
  radiusMeters = 6_000,
}: OsmRailLinesInput) => {
  const query = buildOvergroundRailQuery(lat, lng, radiusMeters);
  const payload = await fetchOverpass(query);
  const ways = (payload.elements ?? []).filter(
    (element): element is OverpassWay =>
      element.type === "way" &&
      Array.isArray(element.geometry) &&
      element.geometry.length >= 2
  );

  const features = ways.map((way) => ({
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
      coordinates: way.geometry!.map((point) => [point.lon, point.lat]),
    },
  }));

  return {
    type: "FeatureCollection" as const,
    features,
    meta: {
      source: "osm-overpass",
      filter: "overground-only (excludes tunnel=yes, subway, underground)",
      radiusMeters,
      center: { lat, lng },
      featureCount: features.length,
      retrievedAt: new Date().toISOString(),
    },
  };
};
