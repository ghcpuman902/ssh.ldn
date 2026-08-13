import { fetchNightlifeCell } from "@/lib/client/nightlife-cell-cache";
import type { DefraMapKind, DefraNoisePeriod } from "@/lib/map/defra-layers";
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types";
import {
  buildContributors,
  combineLoudness,
  rasterToPresence,
  transportPresenceToScore,
} from "@/lib/map/noise-score-model";
import {
  buildSlotScoreCells,
  type NoiseSlotScoreCell,
} from "@/lib/map/noise-slot-profile";
import { osmGridCellForLatLng } from "@/lib/map/osm-grid";
import { sampleDefraRasterIntensity } from "@/lib/map/raster-pixel-sampler";
import {
  summarizeLocalAmenities,
  type LocalAmenityHint,
} from "@/lib/map/noise-contributor-copy";
import {
  computeLocalNoiseSlotScores,
  isLocalNoiseAmenity,
  type LocalNoiseAmenity,
} from "@/lib/map/venue-time";
import { haversineMeters } from "@/lib/server/geo";

const LOCAL_RADIUS_METERS = 300;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const bandFromScore = (score: number) => {
  if (score >= 75) {
    return "Transport-dominated";
  }
  if (score >= 55) {
    return "High noise risk";
  }
  if (score >= 35) {
    return "Mixed";
  }
  return "Low risk";
};

const sampleTransportIntensity = async ({
  kind,
  period,
  latitude,
  longitude,
  zoom,
}: {
  kind: DefraMapKind;
  period: DefraNoisePeriod;
  latitude: number;
  longitude: number;
  zoom: number;
}) =>
  sampleDefraRasterIntensity({
    kind,
    period,
    latitude,
    longitude,
    zoom,
  }).catch(() => 0);

const scoreFromRasterIntensity = (intensity: number, kind: DefraMapKind) =>
  transportPresenceToScore(kind, rasterToPresence(intensity, kind));

const collectLocalFeatures = async (
  latitude: number,
  longitude: number,
  nightlifeGeoJson: NightlifeFeatureCollection | null
) => {
  let features = nightlifeGeoJson?.features ?? [];
  const cell = osmGridCellForLatLng(latitude, longitude);

  if (cell) {
    const hasNearbyInMemory = features.some((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return haversineMeters(latitude, longitude, lat, lng) <= 500;
    });

    if (!hasNearbyInMemory) {
      const cellData = await fetchNightlifeCell(cell.row, cell.col);
      if (cellData?.features.length) {
        features = [...features, ...cellData.features];
      }
    }
  }

  return features
    .filter((feature) => isLocalNoiseAmenity(feature.properties.amenity))
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return {
        amenity: feature.properties.amenity as LocalNoiseAmenity,
        openingHours: feature.properties.openingHours,
        distanceMeters: haversineMeters(latitude, longitude, lat, lng),
      };
    })
    .filter((feature) => feature.distanceMeters <= LOCAL_RADIUS_METERS);
};

export type ClientNoiseScoreSummary = {
  noiseScore: number;
  noiseBand: string;
  confidenceScore: number;
  confidenceBand: string;
  dominantSources: string[];
  contributors: Array<{ source: string; weight: number; score: number }>;
  localAmenities: LocalAmenityHint[];
  timeProfile: NoiseSlotScoreCell[];
  caveats: string[];
  recommendedChecks: string[];
};

