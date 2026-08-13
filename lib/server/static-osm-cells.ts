/**
 * Serve committed `data/osm-static/{namespace}/{row}-{col}.json`.
 * Map cell GET paths never call Overpass.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { osmCellCacheHeaders } from "@/lib/server/http-cache";

export const OSM_STATIC_NAMESPACES = [
  "nightlife",
  "rail-lines",
  "rail-stations",
  "green-spaces",
] as const;

export type OsmStaticNamespace = (typeof OSM_STATIC_NAMESPACES)[number];

const OSM_STATIC_ROOT = path.join(process.cwd(), "data/osm-static");

const emptyCellCollection = (namespace: OsmStaticNamespace) => ({
  type: "FeatureCollection" as const,
  features: [],
  meta: {
    source: "repo-snapshot",
    featureCount: 0,
    retrievedAt: new Date(0).toISOString(),
    namespace,
    missing: true,
  },
});

export const osmStaticCellPath = (
  namespace: OsmStaticNamespace,
  row: number,
  col: number
) => path.join(OSM_STATIC_ROOT, namespace, `${row}-${col}.json`);

export const streamOsmStaticCell = async (
  namespace: OsmStaticNamespace,
  row: number,
  col: number
) => {
  const filePath = osmStaticCellPath(namespace, row, col);
  const headers = osmCellCacheHeaders(namespace);

  try {
    const meta = await stat(/* turbopackIgnore: true */ filePath);
    const stream = createReadStream(/* turbopackIgnore: true */ filePath);

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": String(meta.size),
      },
    });
  } catch {
    return Response.json(emptyCellCollection(namespace), { headers });
  }
};
