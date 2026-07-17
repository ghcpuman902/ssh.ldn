#!/usr/bin/env node
/**
 * Build public Tube interior-noise observations + segment GeoJSON.
 * Usage: node scripts/public-noise/build-public-noise-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..")
const SOURCES = join(ROOT, "data/public-noise/sources")
const OUT = join(ROOT, "public/data/public-noise")
const GEOM = join(ROOT, "data/public-noise/tube-geometry-cache.json")

mkdirSync(OUT, { recursive: true })

const normalizeName = (name) =>
  String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\bst\.?\s+/gi, "st ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")

const parseDuration = (raw) => {
  if (!raw) return null
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

const parsePassengerTable = (text, { sourceId, lineId, lineName, date, stock, rights }) => {
  const observations = []
  const warnings = []
  const lines = text.split(/\n/)

  let mode = null // standing+seated | standing-only
  let direction = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/Table 2/.test(line) && /Eastbound|Southbound/i.test(line + lines[i + 1])) {
      direction = /Eastbound/i.test(line + lines[i + 1])
        ? "eastbound"
        : /Southbound/i.test(line + lines[i + 1])
          ? "southbound"
          : "outbound"
    }
    if (/Table 3/.test(line) && /Westbound|Northbound/i.test(line + lines[i + 1])) {
      direction = /Westbound/i.test(line + lines[i + 1])
        ? "westbound"
        : /Northbound/i.test(line + lines[i + 1])
          ? "northbound"
          : "inbound"
    }

    // Central R3291: Station ... Duration ... Standing ... Seated
    const central = line.match(
      /^\s*(.+?)\s+(\d{2}:\d{2})\s+(\d{2,3})\s+(\d{2,3})\s*$/,
    )
    if (central && direction && /to/i.test(central[1])) {
      const [fromRaw, toRaw] = central[1].split(/\s+to\s+/i)
      if (fromRaw && toRaw) {
        observations.push({
          id: `${sourceId}:${direction}:${normalizeName(fromRaw)}-${normalizeName(toRaw)}:standing`,
          sourceId,
          lineId,
          lineName,
          fromStation: fromRaw.trim().replace(/\*$/, ""),
          toStation: toRaw.trim().replace(/\*$/, ""),
          direction,
          date,
          stock,
          position: "standing",
          metric: "LAeq",
          valueDb: Number(central[3]),
          unit: "dBA",
          durationSeconds: parseDuration(central[2]),
          confidenceTier: "A",
          rights,
          notes: null,
        })
        observations.push({
          id: `${sourceId}:${direction}:${normalizeName(fromRaw)}-${normalizeName(toRaw)}:seated`,
          sourceId,
          lineId,
          lineName,
          fromStation: fromRaw.trim().replace(/\*$/, ""),
          toStation: toRaw.trim().replace(/\*$/, ""),
          direction,
          date,
          stock,
          position: "seated",
          metric: "LAeq",
          valueDb: Number(central[4]),
          unit: "dBA",
          durationSeconds: parseDuration(central[2]),
          confidenceTier: "A",
          rights,
          notes: null,
        })
      }
      continue
    }

    // Bakerloo R3292: Station Duration Standing
    const bakerloo = line.match(/^\s*(.+?)\s+(\d{2}:\d{2})\s+(\d{2,3})\s*$/)
    if (
      bakerloo &&
      direction &&
      /to/i.test(bakerloo[1]) &&
      !/Standing|Duration|Station/i.test(bakerloo[1])
    ) {
      const [fromRaw, toRaw] = bakerloo[1].split(/\s+to\s+/i)
      if (fromRaw && toRaw) {
        observations.push({
          id: `${sourceId}:${direction}:${normalizeName(fromRaw)}-${normalizeName(toRaw)}:standing`,
          sourceId,
          lineId,
          lineName,
          fromStation: fromRaw.trim(),
          toStation: toRaw.trim(),
          direction,
          date,
          stock,
          position: "standing",
          metric: "LAeq",
          valueDb: Number(bakerloo[3]),
          unit: "dBA",
          durationSeconds: parseDuration(bakerloo[2]),
          confidenceTier: "A",
          rights,
          notes: null,
        })
      }
    }
  }

  return { observations, warnings }
}

const NORTHERN_CODES = {
  MOR: "Morden",
  SOU: "South Wimbledon",
  SOW: "South Wimbledon",
  COW: "Colliers Wood",
  TOBr: "Tooting Broadway",
  TOBe: "Tooting Bec",
  BAL: "Balham",
  CLS: "Clapham South",
  CLC: "Clapham Common",
  CLN: "Clapham North",
  STO: "Stockwell",
  OVA: "Oval",
  KEN: "Kennington",
  ELC: "Elephant & Castle",
  BOR: "Borough",
  LOB: "London Bridge",
  BAN: "Bank",
  MOO: "Moorgate",
  OLS: "Old Street",
  ANG: "Angel",
  KIC: "King's Cross St. Pancras",
  EUS: "Euston",
  CAT: "Camden Town",
  CHF: "Chalk Farm",
  BEP: "Belsize Park",
  HAM: "Hampstead",
  GOG: "Golders Green",
  BRC: "Brent Cross",
  HEC: "Hendon Central",
  COL: "Colindale",
  BUO: "Burnt Oak",
  EDG: "Edgware",
  HIB: "High Barnet",
  WAT: "Waterloo",
  EMB: "Embankment",
  WAS: "Warren Street",
  KET: "Kentish Town",
  TUF: "Tufnell Park",
  ARC: "Archway",
  HIG: "Highgate",
  EFN: "East Finchley",
  FIN: "Finchley Central",
  WHE: "West Finchley",
  WFN: "Woodside Park",
  TOT: "Totteridge & Whetstone",
  CHI: "Chichester Rents",
}

const mean = (vals) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null

const parseNorthernCab = (text) => {
  const observations = []
  const codePair = /(\b[A-Z]{2,4}r?\b)\s*[-–]\s*(\b[A-Z]{2,4}r?\b)/
  const rowRe =
    /^([A-Z]{2,4}r?\s*-\s*[A-Z]{2,4}r?)\s+(\d+)\s+(\d+\.\d+)\s+(\d+)\s+(\d+\.\d+)\s+(\d+)\s+(\d+\.\d+)\s*$/

  const medians = new Map() // key -> values[]

  for (const line of text.split(/\n/)) {
    const m = line.match(rowRe)
    if (!m) continue
    const pair = m[1].replace(/\s+/g, " ")
    const [fromCode, toCode] = pair.split(/\s*-\s*/)
    const fromStation = NORTHERN_CODES[fromCode]
    const toStation = NORTHERN_CODES[toCode]
    if (!fromStation || !toStation) continue
    const values = [Number(m[3]), Number(m[5]), Number(m[7])].filter((v) =>
      Number.isFinite(v),
    )
    const key = `${fromCode}|${toCode}`
    if (!medians.has(key)) medians.set(key, [])
    medians.get(key).push(...values)

    // also capture individual runs as observations averaged later
  }

  for (const [key, values] of medians) {
    const [fromCode, toCode] = key.split("|")
    const fromStation = NORTHERN_CODES[fromCode]
    const toStation = NORTHERN_CODES[toCode]
    const valueDb = Math.round(mean(values) * 10) / 10
    observations.push({
      id: `northern-r2900:median:${normalizeName(fromStation)}-${normalizeName(toStation)}:cab`,
      sourceId: "northern-r2900",
      lineId: "northern",
      lineName: "Northern",
      fromStation,
      toStation,
      direction: "either",
      date: "2020-11-25",
      stock: "1995TS",
      position: "cab",
      metric: "LAeq",
      valueDb,
      unit: "dBA",
      durationSeconds: null,
      confidenceTier: "B",
      rights: "unknown",
      notes: `Median of ${values.length} cab run samples from R2900 appendix`,
    })
  }

  return observations
}

