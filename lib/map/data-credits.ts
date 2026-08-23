export type DefraNoiseKind = "road" | "rail" | "airport"

/** Shown in the map footer marquee alongside dataset attributions. */
export const MAP_STRATEGIC_DISCLAIMER =
  "Official strategic noise maps (DEFRA Round 4, 2021 baseline) — annual averages, not live measurement"

export type DataCredit = {
  id: string
  title: string
  provider: string
  licence: string
  licenceUrl: string
  datasetUrl: string
  version: string
  attribution: string
  notes?: string
}

const OGL_URL =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"

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
    notes:
      "10 m grid, 4 m receptor height. Strategic model, not live measurement.",
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
    notes:
      "All rail sources in model; does not distinguish tube vs overground.",
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
}

export const OSM_RAIL_CREDIT: DataCredit = {
  id: "osm-rail-overground",
  title: "OpenStreetMap railway geometry",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · ODbL",
  notes:
    "Above-ground rail only; tube and tunnel segments excluded. Always shown under noise overlays.",
}

export const OSM_GREEN_SPACES_CREDIT: DataCredit = {
  id: "osm-green-spaces",
  title: "OpenStreetMap parks and green space",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · ODbL",
  notes: "Parks, commons, woods, and recreation grounds.",
}

export const TFL_GEOMETRY_CREDIT: DataCredit = {
  id: "tfl-tube-geometry",
  title: "TfL Unified API stations",
  provider: "Transport for London",
  licence: "TfL Open Data",
  licenceUrl: "https://tfl.gov.uk/info-for/open-data-users/",
  datasetUrl: "https://api.tfl.gov.uk/",
  version: "Committed unique-track snapshot",
  attribution: "© Transport for London · Tube, Overground & Elizabeth stations",
  notes:
    "Station names, zones, and line colours from cached transit JSON. Line geometry from OpenStreetMap.",
}

export const OSM_TUBE_GEOMETRY_CREDIT: DataCredit = {
  id: "osm-tube-geometry",
  title: "OpenStreetMap tube route geometry",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · Tube track geometry · ODbL",
  notes:
    "London Underground route relations — dense track-following polylines.",
}

export const OSM_OVERGROUND_GEOMETRY_CREDIT: DataCredit = {
  id: "osm-overground-geometry",
  title: "OpenStreetMap Overground route geometry",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution:
    "© OpenStreetMap contributors · Overground track geometry · ODbL",
  notes: "Named Overground line route relations.",
}

export const OSM_ELIZABETH_GEOMETRY_CREDIT: DataCredit = {
  id: "osm-elizabeth-geometry",
  title: "OpenStreetMap Elizabeth line geometry",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · Elizabeth line geometry · ODbL",
  notes: "Elizabeth line route relations.",
}

export const OSM_NIGHTLIFE_CREDIT: DataCredit = {
  id: "osm-nightlife",
  title: "OpenStreetMap local noise sources",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · ODbL",
  notes:
    "Pubs, bars, clubs, music venues, and hospitals. Opening hours are partial; time-slot activity uses heuristics when hours are missing.",
}

export const OPENFREEMAP_BASEMAP_CREDIT: DataCredit = {
  id: "openfreemap-basemap",
  title: "OpenFreeMap basemap (Positron / Dark Matter)",
  provider: "OpenFreeMap · OpenMapTiles · OpenStreetMap contributors",
  licence: "BSD / ODbL (OSM data)",
  licenceUrl: "https://openfreemap.org/",
  datasetUrl: "https://tiles.openfreemap.org/",
  version: "Vector tiles",
  attribution: "© OpenStreetMap contributors · © OpenFreeMap",
  notes:
    "Vector Positron/Dark Matter via OpenFreeMap. Labels sit above noise overlays; roads stay under them.",
}

export const DATA_SOURCES_PAGE_CREDIT: DataCredit = {
  id: "data-sources-page",
  title: "Data sources & attributions",
  provider: "ssh-ldn",
  licence: "n/a",
  licenceUrl: "/data-sources",
  datasetUrl: "/data-sources",
  version: "Full declaration",
  attribution: "Data sources & full explanation",
}

/** Noise-layer datasets documented on the data-sources page. */
export const NOISE_DATA_CREDITS: DataCredit[] = [
  ...Object.values(DEFRA_NOISE_CREDITS),
  OSM_NIGHTLIFE_CREDIT,
]

/** Visual-layer datasets documented on the data-sources page. */
export const VISUAL_DATA_CREDITS: DataCredit[] = [
  OSM_TUBE_GEOMETRY_CREDIT,
  OSM_OVERGROUND_GEOMETRY_CREDIT,
  OSM_ELIZABETH_GEOMETRY_CREDIT,
  TFL_GEOMETRY_CREDIT,
  OSM_GREEN_SPACES_CREDIT,
]

/** All credits shown on the map page — deduped by id. */
export const MAP_DATA_CREDITS: DataCredit[] = [
  OPENFREEMAP_BASEMAP_CREDIT,
  ...Object.values(DEFRA_NOISE_CREDITS),
  OSM_NIGHTLIFE_CREDIT,
  OSM_RAIL_CREDIT,
  OSM_GREEN_SPACES_CREDIT,
  OSM_TUBE_GEOMETRY_CREDIT,
  OSM_OVERGROUND_GEOMETRY_CREDIT,
  OSM_ELIZABETH_GEOMETRY_CREDIT,
  TFL_GEOMETRY_CREDIT,
  DATA_SOURCES_PAGE_CREDIT,
]

export const getDefraCredit = (kind: DefraNoiseKind) =>
  DEFRA_NOISE_CREDITS[kind]

export const formatCreditLine = (credit: DataCredit) => credit.attribution

export const formatCreditsFooter = (credits: DataCredit[]) =>
  credits.map((credit) => credit.attribution).join(" · ")
