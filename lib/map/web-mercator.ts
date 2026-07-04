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

const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;

export const lngLatToTilePixel = ({
  longitude,
  latitude,
  z,
  tileSize = 256,
}: {
  longitude: number;
  latitude: number;
  z: number;
  tileSize?: number;
}) => {
  const clampedLatitude = Math.min(
    WEB_MERCATOR_MAX_LATITUDE,
    Math.max(-WEB_MERCATOR_MAX_LATITUDE, latitude)
  );
  const scale = 2 ** z;
  const x = ((longitude + 180) / 360) * scale;
  const latRad = (clampedLatitude * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    scale;

  const tileX = Math.min(scale - 1, Math.max(0, Math.floor(x)));
  const tileY = Math.min(scale - 1, Math.max(0, Math.floor(y)));

  return {
    z,
    x: tileX,
    y: tileY,
    pixelX: Math.min(
      tileSize - 1,
      Math.max(0, Math.floor((x - tileX) * tileSize))
    ),
    pixelY: Math.min(
      tileSize - 1,
      Math.max(0, Math.floor((y - tileY) * tileSize))
    ),
  };
};