const parseR3451 = (text) => {
  const observations = []
  // Codes like HPK to NHG from summary table — map codes to names where known
  const CODE_NAMES = {
    RUG: "Ruislip Gardens",
    SRP: "South Ruislip",
    NHT: "Northolt",
    GFD: "Greenford",
    PER: "Perivale",
    HLN: "Hanger Lane",
    NAC: "North Acton",
    EAC: "East Acton",
    WCT: "White City",
    SBC: "Shepherd's Bush",
    HPK: "Holland Park",
    NHG: "Notting Hill Gate",
    QWY: "Queensway",
    LAN: "Lancaster Gate",
    MAR: "Marble Arch",
    BOS: "Bond Street",
    OXC: "Oxford Circus",
    TCR: "Tottenham Court Road",
    HOL: "Holborn",
    CYL: "Chancery Lane",
    STP: "St. Paul's",
    BNK: "Bank",
    LST: "Liverpool Street",
    BNG: "Bethnal Green",
    MLE: "Mile End",
    SFD: "Stratford",
    LEY: "Leyton",
    LYS: "Leytonstone",
    WAN: "Wanstead",
    RED: "Redbridge",
    GHL: "Gants Hill",
    NEP: "Newbury Park",
    BAR: "Barkingside",
    BDE: "Barkingside",
    FLP: "Fairlop",
    HAI: "Hainault",
    GRH: "Grange Hill",
    CHG: "Chigwell",
    ROD: "Roding Valley",
    WFD: "Woodford",
    SNB: "Snaresbrook",
    SWF: "South Woodford",
    BHL: "Buckhurst Hill",
    LTN: "Loughton",
    DEB: "Debden",
    THB: "Theydon Bois",
    EPP: "Epping",
    EBY: "Ealing Broadway",
    WAC: "West Acton",
    BDS: "Bond Street",
  }

  const re =
    /^\s*([A-Z]{2,3})\s+to\s+([A-Z]{2,3})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/
  for (const line of text.split(/\n/)) {
    const m = line.match(re)
    if (!m) continue
    const fromStation = CODE_NAMES[m[1]]
    const toStation = CODE_NAMES[m[2]]
    if (!fromStation || !toStation) continue
    observations.push({
      id: `central-r3451:${normalizeName(fromStation)}-${normalizeName(toStation)}:test-vehicle`,
      sourceId: "central-r3451",
      lineId: "central",
      lineName: "Central",
      fromStation,
      toStation,
      direction: "either",
      date: "2025-04-16",
      stock: "test-vehicle",
      position: "test-vehicle",
      metric: "LAeq",
      valueDb: Number(m[4]),
      unit: "dBA",
      durationSeconds: Number(m[3]),
      confidenceTier: "A",
      rights: "unknown",
      notes: "Test vehicle interior survey R3451 summary table",
    })
  }
  return observations
}

