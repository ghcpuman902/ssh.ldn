import { readFile } from "node:fs/promises";
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
}) => path.join(TILE_ROOT, kind, period, String(z), String(x), `${y}.png`);

export const readLocalNoiseTile = async (params: {
  kind: DefraMapKind;
  period: DefraNoisePeriod;
  z: number;
  x: number;
  y: number;
}) => {
  try {
    const filePath = localNoiseTilePath(params);
    const buffer = await readFile(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch {
    return null;
  }
};
