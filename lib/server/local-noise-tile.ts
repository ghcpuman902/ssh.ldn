import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DefraMapKind, DefraNoisePeriod } from "@/lib/map/defra-layers";

const TILE_ROOT = path.join(process.cwd(), "data/noise/tiles");

export const localNoiseTilePath = ({
  kind,
  period,
  z,
  x,
  y,
}: {
  kind: DefraMapKind;
  period: DefraNoisePeriod;
  z: number;
  x: number;
  y: number;
}) => `${TILE_ROOT}/${kind}/${period}/${z}/${x}/${y}.png`;

export const readLocalNoiseTile = async (params: {
  kind: DefraMapKind;
  period: DefraNoisePeriod;
  z: number;
  x: number;
  y: number;
}) => {
  try {
    const filePath = localNoiseTilePath(params);
    const buffer = await readFile(/* turbopackIgnore: true */ filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch {
    return null;
  }
};

/** Persist a WMS tile so repeat views at z13 do not re-fetch upstream. */
export const writeLocalNoiseTile = async (
  params: {
    kind: DefraMapKind;
    period: DefraNoisePeriod;
    z: number;
    x: number;
    y: number;
  },
  data: ArrayBuffer
) => {
  try {
    const filePath = localNoiseTilePath(params);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(data));
  } catch {
    // Read-only or ephemeral FS (e.g. serverless) — skip silently.
  }
};