export const estimateClientNoiseScore = async ({
  latitude,
  longitude,
  zoom,
  nightlifeGeoJson,
}: {
  latitude: number;
  longitude: number;
  zoom: number;
  nightlifeGeoJson: NightlifeFeatureCollection | null;
}): Promise<ClientNoiseScoreSummary> => {
  const [
    localFeatures,
    roadDayIntensity,
    roadEveningIntensity,
    roadNightIntensity,
    railDayIntensity,
    railEveningIntensity,
    railNightIntensity,
    airportDayIntensity,
    airportEveningIntensity,
    airportNightIntensity,
  ] = await Promise.all([
    collectLocalFeatures(latitude, longitude, nightlifeGeoJson),
    sampleTransportIntensity({
      kind: "road",
      period: "day",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "road",
      period: "evening",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "road",
      period: "night",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "rail",
      period: "day",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "rail",
      period: "evening",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "rail",
      period: "night",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "airport",
      period: "day",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "airport",
      period: "evening",
      latitude,
      longitude,
      zoom,
    }),
    sampleTransportIntensity({
      kind: "airport",
      period: "night",
      latitude,
      longitude,
      zoom,
    }),
  ]);

  const localBySlot = computeLocalNoiseSlotScores(
    localFeatures.map((feature) => ({
      amenity: feature.amenity,
      openingHours: feature.openingHours,
      distanceMeters: feature.distanceMeters,
    }))
  );

  const eveningOrDay = (evening: number, day: number) =>
    evening > 0 ? evening : day;

  const roadDayScore = scoreFromRasterIntensity(roadDayIntensity, "road");
  const roadEveningScore = scoreFromRasterIntensity(roadEveningIntensity, "road");
  const roadNightScore = scoreFromRasterIntensity(roadNightIntensity, "road");
  const railDayScore = scoreFromRasterIntensity(railDayIntensity, "rail");
  const railEveningScore = scoreFromRasterIntensity(
    eveningOrDay(railEveningIntensity, railDayIntensity),
    "rail"
  );
  const railNightScore = scoreFromRasterIntensity(railNightIntensity, "rail");
  const airportDayScore = scoreFromRasterIntensity(airportDayIntensity, "airport");
  const airportEveningScore = scoreFromRasterIntensity(
    eveningOrDay(airportEveningIntensity, airportDayIntensity),
    "airport"
  );
  const airportNightScore = scoreFromRasterIntensity(
    airportNightIntensity,
    "airport"
  );

  const timeProfile = buildSlotScoreCells({
    transportByPart: {
      day: {
        road: roadDayScore,
        rail: railDayScore,
        airport: airportDayScore,
      },
      evening: {
        road: roadEveningScore,
        rail: railEveningScore,
        airport: airportEveningScore,
      },
      night: {
        road: roadNightScore,
        rail: railNightScore,
        airport: airportNightScore,
      },
    },
    localBySlot,
  });

  const nightlifeOverall = Math.max(0, ...Object.values(localBySlot));

  const scoreByKind = {
    road: Math.max(roadDayScore, roadEveningScore, roadNightScore),
    rail: Math.max(railDayScore, railEveningScore, railNightScore),
    airport: Math.max(airportDayScore, airportEveningScore, airportNightScore),
    nightlife: nightlifeOverall,
  };

  const noiseScore = Math.round(combineLoudness(scoreByKind));
  const confidenceScore = Math.round(
    clamp(
      50 +
        (roadDayIntensity + roadEveningIntensity + roadNightIntensity > 0
          ? 12
          : 0) +
        (railDayIntensity + railNightIntensity > 0 ? 12 : 0) +
        (Math.max(airportDayIntensity, airportNightIntensity) >= 0.12 ? 10 : 0) +
        (localFeatures.length > 0 ? 8 : 0),
      0,
      85
    )
  );

  const contributors = buildContributors(scoreByKind);

  return {
    noiseScore,
    noiseBand: bandFromScore(noiseScore),
    confidenceScore,
    confidenceBand:
      confidenceScore >= 75 ? "High" : confidenceScore >= 55 ? "Medium" : "Low",
    dominantSources: contributors.slice(0, 2).map((item) => item.source),
    contributors,
    localAmenities: summarizeLocalAmenities(localFeatures),
    timeProfile,
    caveats: [
      "Preview score from map tiles and nearby venues — planning and traffic load separately.",
    ],
    recommendedChecks: [
      "Visit at the loudest time in the profile if nearby venues or rail metrics are elevated.",
    ],
  };
};
