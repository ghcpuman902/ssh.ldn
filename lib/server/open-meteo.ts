import { cacheLife } from "next/cache";

const OPEN_METEO_FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_CLIMATE_BASE = "https://climate-api.open-meteo.com/v1/climate";

export type OpenMeteoForecastInput = {
  lat: number;
  lng: number;
  forecastDays?: number;
};

export type OpenMeteoClimateInput = {
  lat: number;
  lng: number;
};

const fetchOpenMeteoJson = async (url: string, sourceEndpoint: string) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  const rawResponse = await response.json();

  if (!response.ok) {
    const message =
      typeof rawResponse === "object" &&
      rawResponse !== null &&
      "reason" in rawResponse
        ? String((rawResponse as { reason?: string }).reason)
        : `Open-Meteo request failed (${response.status})`;

    throw new Error(message);
  }

  return {
    source: "open-meteo",
    sourceEndpoint,
    retrievedAt: new Date().toISOString(),
    sourceLicence: "CC BY 4.0 (Open-Meteo)",
    sourceVersion: "v1",
    rawResponseSaved: true,
    warnings: [] as string[],
    rawResponse,
  };
};

export const getOpenMeteoForecast = async ({
  lat,
  lng,
  forecastDays = 2,
}: OpenMeteoForecastInput) => {
  "use cache";
  cacheLife("minutes");

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: "Europe/London",
    forecast_days: String(forecastDays),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
    ].join(","),
    hourly: ["temperature_2m", "wind_speed_10m", "wind_direction_10m"].join(
      ","
    ),
  });

  const result = await fetchOpenMeteoJson(
    `${OPEN_METEO_FORECAST_BASE}?${params.toString()}`,
    `GET ${OPEN_METEO_FORECAST_BASE}`
  );

  const current = result.rawResponse.current as
    | Record<string, number | string>
    | undefined;

  return {
    ...result,
    latitude: lat,
    longitude: lng,
    forecastDays,
    current,
    features: current
      ? [
          {
            featureId: `open-meteo-current-${lat.toFixed(4)}-${lng.toFixed(4)}`,
            featureType: "current_weather",
            featureName: "Current conditions",
            latitude: lat,
            longitude: lng,
            geometry: null,
            distanceMeters: 0,
            bearingDegrees: null,
            timeProfile: "now",
            scoreContribution: null,
            evidenceLabel: `Wind ${current.wind_speed_10m} km/h, temp ${current.temperature_2m}°C`,
            sourceProperties: current,
          },
        ]
      : [],
    confidenceContribution: 0.6,
  };
};

export const getOpenMeteoClimateNormals = async ({
  lat,
  lng,
}: OpenMeteoClimateInput) => {
  "use cache";
  cacheLife("days");

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: "2021-01-01",
    end_date: "2030-12-31",
    models: "EC_Earth3P_HR",
    daily: [
      "temperature_2m_mean",
      "precipitation_sum",
      "wind_speed_10m_mean",
    ].join(","),
    timezone: "Europe/London",
  });

  const result = await fetchOpenMeteoJson(
    `${OPEN_METEO_CLIMATE_BASE}?${params.toString()}`,
    `GET ${OPEN_METEO_CLIMATE_BASE}`
  );

  const daily = result.rawResponse.daily as
    | Record<string, Array<number | string>>
    | undefined;

  const windMeans = (daily?.wind_speed_10m_mean ?? []).filter(
    (value): value is number => typeof value === "number"
  );
  const tempMeans = (daily?.temperature_2m_mean ?? []).filter(
    (value): value is number => typeof value === "number"
  );

  const avgWindKmh =
    windMeans.length > 0
      ? windMeans.reduce((sum, value) => sum + value, 0) / windMeans.length
      : null;
  const avgTempC =
    tempMeans.length > 0
      ? tempMeans.reduce((sum, value) => sum + value, 0) / tempMeans.length
      : null;

  result.warnings.push(
    "Climate normals are modelled decadal projections, not observed station data."
  );

  return {
    ...result,
    latitude: lat,
    longitude: lng,
    avgWindKmh,
    avgTempC,
    features:
      avgWindKmh !== null || avgTempC !== null
        ? [
            {
              featureId: `open-meteo-climate-${lat.toFixed(4)}-${lng.toFixed(4)}`,
              featureType: "climate_normal",
              featureName: "Decadal climate normals",
              latitude: lat,
              longitude: lng,
              geometry: null,
              distanceMeters: 0,
              bearingDegrees: null,
              timeProfile: "annual_average",
              scoreContribution: null,
              evidenceLabel: `Typical wind ~${avgWindKmh?.toFixed(1) ?? "?"} km/h, temp ~${avgTempC?.toFixed(1) ?? "?"}°C`,
              sourceProperties: { avgWindKmh, avgTempC },
            },
          ]
        : [],
    confidenceContribution: 0.4,
  };
};
