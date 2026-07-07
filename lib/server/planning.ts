import { bboxAroundPoint, haversineMeters } from "@/lib/server/geo";
import { cacheLife } from "next/cache";

export type PlanningApplication = {
  applicationId: string | null;
  reference: string | null;
  description: string | null;
  status: string | null;
  decisionType: string | null;
  applicationTypeFull: string | null;
  submittedDate: string | null;
  decisionDate: string | null;
  developmentType: string | null;
  latitude: number | null;
  longitude: number | null;
  geometry: string | null;
  distanceMeters: number | null;
  planningAuthority: string | null;
  urlPlanningApp: string | null;
  source: string;
};

export type PlanningInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export const parsePlanningDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const ukDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ukDateMatch) {
    const [, day, month, year] = ukDateMatch;
    const parsed = Date.parse(`${year}-${month}-${day}`);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
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
      applicationTypeFull: entity["planning-decision-type"] ?? null,
      submittedDate: null,
      decisionDate: entity["decision-date"] ?? null,
      developmentType: null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      geometry: entity.point ?? null,
      distanceMeters: distanceMeters ? Math.round(distanceMeters) : null,
      planningAuthority: entity.organisation ?? "planning.data.gov.uk",
      urlPlanningApp: null,
      source: "planning.data.gov.uk",
    } satisfies PlanningApplication;
  });
};

const LONDON_PLANNING_SOURCE_FIELDS = [
  "lpa_app_no",
  "lpa_name",
  "description",
  "decision",
  "status",
  "valid_date",
  "decision_date",
  "application_type",
  "application_type_full",
  "development_type",
  "centroid",
  "centroid_easting",
  "centroid_northing",
  "url_planning_app",
  "id",
] as const;

type LondonPlanningHit = {
  _source?: {
    lpa_app_no?: string;
    lpa_name?: string;
    description?: string;
    decision?: string;
    status?: string;
    valid_date?: string;
    decision_date?: string;
    application_type?: string;
    application_type_full?: string;
    development_type?: string;
    centroid?: { lat?: string | number; lon?: string | number };
    url_planning_app?: string | null;
    id?: string;
  };
};

const mapLondonPlanningHit = (
  hit: LondonPlanningHit,
  lat: number,
  lng: number
): PlanningApplication => {
  const source = hit._source ?? {};
  const centroidLat = Number(source.centroid?.lat);
  const centroidLng = Number(source.centroid?.lon);
  const hasCentroid =
    Number.isFinite(centroidLat) && Number.isFinite(centroidLng);
  const distanceMeters = hasCentroid
    ? Math.round(haversineMeters(lat, lng, centroidLat, centroidLng))
    : null;

  return {
    applicationId: source.id ?? source.lpa_app_no ?? null,
    reference: source.lpa_app_no ?? null,
    description: source.description ?? null,
    status: source.status ?? source.decision ?? null,
    decisionType: source.decision ?? null,
    applicationTypeFull: source.application_type_full ?? null,
    submittedDate: source.valid_date ?? null,
    decisionDate: source.decision_date ?? null,
    developmentType: source.development_type ?? source.application_type ?? null,
    latitude: hasCentroid ? centroidLat : null,
    longitude: hasCentroid ? centroidLng : null,
    geometry: null,
    distanceMeters,
    planningAuthority: source.lpa_name ?? "London Planning Datahub",
    urlPlanningApp: source.url_planning_app ?? null,
    source: "planningdata.london.gov.uk",
  };
};

const searchLondonPlanningDatahub = async (
  lat: number,
  lng: number,
  radiusMeters: number,
  query: Record<string, unknown>,
  size: number
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
        size,
        query,
        _source: LONDON_PLANNING_SOURCE_FIELDS,
      }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12_000),
    }
  );

  if (!response.ok) {
    throw new Error(`London Planning Datahub request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    hits?: { hits?: LondonPlanningHit[] };
  };

  return payload.hits?.hits ?? [];
};

const fetchLondonPlanningDatahub = async (
  lat: number,
  lng: number,
  radiusMeters: number
) => {
  const geoQuery = {
    geo_distance: {
      distance: `${radiusMeters}m`,
      centroid: { lat, lon: lng },
    },
  };

  const [nearbyHits, linkableHits] = await Promise.all([
    searchLondonPlanningDatahub(lat, lng, radiusMeters, geoQuery, 30),
    searchLondonPlanningDatahub(
      lat,
      lng,
      radiusMeters,
      {
        bool: {
          must: [geoQuery, { exists: { field: "url_planning_app" } }],
        },
      },
      15
    ),
  ]);

  const merged = new Map<string, PlanningApplication>();
  for (const hit of [...linkableHits, ...nearbyHits]) {
    const application = mapLondonPlanningHit(hit, lat, lng);
    const key = application.applicationId ?? application.reference ?? "";
    if (!key || merged.has(key)) {
      continue;
    }
    merged.set(key, application);
  }

  return [...merged.values()];
};

export const getNearbyPlanningApplications = async ({
  lat,
  lng,
  radiusMeters = 300,
}: PlanningInput) => {
  "use cache";
  cacheLife("days");

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
