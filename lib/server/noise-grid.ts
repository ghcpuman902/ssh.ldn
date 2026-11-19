/**
 * Local DEFRA noise grid: point lookups from our own baked copy of DEFRA's
 * Round 4 strategic noise maps (10 m cells, British National Grid), instead
 * of live DEFRA WMS GetFeatureInfo calls.
 *
 * Archive layout (built by the bake script, see _agent/defra-fetch):
 * - index.json: grid geometry and layer order (v1 also holds byte offsets and
 *   lengths; v2 keeps them in index.bin)
 * - data.bin: one gzip record per chunk (128 cells in v1, 32 in v2); each record holds,
 *   for every layer in order, a dB plane (value / 2 = dB, 0 = no data or
 *   below DEFRA's mapping threshold) then a band plane (DEFRA band index,
 *   0 = no data). Empty chunks have length 0 and are not stored.
 *
 * Self-contained on purpose (node: built-ins only) so node --test can run it.
 *
 * Design and feedback rules: doc/noise-data/DESIGN.md (principles are fixed;
 * bug reports mean an implementation detail is wrong; log in COMPLAINTS.md).
 */
import { open, readFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"

export const NOISE_SOURCES = ["road", "rail", "airport"] as const
export const NOISE_PERIODS = ["Lden", "Lday", "Leve", "Lnight"] as const
export type NoiseSource = (typeof NOISE_SOURCES)[number]
export type NoisePeriod = (typeof NOISE_PERIODS)[number]

export const NOISE_GRID_ATTRIBUTION =
  "Contains public sector information licensed under the Open Government Licence v3.0. © Department for Environment, Food & Rural Affairs copyright and/or database right 2023."
export const NOISE_GRID_SOURCE =
  "DEFRA Strategic Noise Mapping Round 4 (2021 model year), native 10 m grid"

export type NoiseGridIndex = {
  format: string
  version: number
  crs: string
  originE: number
  originN: number
  cellMeters: number
  chunkCells: number
  cols: number
  rows: number
  gridCols: number
  gridRows: number
  layers: string[]
  layersPresent: string[]
  offsets: number[]
  lengths: number[]
  /** Version 2 archives keep offsets and lengths in this binary file instead. */
  indexBin?: string
  built?: string
  attribution?: string
}

export type NoiseGridReader = {
  readIndex: () => Promise<NoiseGridIndex>
  readRange: (offset: number, length: number) => Promise<Uint8Array>
}

/** Version 2: `index.bin` is uint32 little-endian [offset, length] pairs, one per chunk. */
const decodeBinaryIndex = (idx: NoiseGridIndex, bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = Math.floor(bytes.byteLength / 8)
  if (count !== idx.cols * idx.rows) {
    throw new Error(`noise grid index.bin has ${count} chunks, expected ${idx.cols * idx.rows}`)
  }
  idx.offsets = new Array<number>(count)
  idx.lengths = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    idx.offsets[i] = view.getUint32(i * 8, true)
    idx.lengths[i] = view.getUint32(i * 8 + 4, true)
  }
  return idx
}

const isUrl = (base: string) => /^https?:\/\//i.test(base)

