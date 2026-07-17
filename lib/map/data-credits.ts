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
  notes: "Overground rail lines and stations; tube/tunnel segments excluded.",
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
  version: "Live API extract",
  attribution: "© Transport for London · Tube, Overground & Elizabeth stations",
  notes: "Station names, zones, and line colours. Line geometry from OpenStreetMap.",
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
  notes: "London Underground route relations — dense track-following polylines.",
}

export const PUBLIC_TUBE_NOISE_CREDIT: DataCredit = {
  id: "public-tube-interior-noise",
  title: "Public Tube interior / in-cab noise surveys (reference prototype)",
  provider: "TfL FOI releases, academic papers, OSM geometry",
  licence: "Mixed — FOI unknown / CC BY / ODbL — not a redistributable open dataset",
  licenceUrl: "/maps/public-noise-data",
  datasetUrl: "/maps/public-noise-data",
  version: "Compiled 2026-07 · unindexed demo",
  attribution: "Public Tube noise surveys · FOI not open data unless stated",
  notes:
    "Unindexed reference map for what section-level Tube noise mapping can look like. Passenger and cab LAeq by station section. FOI attachments without an explicit open licence are marked “Not open data / permission required”. Intended as a demo for our own open measurement collection, not as published open data.",
}

export const OSM_OVERGROUND_GEOMETRY_CREDIT: DataCredit = {
  id: "osm-overground-geometry",
  title: "OpenStreetMap Overground route geometry",
  provider: "OpenStreetMap contributors",
  licence: "ODbL 1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  datasetUrl: "https://www.openstreetmap.org/copyright",
  version: "Live Overpass extract",
  attribution: "© OpenStreetMap contributors · Overground track geometry · ODbL",
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

export const CARTO_BASEMAP_CREDIT: DataCredit = {
  id: "carto-basemap",
  title: "CARTO basemap (Positron / Dark Matter)",
  provider: "CARTO · OpenStreetMap contributors",
  licence: "BSD / ODbL (OSM data)",
  licenceUrl: "https://carto.com/legal/",
  datasetUrl: "https://basemaps.cartocdn.com/",
  version: "Raster tiles",
  attribution: "© CARTO · © OpenStreetMap contributors",
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

export const TFL_ROUNDEL_TRADEMARK_CREDIT: DataCredit = {
  id: "tfl-roundel-trademark",
  title: "TfL roundel trademark",
  provider: "Transport for London",
  licence: "Registered trademark",
  licenceUrl: "/data-sources#trademarks",
  datasetUrl: "/data-sources#trademarks",
  version: "Wikimedia Commons",
  attribution: "TfL roundel · trademark of Transport for London",
}

export const NATIONAL_RAIL_TRADEMARK_CREDIT: DataCredit = {
  id: "national-rail-trademark",
  title: "National Rail double-arrow trademark",
  provider: "Rail Delivery Group / Department for Transport",
  licence: "Registered trademark",
  licenceUrl: "/data-sources#trademarks",
  datasetUrl: "/data-sources#trademarks",
  version: "Wikimedia Commons",
  attribution:
    "National Rail double-arrow · trademark of its respective owners",
}

/** Noise-layer datasets documented on the data-sources page. */
export const NOISE_DATA_CREDITS: DataCredit[] = [
  ...Object.values(DEFRA_NOISE_CREDITS),
  OSM_NIGHTLIFE_CREDIT,
  PUBLIC_TUBE_NOISE_CREDIT,
]

/** Visual-layer datasets documented on the data-sources page. */
export const VISUAL_DATA_CREDITS: DataCredit[] = [
  OSM_RAIL_CREDIT,
  OSM_TUBE_GEOMETRY_CREDIT,
  OSM_OVERGROUND_GEOMETRY_CREDIT,
  OSM_ELIZABETH_GEOMETRY_CREDIT,
  TFL_GEOMETRY_CREDIT,
  OSM_GREEN_SPACES_CREDIT,
]

/** All credits shown on the map page — deduped by id. */
export const MAP_DATA_CREDITS: DataCredit[] = [
  CARTO_BASEMAP_CREDIT,
  ...Object.values(DEFRA_NOISE_CREDITS),
  OSM_NIGHTLIFE_CREDIT,
  PUBLIC_TUBE_NOISE_CREDIT,
  OSM_RAIL_CREDIT,
  OSM_GREEN_SPACES_CREDIT,
  OSM_TUBE_GEOMETRY_CREDIT,
  OSM_OVERGROUND_GEOMETRY_CREDIT,
  OSM_ELIZABETH_GEOMETRY_CREDIT,
  TFL_GEOMETRY_CREDIT,
  DATA_SOURCES_PAGE_CREDIT,
  TFL_ROUNDEL_TRADEMARK_CREDIT,
  NATIONAL_RAIL_TRADEMARK_CREDIT,
]

export const getDefraCredit = (kind: DefraNoiseKind) =>
  DEFRA_NOISE_CREDITS[kind]

export const formatCreditLine = (credit: DataCredit) => credit.attribution

export const formatCreditsFooter = (credits: DataCredit[]) =>
  credits.map((credit) => credit.attribution).join(" · ")
