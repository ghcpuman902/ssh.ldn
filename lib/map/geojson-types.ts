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
