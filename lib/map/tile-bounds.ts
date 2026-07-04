import { LONDON_BOUNDS } from "@/lib/map/config";

export type LngLatBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const asTuple = (bounds: typeof LONDON_BOUNDS): [[number, number], [number, number]] => {
  if (Array.isArray(bounds) && bounds.length === 2) {
    return bounds as [[number, number], [number, number]];
  }
  throw new Error("Unexpected LONDON_BOUNDS shape");
};

export const londonTileBounds = (): LngLatBounds => {
  const [[west, south], [east, north]] = asTuple(LONDON_BOUNDS);
  return { west, south, east, north };
};

/** Web Mercator tile index for a lng/lat at zoom z. */
export const lngLatToTile = (lng: number, lat: number, z: number) => {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  return { x, y };
};

/** Inclusive tile index range covering a lng/lat bbox at zoom z. */
export const tileRangeForBounds = (bounds: LngLatBounds, z: number) => {
  const topLeft = lngLatToTile(bounds.west, bounds.north, z);
  const bottomRight = lngLatToTile(bounds.east, bounds.south, z);

  return {
    minX: topLeft.x,
    maxX: bottomRight.x,
    minY: topLeft.y,
    maxY: bottomRight.y,
  };
};

export const enumerateTiles = (
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number
) => {
  const tiles: Array<{ z: number; x: number; y: number }> = [];

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const range = tileRangeForBounds(bounds, z);

    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }

  return tiles;
};
