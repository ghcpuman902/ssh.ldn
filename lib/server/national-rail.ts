export type NationalRailInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export const getNationalRailContext = async ({
  lat,
  lng,
  radiusMeters = 500,
}: NationalRailInput) => {
  return {
    source: "national-rail",
    sourceEndpoint: "nationalrail.co.uk/developers",
    sourceLicence: "Feed-specific licence (registration required)",
    sourceVersion: "not-integrated",
    retrievedAt: new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    radiusMeters,
    coverageStatus: "not_configured",
    stations: [],
    warnings: [
      "National Rail Darwin/Knowledgebase feeds require registration and formal licence.",
      "Use TfL + OSM railway geometry + DEFRA rail baseline for hackathon MVP instead.",
    ],
    documentationUrl: "https://www.nationalrail.co.uk/developers/",
  };
};