const loadStratfordFoi = () => {
  const tables = JSON.parse(
    readFileSync(join(SOURCES, "stratford-leyton-foi/tables.json"), "utf8"),
  )
  const observations = []
  for (const row of tables["comparative2025-09-01"]) {
    observations.push({
      id: `stratford-leyton-foi:2025-09-01:${normalizeName(row.from)}-${normalizeName(row.to)}:cab`,
      sourceId: "stratford-leyton-foi",
      lineId: "central",
      lineName: "Central",
      fromStation: row.from,
      toStation: row.to,
      direction: "either",
      date: "2025-09-01",
      stock: "Central cab",
      position: "cab",
      metric: "LAeq",
      valueDb: row.laeq,
      unit: "dBA",
      durationSeconds: null,
      confidenceTier: "A",
      rights: "unknown",
      notes: "FOI-3133-2526 comparative cab table 1 Sep 2025",
    })
  }
  // history only for Stratford-Leyton — keep latest as primary overlay value already in comparative
  for (const row of tables.historyStratfordLeytonEastbound) {
    observations.push({
      id: `stratford-leyton-foi:history:${row.date}:stratford-leyton:cab`,
      sourceId: "stratford-leyton-foi",
      lineId: "central",
      lineName: "Central",
      fromStation: "Stratford",
      toStation: "Leyton",
      direction: "eastbound",
      date: row.date,
      stock: "Central cab",
      position: "cab",
      metric: "LAeq",
      valueDb: row.laeq,
      unit: "dBA",
      durationSeconds: null,
      confidenceTier: "A",
      rights: "unknown",
      notes: [row.note, row.grindDate ? `last grind ${row.grindDate}` : null]
        .filter(Boolean)
        .join("; "),
    })
  }
  return observations
}

