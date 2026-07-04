import londonCountPoints from "@/data/dft-london-count-points.json";
import { haversineMeters } from "@/lib/server/geo";

type CountPoint = {
  countPointId: number;
  roadName: string;
  roadCategory: string;
  roadType: string;
  latitude: number;
  longitude: number;
};

export type DftTrafficInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

const findNearestCountPoint = (lat: number, lng: number, radiusMeters: number) => {
  const points = londonCountPoints as CountPoint[];
  let nearest: (CountPoint & { distanceMeters: number }) | null = null;

  for (const point of points) {
    const distanceMeters = haversineMeters(
      lat,
      lng,
      point.latitude,
      point.longitude
    );

    if (distanceMeters > radiusMeters) {
      continue;
    }

    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { ...point, distanceMeters };
    }
  }

  if (!nearest) {
    let fallback: (CountPoint & { distanceMeters: number }) | null = null;

    for (const point of points) {
      const distanceMeters = haversineMeters(
        lat,
        lng,
        point.latitude,
        point.longitude
      );

      if (!fallback || distanceMeters < fallback.distanceMeters) {
        fallback = { ...point, distanceMeters };
      }
    }

    return fallback;
  }

  return nearest;
};

export const getNearestDftTraffic = async ({
  lat,
  lng,
  radiusMeters = 500,
}: DftTrafficInput) => {
  const nearest = findNearestCountPoint(lat, lng, radiusMeters);

  if (!nearest) {
    return {
      source: "dft",
      sourceEndpoint: "roadtraffic.dft.gov.uk/api/average-annual-daily-flow",
      sourceLicence: "Open Government Licence",
      sourceVersion: "London count-point cache",
      retrievedAt: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      radiusMeters,
      countPointId: null,
      roadName: null,
      roadCategory: null,
      aadfTotal: null,
      aadfHgv: null,
      aadfBusCoach: null,
      countPointLatitude: null,
      countPointLongitude: null,
      distanceMeters: null,
      coverageStatus: "no_coverage",
      warnings: ["No DfT count point found near coordinate."],
    };
  }

  const flowUrl = new URL(
    "https://roadtraffic.dft.gov.uk/api/average-annual-daily-flow"
  );
  flowUrl.searchParams.set(
    "filter[count_point_id]",
    String(nearest.countPointId)
  );
  flowUrl.searchParams.set("page[size]", "1");
  flowUrl.searchParams.set("sort", "-year");

  const response = await fetch(flowUrl, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`DfT AADF request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      year: number;
      all_motor_vehicles: number;
      all_hgvs: number;
      buses_and_coaches: number;
    }>;
  };

  const latest = payload.data?.[0];

  return {
    source: "dft",
    sourceEndpoint: "roadtraffic.dft.gov.uk/api/average-annual-daily-flow",
    sourceLicence: "Open Government Licence",
    sourceVersion: latest ? String(latest.year) : "unknown",
    retrievedAt: new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    radiusMeters,
    countPointId: nearest.countPointId,
    roadName: nearest.roadName,
    roadCategory: nearest.roadCategory,
    roadType: nearest.roadType,
    aadfTotal: latest?.all_motor_vehicles ?? null,
    aadfHgv: latest?.all_hgvs ?? null,
    aadfBusCoach: latest?.buses_and_coaches ?? null,
    countPointLatitude: nearest.latitude,
    countPointLongitude: nearest.longitude,
    distanceMeters: Math.round(nearest.distanceMeters),
    coverageStatus: latest ? "covered" : "no_coverage",
    warnings:
      nearest.distanceMeters > radiusMeters
        ? [
            `Nearest count point is ${Math.round(nearest.distanceMeters)}m away, outside requested ${radiusMeters}m radius.`,
          ]
        : [],
  };
};
