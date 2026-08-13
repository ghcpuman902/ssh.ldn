/**
 * Serve committed `data/transit/{mode}/{preview|full}.json`.
 * Request path never calls TfL or Overpass.
 */
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { geometryCacheHeaders } from "@/lib/server/http-cache";

export const TRANSIT_MODES = [
  "tube",
  "overground",
  "elizabeth",
  "dlr",
  "tram",
] as const;

export type TransitMode = (typeof TRANSIT_MODES)[number];

export type TransitGeometryLod = "preview" | "full";

const TRANSIT_ROOT = path.join(process.cwd(), "data/transit");

export const transitGeometryFilePath = (
  mode: TransitMode,
  lod: TransitGeometryLod
) => path.join(TRANSIT_ROOT, mode, `${lod}.json`);

export const readTransitGeometryJson = async (
  mode: TransitMode,
  lod: TransitGeometryLod
) => {
  const filePath = transitGeometryFilePath(mode, lod);
  const raw = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
  return JSON.parse(raw) as unknown;
};

export const streamTransitGeometryFile = async (
  mode: TransitMode,
  lod: TransitGeometryLod
) => {
  const filePath = transitGeometryFilePath(mode, lod);
  const meta = await stat(/* turbopackIgnore: true */ filePath);
  const stream = createReadStream(/* turbopackIgnore: true */ filePath);

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...geometryCacheHeaders(`${mode}-${lod}`),
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(meta.size),
    },
  });
};

export const getTransitGeometryGeoJson = (mode: TransitMode) =>
  readTransitGeometryJson(mode, "full");

export const getTransitPreviewGeoJson = (mode: TransitMode) =>
  readTransitGeometryJson(mode, "preview");

export const getTubeGeometryGeoJson = () => getTransitGeometryGeoJson("tube");
export const getOvergroundGeometryGeoJson = () =>
  getTransitGeometryGeoJson("overground");
export const getElizabethGeometryGeoJson = () =>
  getTransitGeometryGeoJson("elizabeth");
export const getDlrGeometryGeoJson = () => getTransitGeometryGeoJson("dlr");
export const getTramGeometryGeoJson = () => getTransitGeometryGeoJson("tram");
