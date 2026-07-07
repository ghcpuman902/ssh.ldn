import { cacheLife } from "next/cache";

const OPENWEATHER_CURRENT_BASE =
  "https://api.openweathermap.org/data/2.5/weather";

export type OpenWeatherCurrentInput = {
  lat: number;
  lng: number;
};

export const getOpenWeatherCurrent = async ({
  lat,
  lng,
}: OpenWeatherCurrentInput) => {
  "use cache";
  cacheLife("minutes");

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENWEATHER_API_KEY is not set; register at https://openweathermap.org/api"
    );
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: apiKey,
    units: "metric",
  });

  const response = await fetch(
    `${OPENWEATHER_CURRENT_BASE}?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
    }
  );

  const rawResponse = await response.json();

  if (!response.ok) {
    const message =
      typeof rawResponse === "object" &&
      rawResponse !== null &&
      "message" in rawResponse
        ? String((rawResponse as { message?: string }).message)
        : `OpenWeather request failed (${response.status})`;

    throw new Error(message);
  }

  const wind = rawResponse.wind as
    | { speed?: number; deg?: number; gust?: number }
    | undefined;
  const main = rawResponse.main as
    | { temp?: number; humidity?: number; feels_like?: number }
    | undefined;
  const weather = (
    rawResponse.weather as Array<{ main?: string; description?: string }> | undefined
  )?.[0];

  return {
    source: "openweather",
    sourceEndpoint: `GET ${OPENWEATHER_CURRENT_BASE}`,
    retrievedAt: new Date().toISOString(),
    sourceLicence: "OpenWeather Terms of Use",
    sourceVersion: "2.5",
    rawResponseSaved: true,
    warnings: [
      "OpenWeather free tier has rate limits; use Open-Meteo as keyless fallback.",
    ],
    latitude: lat,
    longitude: lng,
    temperatureC: main?.temp ?? null,
    feelsLikeC: main?.feels_like ?? null,
    humidityPct: main?.humidity ?? null,
    windSpeedMs: wind?.speed ?? null,
    windDirectionDeg: wind?.deg ?? null,
    windGustMs: wind?.gust ?? null,
    weatherMain: weather?.main ?? null,
    weatherDescription: weather?.description ?? null,
    rawResponse,
    features:
      wind?.speed !== undefined || main?.temp !== undefined
        ? [
            {
              featureId: `openweather-current-${lat.toFixed(4)}-${lng.toFixed(4)}`,
              featureType: "current_weather",
              featureName: weather?.main ?? "Current conditions",
              latitude: lat,
              longitude: lng,
              geometry: null,
              distanceMeters: 0,
              bearingDegrees: wind?.deg ?? null,
              timeProfile: "now",
              scoreContribution: null,
              evidenceLabel: `${weather?.description ?? "Weather"}; wind ${wind?.speed ?? "?"} m/s`,
              sourceProperties: {
                temperatureC: main?.temp,
                windSpeedMs: wind?.speed,
                windDirectionDeg: wind?.deg,
              },
            },
          ]
        : [],
    confidenceContribution: 0.7,
  };
};
