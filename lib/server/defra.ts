import { cacheLife } from "next/cache";

const DEFRA_DATASETS = {
  road: {
    datasetId: "562c9d56-7c2d-4d42-83bb-578d6e97a517",
    layers: {
      lden: "Road_Noise_Lden_England_Round_4_All",
      lday: "Road_Noise_Lday_England_Round_4_All",
      leve: "Road_Noise_Leve_England_Round_4_All",
      lnight: "Road_Noise_Lnight_England_Round_4_All",
    },
    metricSource: "DEFRA Road Noise Round 4 WMS",
  },
  rail: {
    datasetId: "3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947",
    layers: {
      lden: "Rail_Noise_Lden_England_Round_4_All",
      lday: "Rail_Noise_Lday_England_Round_4_All",
      leve: "Rail_Noise_Leve_England_Round_4_All",
      lnight: "Rail_Noise_Lnight_England_Round_4_All",
    },
    metricSource: "DEFRA Rail Noise Round 4 WMS",
  },
  airport: {
    datasetId: "dac9cba4-abe7-43bd-b8e9-8a83da52edd8",
    layers: {
      lden: "Airport_Noise_ALL_Lden",
      lday: "Airport_Noise_ALL_Lday",
      leve: "Airport_Noise_ALL_Leve",
      lnight: "Airport_Noise_ALL_Lnight",
    },
    metricSource: "DEFRA Airport Noise Round 4 WMS",
  },
} as const;

export type DefraNoiseKind = keyof typeof DEFRA_DATASETS;

type WmsSample = {
  layer: string;
  value: number | null;
  rawValue: number | null;
  coverageStatus: "covered" | "no_coverage" | "below_threshold";
};

const NODATA_THRESHOLD = 1_000_000;

const normalizeWmsValue = (rawValue: number | null) => {
  if (rawValue === null || !Number.isFinite(rawValue)) {
    return { value: null, coverageStatus: "no_coverage" as const };
  }

  if (rawValue >= NODATA_THRESHOLD || rawValue < 0) {
    return { value: null, coverageStatus: "no_coverage" as const };
  }

  if (rawValue === 0) {
    return { value: 0, coverageStatus: "below_threshold" as const };
  }

  return { value: rawValue, coverageStatus: "covered" as const };
};

const sampleDefraLayer = async ({
  datasetId,
  layer,
  lat,
  lng,
  radiusMeters,
}: {
  datasetId: string;
  layer: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}): Promise<WmsSample> => {
  const latDelta = radiusMeters / 111_320;
  const lngDelta =
    radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [
    lat - latDelta,
    lng - lngDelta,
    lat + latDelta,
    lng + lngDelta,
  ].join(",");

  const url = new URL(
    `https://environment.data.gov.uk/geoservices/datasets/${datasetId}/wms`
  );
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetFeatureInfo");
  url.searchParams.set("LAYERS", layer);
  url.searchParams.set("QUERY_LAYERS", layer);
  url.searchParams.set("CRS", "EPSG:4326");
  url.searchParams.set("BBOX", bbox);
  url.searchParams.set("WIDTH", "101");
  url.searchParams.set("HEIGHT", "101");
  url.searchParams.set("I", "50");
  url.searchParams.set("J", "50");
  url.searchParams.set("INFO_FORMAT", "application/json");

  const response = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`DEFRA WMS request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    features?: Array<{ properties?: { GRAY_INDEX?: number } }>;
  };
  const rawValue = payload.features?.[0]?.properties?.GRAY_INDEX ?? null;
  const normalized = normalizeWmsValue(
    typeof rawValue === "number" ? rawValue : null
  );

  return {
    layer,
    rawValue: typeof rawValue === "number" ? rawValue : null,
    value: normalized.value,
    coverageStatus: normalized.coverageStatus,
  };
};

export type DefraNoiseInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export const getDefraNoiseSample = async ({
  kind,
  lat,
  lng,
  radiusMeters = 50,
}: DefraNoiseInput & { kind: DefraNoiseKind }) => {
  "use cache";
  cacheLife("days");

  const config = DEFRA_DATASETS[kind];
  const retrievedAt = new Date().toISOString();

  const [lden, lday, leve, lnight] = await Promise.all([
    sampleDefraLayer({
      datasetId: config.datasetId,
      layer: config.layers.lden,
      lat,
      lng,
      radiusMeters,
    }),
    sampleDefraLayer({
      datasetId: config.datasetId,
      layer: config.layers.lday,
      lat,
      lng,
      radiusMeters,
    }),
    sampleDefraLayer({
      datasetId: config.datasetId,
      layer: config.layers.leve,
      lat,
      lng,
      radiusMeters,
    }),
    sampleDefraLayer({
      datasetId: config.datasetId,
      layer: config.layers.lnight,
      lat,
      lng,
      radiusMeters,
    }),
  ]);

  const metrics = [lden, lday, leve, lnight];
  const hasCoverage = metrics.some(
    (metric) => metric.coverageStatus === "covered"
  );
  const coverageStatus = hasCoverage ? "covered" : "no_coverage";

  return {
    source: "defra",
    sourceEndpoint: `defra.wms.${kind}`,
    sourceLicence: "OGL v3.0",
    sourceVersion: "Round 4",
    retrievedAt,
    latitude: lat,
    longitude: lng,
    sampleRadiusMeters: radiusMeters,
    metricSource: config.metricSource,
    coverageStatus,
    [`${kind}Lden`]: lden.value,
    [`${kind}Lday`]: lday.value,
    [`${kind}Evening`]: leve.value,
    [`${kind}Lnight`]: lnight.value,
    samples: {
      lden,
      lday,
      leve,
      lnight,
    },
    warnings:
      coverageStatus === "no_coverage"
        ? [
            `No official ${kind} noise coverage at this coordinate within ${radiusMeters}m sample radius.`,
          ]
        : [],
  };
};