// --- Geometry helpers ---
const haversine = (a, b) => {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const nearestIndex = (coords, point) => {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(coords[i], point)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return { index: best, distance: bestD }
}

const buildStationIndex = (stationsFc) => {
  const byNorm = new Map()
  for (const f of stationsFc.features) {
    const name = f.properties.name || f.properties.label
    if (!name) continue
    byNorm.set(normalizeName(name), f)
    const label = f.properties.label
    if (label) byNorm.set(normalizeName(label), f)
  }
  // aliases
  const aliases = {
    stpauls: "stpaul",
    stpaul: "stpauls",
    kingscrossstpancras: "kingscrossstpancras",
    kingscross: "kingscrossstpancras",
    shepherdsbush: "shepherdsbush",
    elephantandcastle: "elephantcastle",
    elephantcastle: "elephantandcastle",
    regentspark: "regentspark",
    "regent'spark": "regentspark",
  }
  // try soft matches for underground naming
  return byNorm
}

const STATION_ALIASES = {
  kingscrossstpancras: "kingscrossandstpancrasinternational",
  kingscross: "kingscrossandstpancrasinternational",
  kingscrossstpancrasinternational: "kingscrossandstpancrasinternational",
  elephantcastle: "elephantandcastle",
}

const findStation = (index, name) => {
  const n = normalizeName(name)
  const aliased = STATION_ALIASES[n] || n
  if (index.has(aliased)) return index.get(aliased)
  if (index.has(n)) return index.get(n)
  for (const [k, f] of index) {
    if (k.includes(aliased) || aliased.includes(k) || k.includes(n) || n.includes(k)) {
      return f
    }
  }
  return null
}

const lineCoordsById = (linesFc) => {
  const map = new Map()
  for (const f of linesFc.features) {
    const id = f.properties.lineId
    if (!id) continue
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(f.geometry.coordinates)
  }
  return map
}

const extractSegment = (coordLists, fromPt, toPt) => {
  // Prefer the polyline whose nearest points to both stations are closest in sum
  let best = null
  for (const coords of coordLists) {
    if (coords.length < 2) continue
    const a = nearestIndex(coords, fromPt)
    const b = nearestIndex(coords, toPt)
    if (a.distance > 900 || b.distance > 900) continue
    const i0 = Math.min(a.index, b.index)
    const i1 = Math.max(a.index, b.index)
    if (i1 - i0 < 1) continue
    const score = a.distance + b.distance
    const slice = coords.slice(i0, i1 + 1)
    if (!best || score < best.score) {
      best = { score, coordinates: slice, fromDist: a.distance, toDist: b.distance }
    }
  }
  if (best) return best
  // fallback straight line
  return {
    score: Infinity,
    coordinates: [fromPt, toPt],
    fromDist: 0,
    toDist: 0,
    fallback: true,
  }
}

const aggregateForSegment = (obsList, preferPosition) => {
  const preferred = obsList.filter((o) => o.position === preferPosition)
  const pool = preferred.length ? preferred : obsList
  const laeq = pool.filter((o) => o.metric === "LAeq")
  const values = laeq.map((o) => o.valueDb)
  const dates = laeq.map((o) => o.date).filter(Boolean).sort()
  return {
    valueDb: values.length ? Math.round(mean(values) * 10) / 10 : null,
    observationCount: laeq.length,
    dateMin: dates[0] ?? null,
    dateMax: dates[dates.length - 1] ?? null,
    positions: [...new Set(laeq.map((o) => o.position))],
    sourceIds: [...new Set(laeq.map((o) => o.sourceId))],
    rights: laeq.some((o) => o.rights === "unknown")
      ? "unknown"
      : laeq.some((o) => o.rights === "restricted")
        ? "restricted"
        : "open",
    confidenceTier: laeq.every((o) => o.confidenceTier === "A")
      ? "A"
      : laeq.some((o) => o.confidenceTier === "A")
        ? "A"
        : laeq.some((o) => o.confidenceTier === "B")
          ? "B"
          : "C",
  }
}

// --- Main ---
const centralText = readFileSync(join(SOURCES, "central-r3291/extracted.txt"), "utf8")
const bakerlooText = readFileSync(
  join(SOURCES, "bakerloo-r3292/extracted.txt"),
  "utf8",
)
const northernText = readFileSync(
  join(SOURCES, "northern-r2900/extracted.txt"),
  "utf8",
)
const r3451Text = readFileSync(
  join(SOURCES, "central-r3451/extracted-tables.txt"),
  "utf8",
)

const central = parsePassengerTable(centralText, {
  sourceId: "central-r3291",
  lineId: "central",
  lineName: "Central",
  date: "2023-07-08",
  stock: "92TS",
  rights: "unknown",
})
const bakerloo = parsePassengerTable(bakerlooText, {
  sourceId: "bakerloo-r3292",
  lineId: "bakerloo",
  lineName: "Bakerloo",
  date: "2023-07-16",
  stock: "72TS",
  rights: "unknown",
})

let observations = [
  ...central.observations,
  ...bakerloo.observations,
  ...parseNorthernCab(northernText),
  ...parseR3451(r3451Text),
  ...loadStratfordFoi(),
]

// Deduplicate by id (keep first)
const byId = new Map()
for (const o of observations) {
  if (!byId.has(o.id)) byId.set(o.id, o)
}
observations = [...byId.values()]

const geometry = JSON.parse(readFileSync(GEOM, "utf8"))
const stationIndex = buildStationIndex(geometry.stations)
const linesById = lineCoordsById(geometry.lines)

const unmatched = []
const segmentMap = new Map()

for (const obs of observations) {
  const fromF = findStation(stationIndex, obs.fromStation)
  const toF = findStation(stationIndex, obs.toStation)
  if (!fromF || !toF) {
    unmatched.push({
      id: obs.id,
      from: obs.fromStation,
      to: obs.toStation,
      reason: !fromF ? "from_unmatched" : "to_unmatched",
    })
    obs.segmentId = null
    obs.matchStatus = "unmatched"
    continue
  }

  const fromPt = fromF.geometry.coordinates
  const toPt = toF.geometry.coordinates
  const keyUndirected = [
    obs.lineId,
    [normalizeName(fromF.properties.name), normalizeName(toF.properties.name)]
      .sort()
      .join("__"),
  ].join(":")

  obs.fromStationId = fromF.properties.featureId
  obs.toStationId = toF.properties.featureId
  obs.segmentId = keyUndirected
  obs.matchStatus = "matched"

  if (!segmentMap.has(keyUndirected)) {
    const coordsLists = linesById.get(obs.lineId) || []
    const extracted = extractSegment(coordsLists, fromPt, toPt)
    segmentMap.set(keyUndirected, {
      id: keyUndirected,
      lineId: obs.lineId,
      lineName: obs.lineName,
      fromStation: fromF.properties.name,
      toStation: toF.properties.name,
      fromStationId: fromF.properties.featureId,
      toStationId: toF.properties.featureId,
      coordinates: extracted.coordinates,
      geometryFallback: Boolean(extracted.fallback),
      observations: [],
    })
  }
  segmentMap.get(keyUndirected).observations.push(obs)
}

const preferPosition = "standing"
const features = []
for (const seg of segmentMap.values()) {
  const aggPassenger = aggregateForSegment(
    seg.observations.filter((o) =>
      ["standing", "seated", "passenger", "passenger-smartphone"].includes(
        o.position,
      ),
    ),
    preferPosition,
  )
  const aggCab = aggregateForSegment(
    seg.observations.filter((o) =>
      ["cab", "test-vehicle"].includes(o.position),
    ),
    "cab",
  )
  const primary =
    aggPassenger.valueDb !== null ? aggPassenger : aggCab

  features.push({
    type: "Feature",
    id: seg.id,
    properties: {
      segmentId: seg.id,
      lineId: seg.lineId,
      lineName: seg.lineName,
      fromStation: seg.fromStation,
      toStation: seg.toStation,
      fromStationId: seg.fromStationId,
      toStationId: seg.toStationId,
      valueDb: primary.valueDb,
      passengerValueDb: aggPassenger.valueDb,
      cabValueDb: aggCab.valueDb,
      metric: "LAeq",
      unit: "dBA",
      observationCount: primary.observationCount,
      dateMin: primary.dateMin,
      dateMax: primary.dateMax,
      positions: primary.positions,
      sourceIds: primary.sourceIds,
      rights: primary.rights,
      confidenceTier: primary.confidenceTier,
      geometryFallback: seg.geometryFallback,
      hasPassenger: aggPassenger.valueDb !== null,
      hasCab: aggCab.valueDb !== null,
    },
    geometry: {
      type: "LineString",
      coordinates: seg.coordinates,
    },
  })
}

const coveredLineIds = [...new Set(features.map((f) => f.properties.lineId))]

// Full OSM track geometry for lines with measurements — rendered grey under coloured sections
const networkFeatures = geometry.lines.features
  .filter((f) => coveredLineIds.includes(f.properties.lineId))
  .map((f) => ({
    type: "Feature",
    id: f.properties.featureId,
    properties: {
      featureId: f.properties.featureId,
      lineId: f.properties.lineId,
      lineName: f.properties.lineName,
      hasData: false,
      valueDb: null,
    },
    geometry: f.geometry,
  }))

const stationsOut = {
  type: "FeatureCollection",
  features: geometry.stations.features
    .filter((f) => {
      const ids = f.properties.lineIds || []
      return ids.some((id) => coveredLineIds.includes(id))
    })
    .map((f) => ({
      type: "Feature",
      id: f.properties.featureId,
      properties: {
        featureId: f.properties.featureId,
        name: f.properties.name,
        label: f.properties.label,
        lineIds: f.properties.lineIds,
        zone: f.properties.zone,
      },
      geometry: f.geometry,
    })),
  meta: {
    source: "tfl+osm-cache",
    coveredLines: coveredLineIds,
    featureCount: null,
    retrievedAt: new Date().toISOString(),
  },
}
stationsOut.meta.featureCount = stationsOut.features.length

const networkFc = {
  type: "FeatureCollection",
  features: networkFeatures,
  meta: {
    source: "osm-tube-geometry",
    coveredLines: coveredLineIds,
    featureCount: networkFeatures.length,
    retrievedAt: new Date().toISOString(),
    note: "Full line tracks for lines with public-noise observations; grey = no measured section",
  },
}

const segmentsFc = {
  type: "FeatureCollection",
  features,
  meta: {
    source: "ssh-ldn-public-noise-build",
    featureCount: features.length,
    retrievedAt: new Date().toISOString(),
    colourScheme:
      "AQ-style green → yellow → orange → red → purple (noisy); grey = no data",
    defaultMetric: "LAeq dBA",
    preferPosition,
    coveredLines: coveredLineIds,
  },
}

const sourceManifest = JSON.parse(
  readFileSync(join(SOURCES, "manifest.json"), "utf8"),
)

writeFileSync(
  join(OUT, "observations.json"),
  JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      count: observations.length,
      unmatchedCount: unmatched.length,
      observations,
      unmatched,
      warnings: [...central.warnings, ...bakerloo.warnings],
    },
    null,
    2,
  ),
)
writeFileSync(join(OUT, "segments.geojson"), JSON.stringify(segmentsFc))
writeFileSync(join(OUT, "network.geojson"), JSON.stringify(networkFc))
writeFileSync(join(OUT, "stations.geojson"), JSON.stringify(stationsOut))
writeFileSync(
  join(OUT, "sources.json"),
  JSON.stringify(
    {
      ...sourceManifest,
      publishedAt: new Date().toISOString(),
      summary: {
        observationCount: observations.length,
        segmentCount: features.length,
        networkFeatureCount: networkFeatures.length,
        unmatchedCount: unmatched.length,
        lines: coveredLineIds,
      },
    },
    null,
    2,
  ),
)

console.log(
  JSON.stringify(
    {
      observations: observations.length,
      segments: features.length,
      network: networkFeatures.length,
      stations: stationsOut.features.length,
      unmatched: unmatched.length,
      passengerSegments: features.filter((f) => f.properties.hasPassenger).length,
      cabSegments: features.filter((f) => f.properties.hasCab).length,
      sampleUnmatched: unmatched.slice(0, 12),
    },
    null,
    2,
  ),
)
