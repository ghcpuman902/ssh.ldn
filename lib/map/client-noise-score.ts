import { fetchNightlifeCell } from "@/lib/client/nightlife-cell-cache";
import { defraPeriodFromDayPart, type DefraMapKind } from "@/lib/map/defra-layers";
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types";
import type { NoiseTimeSlot } from "@/lib/map/noise-time";
import { osmGridCellForLatLng } from "@/lib/map/osm-grid";
import { sampleDefraRasterIntensity } from "@/lib/map/raster-pixel-sampler";
import {
  computeLocalNoiseSourceScore,
  isLocalNoiseAmenity,
} from "@/lib/map/venue-time";
import {
  airportZoneStrengthFromRaster,
  blendTransportNoiseScore,
  buildTransportContributors,
  transportIntensityToScore,
} from "@/lib/map/transport-noise-scoring";
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
  period: ReturnType<typeof defraPeriodFromDayPart> | "evening";
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
        amenity: feature.properties.amenity,
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
  timeProfile: { day: number; evening: number; night: number };
  caveats: string[];
  recommendedChecks: string[];
};

export const estimateClientNoiseScore = async ({
  latitude,
  longitude,
  zoom,
  timeSlot,
  nightlifeGeoJson,
}: {
  latitude: number;
  longitude: number;
  zoom: number;
  timeSlot: NoiseTimeSlot;
  nightlifeGeoJson: NightlifeFeatureCollection | null;
}): Promise<ClientNoiseScoreSummary> => {
  const activePeriod = defraPeriodFromDayPart(timeSlot.part);

  const [roadIntensity, railIntensity, airportIntensity, localFeatures] =
    await Promise.all([
      sampleTransportIntensity({
        kind: "road",
        period: activePeriod,
        latitude,
        longitude,
        zoom,
      }),
      sampleTransportIntensity({
        kind: "rail",
        period: activePeriod,
        latitude,
        longitude,
        zoom,
      }),
      sampleTransportIntensity({
        kind: "airport",
        period: activePeriod,
        latitude,
        longitude,
        zoom,
      }),
      collectLocalFeatures(latitude, longitude, nightlifeGeoJson),
    ]);

  const roadScore = transportIntensityToScore(roadIntensity, "road");
  const railScore = transportIntensityToScore(railIntensity, "rail");
  const airportScore = transportIntensityToScore(airportIntensity, "airport");
  const airportZoneStrength = airportZoneStrengthFromRaster(airportIntensity);

  const localScoreInputs = localFeatures.map((feature) => ({
    amenity: feature.amenity,
    openingHours: feature.openingHours,
    distanceMeters: feature.distanceMeters,
  }));

  const localNoiseDayScore = computeLocalNoiseSourceScore(localScoreInputs, {
    week: timeSlot.week,
    part: "day",
  });
  const localNoiseNightScore = computeLocalNoiseSourceScore(localScoreInputs, {
    week: timeSlot.week,
    part: "night",
  });
  const localNoiseScore =
    timeSlot.part === "day" ? localNoiseDayScore : localNoiseNightScore;

  const roadDayIntensity = await sampleTransportIntensity({
    kind: "road",
    period: "day",
    latitude,
    longitude,
    zoom,
  });
  const roadEveningIntensity = await sampleTransportIntensity({
    kind: "road",
    period: "evening",
    latitude,
    longitude,
    zoom,
  });
  const roadNightIntensity = await sampleTransportIntensity({
    kind: "road",
    period: "night",
    latitude,
    longitude,
    zoom,
  });
  const railNightIntensity = await sampleTransportIntensity({
    kind: "rail",
    period: "night",
    latitude,
    longitude,
    zoom,
  });

  const airportDayIntensity = await sampleTransportIntensity({
    kind: "airport",
    period: "day",
    latitude,
    longitude,
    zoom,
  });
  const airportNightIntensity = await sampleTransportIntensity({
    kind: "airport",
    period: "night",
    latitude,
    longitude,
    zoom,
  });

  const noiseScore = Math.round(
    blendTransportNoiseScore({
      roadScore,
      railScore,
      airportScore,
      localScore: localNoiseScore,
      airportZoneStrength,
    })
  );
  const confidenceScore = Math.round(
    clamp(
      50 +
        (roadIntensity > 0 ? 12 : 0) +
        (railIntensity > 0 ? 12 : 0) +
        (airportIntensity >= 0.12 ? 10 : 0) +
        (localFeatures.length > 0 ? 8 : 0),
      0,
      85
    )
  );

  const contributors = buildTransportContributors({
    roadScore,
    railScore,
    airportScore,
    localScore: localNoiseScore,
    airportZoneStrength,
  });

  return {
    noiseScore,
    noiseBand: bandFromScore(noiseScore),
    confidenceScore,
    confidenceBand:
      confidenceScore >= 75 ? "High" : confidenceScore >= 55 ? "Medium" : "Low",
    dominantSources: contributors.slice(0, 2).map((item) => item.source),
    contributors,
    timeProfile: {
      day: Math.round(
        Math.max(
          transportIntensityToScore(roadDayIntensity, "road"),
          transportIntensityToScore(airportDayIntensity, "airport"),
          localNoiseDayScore
        )
      ),
      evening: Math.round(
        transportIntensityToScore(roadEveningIntensity, "road")
      ),
      night: Math.round(
        Math.max(
          transportIntensityToScore(roadNightIntensity, "road"),
          transportIntensityToScore(railNightIntensity, "rail"),
          transportIntensityToScore(airportNightIntensity, "airport"),
          localNoiseNightScore
        )
      ),
    },
    caveats: [
      "Preview score from map tiles and nearby venues — planning and traffic load separately.",
    ],
    recommendedChecks: [
      "Visit during the active period if nearby venues or rail metrics are elevated.",
    ],
  };
};
