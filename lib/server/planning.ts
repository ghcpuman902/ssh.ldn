import { bboxAroundPoint, haversineMeters } from "@/lib/server/geo";

export type PlanningInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

const parsePoint = (point?: string) => {
  if (!point) {
    return null;
  }

  const match = point.match(/POINT\s*\(([-0-9.]+)\s+([-0-9.]+)\)/i);
  if (!match) {
    return null;
  }

  return {
    longitude: Number(match[1]),
    latitude: Number(match[2]),
  };
};

const fetchPlanningDataEngland = async (
  lat: number,
  lng: number,
  radiusMeters: number
) => {
  const bbox = bboxAroundPoint(lat, lng, radiusMeters);
  const polygon = [
    [bbox.minLng, bbox.minLat],
    [bbox.maxLng, bbox.minLat],
    [bbox.maxLng, bbox.maxLat],
    [bbox.minLng, bbox.maxLat],
    [bbox.minLng, bbox.minLat],
  ]
    .map(([longitude, latitude]) => `${longitude} ${latitude}`)
    .join(",");

  const url = new URL("https://www.planning.data.gov.uk/entity.json");
  url.searchParams.set("dataset", "planning-application");
  url.searchParams.set("limit", "25");
  url.searchParams.set("geometry", `POLYGON((${polygon}))`);
  url.searchParams.set("geometry_relation", "intersects");

  const response = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`planning.data.gov.uk request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    entities?: Array<{
      entity: number;
      reference?: string;
      description?: string;
      "planning-application-status"?: string;
      "planning-decision-type"?: string;
      "decision-date"?: string;
      "address-text"?: string;
      point?: string;
      organisation?: string;
    }>;
    count?: number;
  };

  return (payload.entities ?? []).map((entity) => {
    const coordinates = parsePoint(entity.point);
    const distanceMeters = coordinates
      ? haversineMeters(lat, lng, coordinates.latitude, coordinates.longitude)
      : null;

    return {
      applicationId: String(entity.entity),
      reference: entity.reference ?? null,
      description: entity.description ?? null,
      status: entity["planning-application-status"] ?? null,
      decisionType: entity["planning-decision-type"] ?? null,
      decisionDate: entity["decision-date"] ?? null,
      developmentType: null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      geometry: entity.point ?? null,
      distanceMeters: distanceMeters ? Math.round(distanceMeters) : null,
      planningAuthority: entity.organisation ?? "planning.data.gov.uk",
      source: "planning.data.gov.uk",
    };
  });
};

const fetchLondonPlanningDatahub = async (
  lat: number,
  lng: number,
  radiusMeters: number
) => {
  const response = await fetch(
    "https://planningdata.london.gov.uk/api-guest/applications/_search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-AllowRequest": "be2rmRnt&",
      },
      body: JSON.stringify({
        size: 10,
        query: {
          geo_distance: {
            distance: `${radiusMeters}m`,
            centroid: { lat, lon: lng },
          },
        },
        _source: [
          "lpa_app_no",
          "lpa_name",
          "description",
          "decision",
          "valid_date",
          "decision_date",
          "application_type",
          "centroid_easting",
          "centroid_northing",
        ],
      }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12_000),
    }
  );

  if (!response.ok) {
    throw new Error(`London Planning Datahub request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    hits?: {
      hits?: Array<{
        _source?: {
          lpa_app_no?: string;
          lpa_name?: string;
          description?: string;
          decision?: string;
          valid_date?: string;
          decision_date?: string;
          application_type?: string;
        };
      }>;
    };
  };

  return (payload.hits?.hits ?? []).map((hit) => {
    const source = hit._source ?? {};
    return {
      applicationId: source.lpa_app_no ?? null,
      reference: source.lpa_app_no ?? null,
      description: source.description ?? null,
      status: source.decision ?? null,
      decisionType: source.application_type ?? null,
      submittedDate: source.valid_date ?? null,
      decisionDate: source.decision_date ?? null,
      developmentType: source.application_type ?? null,
      latitude: null,
      longitude: null,
      geometry: null,
      distanceMeters: null,
      planningAuthority: source.lpa_name ?? "London Planning Datahub",
      source: "planningdata.london.gov.uk",
    };
  });
};

export const getNearbyPlanningApplications = async ({
  lat,
  lng,
  radiusMeters = 300,
}: PlanningInput) => {
  const [national, london] = await Promise.all([
    fetchPlanningDataEngland(lat, lng, radiusMeters),
    fetchLondonPlanningDatahub(lat, lng, radiusMeters),
  ]);

  const applications = [...national, ...london].sort((a, b) => {
    if (a.distanceMeters === null) {
      return 1;
    }
    if (b.distanceMeters === null) {
      return -1;
    }
    return a.distanceMeters - b.distanceMeters;
  });

  return {
    source: "planning",
    sourceEndpoint:
      "planning.data.gov.uk/entity.json + planningdata.london.gov.uk/api-guest/applications/_search",
    sourceLicence: "Open Government Licence / GLA terms",
    sourceVersion: "live",
    retrievedAt: new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    radiusMeters,
    applicationCount: applications.length,
    applications,
    warnings:
      applications.length === 0
        ? ["No planning applications returned within radius."]
        : [],
  };
};
