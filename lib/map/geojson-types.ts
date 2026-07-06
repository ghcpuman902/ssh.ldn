export type GeoJsonMeta = {
  source: string;
  filter?: string;
  radiusMeters?: number;
  center?: { lat: number; lng: number };
  featureCount: number;
  retrievedAt: string;
  [key: string]: unknown;
};

export type RailLineFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: number | string;
    properties: Record<string, string | null>;
    geometry: {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };
  }>;
  meta?: GeoJsonMeta;
};

export type RailStationFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: number | string;
    properties: {
      featureId: string;
      name: string | null;
      railway: string | null;
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
  meta?: GeoJsonMeta;
};

export type TubeLineFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string;
    properties: {
      featureId: string;
      lineId: string;
      lineName: string | null;
      color: string;
      /** Perpendicular pixel offset for overlapping shared trunk segments. */
      lineOffset?: number;
    };
    geometry: {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };
  }>;
  meta?: GeoJsonMeta;
};

export type TubeStationFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string;
    properties: {
      featureId: string;
      name: string | null;
      label: string | null;
      lineIds: string[];
      zone: string | null;
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
  meta?: GeoJsonMeta;
};

export type GreenSpaceFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: number | string;
    properties: {
      featureId: string;
      name: string | null;
      kind: string | null;
    };
    geometry: {
      type: "Polygon" | "MultiPolygon" | "LineString";
      coordinates: number[][] | number[][][] | number[][][][];
    };
  }>;
  meta?: GeoJsonMeta;
};

export type NightlifeVenueProperties = {
  featureId: string;
  name: string | null;
  amenity: string | null;
  openingHours: string | null;
  liveMusic: boolean;
  /** Computed client-side from opening hours + time slot. */
  activity?: number;
  heatWeight?: number;
  radiusScale?: number;
};

export type NightlifeFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: number;
    properties: NightlifeVenueProperties;
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
  meta?: {
    source: string;
    filter: string;
    radiusMeters: number;
    center: { lat: number; lng: number };
    featureCount: number;
    retrievedAt: string;
  };
};
