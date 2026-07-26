import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
] as const;

/** Public Overpass mirrors rate-limit hard under parallel viewport fetches. */
const MAX_CONCURRENT_OVERPASS = 2;

let activeOverpass = 0;
const overpassWaiters: Array<() => void> = [];

const acquireOverpassSlot = async () => {
  if (activeOverpass < MAX_CONCURRENT_OVERPASS) {
    activeOverpass += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    overpassWaiters.push(resolve);
  });
  activeOverpass += 1;
};

const releaseOverpassSlot = () => {
  activeOverpass = Math.max(0, activeOverpass - 1);
  const next = overpassWaiters.shift();
  if (next) next();
};

export type OverpassNode = {
  type: "node";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

export type OverpassWay = {
  type: "way";
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassRelation = {
  type: "relation";
  id: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  members?: Array<{
    type: string;
    ref: number;
    role: string;
  }>;
};

export type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

const fetchOverpassUnthrottled = async (query: string) => {
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
          "User-Agent: ssh-ldn-map/1.0",
          "-H",
          "Accept: application/json",
          "--max-time",
          "60",
        ],
        { maxBuffer: 30 * 1024 * 1024 },
      );

      const trimmed = stdout.trim();
      if (!trimmed || trimmed.startsWith("<")) {
        throw new Error(`Overpass returned non-JSON from ${endpoint}`);
      }

      return JSON.parse(trimmed) as { elements?: OverpassElement[] };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Overpass request failed");
    }
  }

  throw lastError ?? new Error("Overpass request failed");
};

export const fetchOverpass = async (query: string) => {
  await acquireOverpassSlot();
  try {
    return await fetchOverpassUnthrottled(query);
  } finally {
    releaseOverpassSlot();
  }
};

export const buildBboxQuery = (
  south: number,
  west: number,
  north: number,
  east: number,
  body: string,
) => `[out:json][timeout:45];
(
${body}
);
out geom;`;
