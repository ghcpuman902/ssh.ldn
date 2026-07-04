/** Web Mercator tile → EPSG:3857 bbox for WMS 1.3.0 GetMap. */
export const xyzToWebMercatorBbox = (z: number, x: number, y: number) => {
  const scale = 40075016.686;
  const half = scale / 2;
  const n = 2 ** z;

  const minX = (x / n) * scale - half;
  const maxX = ((x + 1) / n) * scale - half;
  const maxY = half - (y / n) * scale;
  const minY = half - ((y + 1) / n) * scale;

  return { minX, minY, maxX, maxY };
};

export const parseTileParams = (z: string, x: string, y: string) => {
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y);

  if (
    !Number.isInteger(zi) ||
    !Number.isInteger(xi) ||
    !Number.isInteger(yi) ||
    zi < 0 ||
    zi > 22 ||
    xi < 0 ||
    yi < 0 ||
    xi >= 2 ** zi ||
    yi >= 2 ** zi
  ) {
    return null;
  }

  return { z: zi, x: xi, y: yi };
};
