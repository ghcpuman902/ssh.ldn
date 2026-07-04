export type LatLng = {
  lat: number;
  lng: number;
};

export const haversineMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
};

export const bearingDegrees = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;
  const deltaLng = toRadians(lng2 - lng1);
  const y = Math.sin(deltaLng) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

export const bboxAroundPoint = (
  lat: number,
  lng: number,
  radiusMeters: number
) => {
  const latDelta = radiusMeters / 111_320;
  const lngDelta =
    radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
};

export const parseLatLng = (lat: number, lng: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false as const, error: "lat and lng are required numbers" };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false as const, error: "lat/lng out of valid range" };
  }

  return { ok: true as const, lat, lng };
};
