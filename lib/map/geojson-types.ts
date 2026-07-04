export type RailLineFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: number;
    properties: Record<string, string | null>;
    geometry: {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };
  }>;
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
