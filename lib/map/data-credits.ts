export type DefraNoiseKind = "road" | "rail" | "airport";

export type DataCredit = {
  id: string;
  title: string;
  provider: string;
  licence: string;
  licenceUrl: string;
  datasetUrl: string;
  version: string;
  attribution: string;
  notes?: string;
};

const OGL_URL =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

export const DEFRA_NOISE_CREDITS: Record<DefraNoiseKind, DataCredit> = {
  road: {
    id: "defra-road-noise-r4",
    title: "Strategic Road Noise Mapping — Round 4",
    provider: "DEFRA / environment.data.gov.uk",
    licence: "Open Government Licence v3.0",
    licenceUrl: OGL_URL,
    datasetUrl:
      "https://environment.data.gov.uk/dataset/562c9d56-7c2d-4d42-83bb-578d6e97a517",
    version: "Round 4 (2021 baseline)",
    attribution: "© Crown copyright DEFRA · Road noise R4 · OGL v3.0",
    notes: "10 m grid, 4 m receptor height. Strategic model, not live measurement.",
  },
  rail: {
    id: "defra-rail-noise-r4",
    title: "Strategic Rail Noise Mapping — Round 4",
    provider: "DEFRA / environment.data.gov.uk",
    licence: "Open Government Licence v3.0",
    licenceUrl: OGL_URL,
    datasetUrl:
      "https://environment.data.gov.uk/dataset/3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947",
    version: "Round 4 (2021 baseline)",
    attribution: "© Crown copyright DEFRA · Rail noise R4 · OGL v3.0",
    notes: "All rail sources in model; does not distinguish tube vs overground.",
  },
  airport: {
    id: "defra-airport-noise-r4",
    title: "Strategic Airport Noise Mapping — Round 4",
    provider: "DEFRA / environment.data.gov.uk",
    licence: "Open Government Licence v3.0",
    licenceUrl: OGL_URL,
    datasetUrl:
      "https://environment.data.gov.uk/dataset/dac9cba4-abe7-43bd-b8e9-8a83da52edd8",
    version: "Round 4 (2021 baseline)",
    attribution: "© Crown copyright DEFRA · Airport noise R4 · OGL v3.0",
    notes: "Heathrow, Gatwick, Stansted regional exposure.",
  },
};

export const OSM_RAIL_CREDIT: DataCredit = {
  id: "osm-rail-overground",
  title: "OpenStreetMap railway geometry",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · ODbL",
  notes: "Overground rail lines only; tube/tunnel segments excluded.",
};

export const OSM_NIGHTLIFE_CREDIT: DataCredit = {
  id: "osm-nightlife",
  title: "OpenStreetMap nightlife venues",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · ODbL",
  notes:
    "Pubs, bars, clubs, and music venues. Opening hours are partial; time-slot activity uses heuristics when hours are missing.",
};

export const CARTO_BASEMAP_CREDIT: DataCredit = {
  id: "carto-basemap",
  title: "CARTO basemap (Positron / Dark Matter)",
  provider: "CARTO · OpenStreetMap contributors",
  licence: "BSD / ODbL (OSM data)",
  licenceUrl: "https://carto.com/legal/",
  datasetUrl: "https://basemaps.cartocdn.com/",
  version: "Raster tiles",
  attribution: "© CARTO · © OpenStreetMap contributors",
};

/** All credits shown on the map page — deduped by id. */
export const MAP_DATA_CREDITS: DataCredit[] = [
  CARTO_BASEMAP_CREDIT,
  ...Object.values(DEFRA_NOISE_CREDITS),
  OSM_RAIL_CREDIT,
  OSM_NIGHTLIFE_CREDIT,
];

export const getDefraCredit = (kind: DefraNoiseKind) => DEFRA_NOISE_CREDITS[kind];

export const formatCreditLine = (credit: DataCredit) => credit.attribution;

export const formatCreditsFooter = (credits: DataCredit[]) =>
  credits.map((credit) => credit.attribution).join(" · ");
