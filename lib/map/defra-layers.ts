import { DEFRA_NOISE_CREDITS } from "@/lib/map/data-credits";
import type { NoiseDayPart } from "@/lib/map/noise-time";

export type DefraMapKind = "road" | "rail" | "airport";

export type DefraNoisePeriod = NoiseDayPart | "evening" | "all";

const DAY_EVENING_STYLE =
  "Road_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)" as const;
const NIGHT_STYLE = "Road_Noise_Mapping_Style_LNGT_L06H(-70)" as const;

const ROAD_WMS = {
  day: {
    layer: "Road_Noise_Lday_England_Round_4_All",
    style: DAY_EVENING_STYLE,
  },
  night: {
    layer: "Road_Noise_Lnight_England_Round_4_All",
    style: NIGHT_STYLE,
  },
  evening: {
    layer: "Road_Noise_Leve_England_Round_4_All",
    style: DAY_EVENING_STYLE,
  },
  all: {
    layer: "Road_Noise_Lden_England_Round_4_All",
    style: DAY_EVENING_STYLE,
  },
} as const;

const RAIL_WMS = {
  day: {
    layer: "Rail_Noise_Lday_England_Round_4_All",
    style: "Rail_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
  },
  night: {
    layer: "Rail_Noise_Lnight_England_Round_4_All",
    style: "Rail_Noise_Mapping_Style_LNGT_L06H(-70)",
  },
  evening: {
    layer: "Rail_Noise_Leve_England_Round_4_All",
    style: "Rail_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
  },
  all: {
    layer: "Rail_Noise_Lden_England_Round_4_All",
    style: "Rail_Noise_Mapping_Style_LDEN_LDAY_LEVE_L16H_L18H(-70)",
  },
} as const;

const AIRPORT_WMS = {
  day: { layer: "Airport_Noise_ALL_Lday", style: "" },
  night: { layer: "Airport_Noise_ALL_Lnight", style: "" },
  evening: { layer: "Airport_Noise_ALL_Leve", style: "" },
  all: { layer: "Airport_Noise_ALL_Lden", style: "" },
} as const;

export const DEFRA_MAP_LAYERS = {
  road: {
    datasetId: "562c9d56-7c2d-4d42-83bb-578d6e97a517",
    wmsByPeriod: ROAD_WMS,
    label: "Road noise",
    description: "DEFRA strategic road noise (2021 baseline)",
    defaultOpacity: 0.62,
    attribution: DEFRA_NOISE_CREDITS.road.attribution,
  },
  rail: {
    datasetId: "3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947",
    wmsByPeriod: RAIL_WMS,
    label: "Rail noise",
    description: "DEFRA strategic rail noise — all rail in model",
    defaultOpacity: 0.55,
    attribution: DEFRA_NOISE_CREDITS.rail.attribution,
  },
  airport: {
    datasetId: "dac9cba4-abe7-43bd-b8e9-8a83da52edd8",
    wmsByPeriod: AIRPORT_WMS,
    label: "Aircraft noise",
    description: "DEFRA airport noise — Heathrow, Gatwick, Stansted",
    defaultOpacity: 0.48,
    attribution: DEFRA_NOISE_CREDITS.airport.attribution,
  },
} as const;

export const DEFRA_MAP_KINDS = Object.keys(DEFRA_MAP_LAYERS) as DefraMapKind[];

export const isDefraMapKind = (value: string): value is DefraMapKind =>
  value in DEFRA_MAP_LAYERS;

export const isDefraNoisePeriod = (value: string): value is DefraNoisePeriod =>
  value === "day" ||
  value === "night" ||
  value === "evening" ||
  value === "all";

export const resolveDefraWmsConfig = (
  kind: DefraMapKind,
  period: DefraNoisePeriod
) => DEFRA_MAP_LAYERS[kind].wmsByPeriod[period];

/** Map UI day/night slot → DEFRA WMS period (1:1 for now). */
export const defraPeriodFromDayPart = (part: NoiseDayPart): DefraNoisePeriod =>
  part;