/** Reader for a local directory or an http(s) base URL (Vercel Blob or static). */
export const createNoiseGridReader = (base: string): NoiseGridReader => {
  if (isUrl(base)) {
    const root = base.replace(/\/+$/, "")
    return {
      readIndex: async () => {
        const res = await fetch(`${root}/index.json`)
        if (!res.ok) throw new Error(`noise grid index ${res.status}`)
        const idx = (await res.json()) as NoiseGridIndex
        if (idx.offsets || !idx.indexBin) return idx
        const bin = await fetch(`${root}/${idx.indexBin}`)
        if (!bin.ok) throw new Error(`noise grid index.bin ${bin.status}`)
        return decodeBinaryIndex(idx, new Uint8Array(await bin.arrayBuffer()))
      },
      readRange: async (offset, length) => {
        const res = await fetch(`${root}/data.bin`, {
          headers: { Range: `bytes=${offset}-${offset + length - 1}` },
        })
        if (!res.ok) throw new Error(`noise grid range ${res.status}`)
        const buf = new Uint8Array(await res.arrayBuffer())
        // A server that ignores Range returns the whole file with 200.
        return res.status === 206 ? buf : buf.subarray(offset, offset + length)
      },
    }
  }
  return {
    readIndex: async () => {
      const idx = JSON.parse(
        await readFile(path.join(base, "index.json"), "utf8")
      ) as NoiseGridIndex
      if (idx.offsets || !idx.indexBin) return idx
      return decodeBinaryIndex(idx, await readFile(path.join(base, idx.indexBin)))
    },
    readRange: async (offset, length) => {
      const fh = await open(path.join(base, "data.bin"), "r")
      try {
        const buf = new Uint8Array(length)
        await fh.read(buf, 0, length, offset)
        return buf
      } finally {
        await fh.close()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// WGS84 lat/lng -> OSGB36 British National Grid (Helmert + Transverse
// Mercator, Ordnance Survey formulae). Accurate to a few metres, which is
// below the 10 m cell size. OSTN15 would be sub-metre.

const toRad = (d: number) => (d * Math.PI) / 180

/** OSGB36 (Airy 1830) lat/lng in degrees -> easting/northing in metres. */
export const osgb36ToBng = (latDeg: number, lngDeg: number) => {
  const a = 6377563.396
  const b = 6356256.909
  const F0 = 0.9996012717
  const lat0 = toRad(49)
  const lon0 = toRad(-2)
  const N0 = -100000
  const E0 = 400000
  const e2 = 1 - (b * b) / (a * a)
  const n = (a - b) / (a + b)
  const lat = toRad(latDeg)
  const lon = toRad(lngDeg)
  const sin = Math.sin(lat)
  const cos = Math.cos(lat)
  const tan = Math.tan(lat)
  const nu = (a * F0) / Math.sqrt(1 - e2 * sin * sin)
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sin * sin, 1.5)
  const eta2 = nu / rho - 1
  const dl = lat - lat0
  const sl = lat + lat0
  const M =
    b *
    F0 *
    ((1 + n + (5 / 4) * n * n + (5 / 4) * n ** 3) * dl -
      (3 * n + 3 * n * n + (21 / 8) * n ** 3) * Math.sin(dl) * Math.cos(sl) +
      ((15 / 8) * n * n + (15 / 8) * n ** 3) *
        Math.sin(2 * dl) *
        Math.cos(2 * sl) -
      (35 / 24) * n ** 3 * Math.sin(3 * dl) * Math.cos(3 * sl))
  const I = M + N0
  const II = (nu / 2) * sin * cos
  const III = (nu / 24) * sin * cos ** 3 * (5 - tan ** 2 + 9 * eta2)
  const IIIA = (nu / 720) * sin * cos ** 5 * (61 - 58 * tan ** 2 + tan ** 4)
  const IV = nu * cos
  const V = (nu / 6) * cos ** 3 * (nu / rho - tan ** 2)
  const VI =
    (nu / 120) *
    cos ** 5 *
    (5 - 18 * tan ** 2 + tan ** 4 + 14 * eta2 - 58 * tan ** 2 * eta2)
  const d = lon - lon0
  return {
    easting: E0 + IV * d + V * d ** 3 + VI * d ** 5,
    northing: I + II * d ** 2 + III * d ** 4 + IIIA * d ** 6,
  }
}

/** WGS84 lat/lng in degrees -> OSGB36 lat/lng via a 7-parameter Helmert shift. */
export const wgs84ToOsgb36 = (latDeg: number, lngDeg: number) => {
  const a1 = 6378137
  const b1 = 6356752.314245
  const e21 = 1 - (b1 * b1) / (a1 * a1)
  const lat = toRad(latDeg)
  const lon = toRad(lngDeg)
  const nu1 = a1 / Math.sqrt(1 - e21 * Math.sin(lat) ** 2)
  const x1 = nu1 * Math.cos(lat) * Math.cos(lon)
  const y1 = nu1 * Math.cos(lat) * Math.sin(lon)
  const z1 = nu1 * (1 - e21) * Math.sin(lat)
  const tx = -446.448
  const ty = 125.157
  const tz = -542.06
  const s = 20.4894e-6
  const rx = toRad(-0.1502 / 3600)
  const ry = toRad(-0.247 / 3600)
  const rz = toRad(-0.8421 / 3600)
  const x2 = tx + (1 + s) * x1 - rz * y1 + ry * z1
  const y2 = ty + rz * x1 + (1 + s) * y1 - rx * z1
  const z2 = tz - ry * x1 + rx * y1 + (1 + s) * z1
  const a2 = 6377563.396
  const b2 = 6356256.909
  const e22 = 1 - (b2 * b2) / (a2 * a2)
  const p = Math.sqrt(x2 * x2 + y2 * y2)
  let phi = Math.atan2(z2, p * (1 - e22))
  for (let i = 0; i < 10; i++) {
    const nu2 = a2 / Math.sqrt(1 - e22 * Math.sin(phi) ** 2)
    phi = Math.atan2(z2 + e22 * nu2 * Math.sin(phi), p)
  }
  return {
    lat: (phi * 180) / Math.PI,
    lng: (Math.atan2(y2, x2) * 180) / Math.PI,
  }
}

export const wgs84ToBng = (lat: number, lng: number) => {
  const o = wgs84ToOsgb36(lat, lng)
  return osgb36ToBng(o.lat, o.lng)
}

// ---------------------------------------------------------------------------
// Lookup

export type NoiseLevel = {
  /** dB, 0.5 dB steps. null = no data or below DEFRA's mapping threshold. */
  db: number | null
  /** DEFRA band index, 0 = no data. */
  band: number
}

export type NoiseSourceLevels = Record<NoisePeriod, NoiseLevel | null>

export type NoisePointResult = {
  easting: number
  northing: number
  inCoverage: boolean
  road: NoiseSourceLevels | null
  rail: NoiseSourceLevels | null
  airport: NoiseSourceLevels | null
}

const MAX_CACHED_CHUNKS = 64

export type NoiseGrid = {
  index: () => Promise<NoiseGridIndex>
  lookupBng: (easting: number, northing: number) => Promise<NoisePointResult>
  lookup: (
    lat: number,
    lng: number
  ) => Promise<NoisePointResult & { lat: number; lng: number }>
}

export const createNoiseGrid = (reader: NoiseGridReader): NoiseGrid => {
  let indexPromise: Promise<NoiseGridIndex> | null = null
  const chunks = new Map<number, Promise<Uint8Array | null>>()

  const index = () => {
    indexPromise ??= reader.readIndex().catch((error) => {
      indexPromise = null
      throw error
    })
    return indexPromise
  }

  const chunk = (idx: NoiseGridIndex, id: number) => {
    const hit = chunks.get(id)
    if (hit) {
      chunks.delete(id)
      chunks.set(id, hit)
      return hit
    }
    const length = idx.lengths[id] ?? 0
    const p =
      length === 0
        ? Promise.resolve(null)
        : reader
            .readRange(idx.offsets[id], length)
            .then((buf) => new Uint8Array(gunzipSync(buf)))
    p.catch(() => chunks.delete(id))
    chunks.set(id, p)
    if (chunks.size > MAX_CACHED_CHUNKS) {
      const oldest = chunks.keys().next().value
      if (oldest !== undefined) chunks.delete(oldest)
    }
    return p
  }

  const lookupBng = async (
    easting: number,
    northing: number
  ): Promise<NoisePointResult> => {
    const idx = await index()
    const col = Math.floor((easting - idx.originE) / idx.cellMeters)
    const row = Math.floor((idx.originN - northing) / idx.cellMeters)
    const base = {
      easting: Math.round(easting),
      northing: Math.round(northing),
    }
    if (col < 0 || row < 0 || col >= idx.gridCols || row >= idx.gridRows) {
      return {
        ...base,
        inCoverage: false,
        road: null,
        rail: null,
        airport: null,
      }
    }
    const C = idx.chunkCells
    const id = Math.floor(row / C) * idx.cols + Math.floor(col / C)
    const data = await chunk(idx, id)
    const cell = (row % C) * C + (col % C)
    const plane = C * C
    const present = new Set(idx.layersPresent)
    const out = { ...base, inCoverage: true } as NoisePointResult
    for (const source of NOISE_SOURCES) {
      const levels = {} as NoiseSourceLevels
      for (const period of NOISE_PERIODS) {
        const name = `${source}_${period}`
        const li = idx.layers.indexOf(name)
        if (li < 0 || !present.has(name)) {
          levels[period] = null
          continue
        }
        const v = data ? data[li * 2 * plane + cell] : 0
        const band = data ? data[(li * 2 + 1) * plane + cell] : 0
        levels[period] = { db: v === 0 ? null : v / 2, band }
      }
      out[source] = levels
    }
    return out
  }

  const lookup = async (lat: number, lng: number) => {
    const { easting, northing } = wgs84ToBng(lat, lng)
    return { lat, lng, ...(await lookupBng(easting, northing)) }
  }

  return { index, lookupBng, lookup }
}

// ---------------------------------------------------------------------------
// HTTP handler (used by app/api/noise/point/route.ts; testable without a server)

export const MAX_POINTS = 50

type Point = { lat: number; lng: number }

const validPoint = (p: unknown): p is Point =>
  typeof p === "object" &&
  p !== null &&
  Number.isFinite((p as Point).lat) &&
  Number.isFinite((p as Point).lng) &&
  Math.abs((p as Point).lat) <= 90 &&
  Math.abs((p as Point).lng) <= 180

const parsePointsParam = (raw: string): Point[] | null => {
  const pts = raw
    .split(/[;|]/)
    .filter(Boolean)
    .map((pair) => {
      const [lat, lng] = pair.split(",").map((x) => Number(x.trim()))
      return { lat, lng }
    })
  return pts.every(validPoint) ? pts : null
}

const badRequest = (error: string) =>
  Response.json(
    { error },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  )

export const readPointsFromRequest = async (
  request: Request
): Promise<Point[] | Response> => {
  let points: Point[] | null = null
  if (request.method === "POST") {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest("body must be JSON: { points: [{ lat, lng }] }")
    }
    const list = (body as { points?: unknown })?.points
    if (!Array.isArray(list) || !list.every(validPoint)) {
      return badRequest("points must be an array of { lat, lng }")
    }
    points = list.map((p) => ({ lat: p.lat, lng: p.lng }))
  } else {
    const params = new URL(request.url).searchParams
    const raw = params.get("points")
    if (raw) {
      points = parsePointsParam(raw)
      if (!points) return badRequest("points must look like lat,lng;lat,lng")
    } else {
      const p = {
        lat: Number(params.get("lat")),
        lng: Number(params.get("lng")),
      }
      if (
        params.get("lat") === null ||
        params.get("lng") === null ||
        !validPoint(p)
      ) {
        return badRequest("lat and lng query parameters are required")
      }
      points = [p]
    }
  }
  if (points.length === 0) return badRequest("no points given")
  if (points.length > MAX_POINTS) {
    return badRequest(`at most ${MAX_POINTS} points per request`)
  }
  return points
}

export const handleNoisePointRequest = async (
  request: Request,
  grid: NoiseGrid
): Promise<Response> => {
  const points = await readPointsFromRequest(request)
  if (points instanceof Response) return points
  try {
    const idx = await grid.index()
    const results = await Promise.all(
      points.map((p) => grid.lookup(p.lat, p.lng))
    )
    return Response.json(
      {
        source: NOISE_GRID_SOURCE,
        attribution: idx.attribution ?? NOISE_GRID_ATTRIBUTION,
        units: "dB (A-weighted, annual average)",
        resolutionMeters: idx.cellMeters,
        precisionDb: 0.5,
        notes:
          "Road, rail and airport are separate sources. db null = no data or below DEFRA's mapping threshold. Train noise is reported separately because it can be a positive signal.",
        built: idx.built ?? null,
        results,
      },
      {
        headers: {
          "Cache-Control":
            request.method === "GET"
              ? "public, s-maxage=86400, stale-while-revalidate=604800"
              : "no-store",
        },
      }
    )
  } catch (error) {
    console.error("noise grid lookup failed", error)
    return Response.json(
      { error: "noise grid unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}

/** Where the baked grid lives. Prod location (Blob vs static) is undecided. */
export const defaultNoiseGridBase = () =>
  process.env.NOISE_GRID_BASE ??
  path.join(process.cwd(), "_agent", "defra-fetch", "baked", "points")

let sharedGrid: NoiseGrid | null = null
export const getNoiseGrid = () => {
  sharedGrid ??= createNoiseGrid(createNoiseGridReader(defaultNoiseGridBase()))
  return sharedGrid
}
