/**
 * Exact point values in the browser: the same 10 m DEFRA cell the point API
 * reads, from the same published archive (`<base>/points`, DESIGN section 2).
 *
 * Why not read tile pixels: a Web Mercator pixel and a British National Grid
 * cell never line up (different size, rotated about 1.5 degrees), so a pixel
 * shows the cell under its own centre, not under the point. At z13 that is a
 * different cell for about half of all points and a different band for about
 * 1 in 9 on roads; each extra zoom only halves it. Tiles are for display; point
 * values come from the cell index. Evidence: box defra/london/NOTES-day2b.md.
 *
 * Self-contained on purpose (no imports) so node --test can load it. The BNG
 * transform is a copy of lib/server/noise-grid.ts (that file uses node:fs);
 * noise-cell-reader.test.mjs asserts the two agree.
 */

type Index = {
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
  indexBin?: string
  offsets: Uint32Array
}

const toRad = (d: number) => (d * Math.PI) / 180

/** WGS84 lat/lng -> OSGB36 easting/northing (7-parameter Helmert + OS Transverse Mercator). */
export const wgs84ToBng = (latDeg: number, lngDeg: number) => {
  const a1 = 6378137
  const b1 = 6356752.314245
  const e21 = 1 - (b1 * b1) / (a1 * a1)
  const la = toRad(latDeg)
  const lo = toRad(lngDeg)
  const nu1 = a1 / Math.sqrt(1 - e21 * Math.sin(la) ** 2)
  const x1 = nu1 * Math.cos(la) * Math.cos(lo)
  const y1 = nu1 * Math.cos(la) * Math.sin(lo)
  const z1 = nu1 * (1 - e21) * Math.sin(la)
  const s = 20.4894e-6
  const rx = toRad(-0.1502 / 3600)
  const ry = toRad(-0.247 / 3600)
  const rz = toRad(-0.8421 / 3600)
  const x2 = -446.448 + (1 + s) * x1 - rz * y1 + ry * z1
  const y2 = 125.157 + rz * x1 + (1 + s) * y1 - rx * z1
  const z2 = -542.06 - ry * x1 + rx * y1 + (1 + s) * z1
  const a = 6377563.396
  const b = 6356256.909
  const e2 = 1 - (b * b) / (a * a)
  const p = Math.sqrt(x2 * x2 + y2 * y2)
  let phi = Math.atan2(z2, p * (1 - e2))
  for (let i = 0; i < 10; i++) {
    const nu2 = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2)
    phi = Math.atan2(z2 + e2 * nu2 * Math.sin(phi), p)
  }
  const lat = phi
  const lon = Math.atan2(y2, x2)
  const F0 = 0.9996012717
  const lat0 = toRad(49)
  const n = (a - b) / (a + b)
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
      ((15 / 8) * n * n + (15 / 8) * n ** 3) * Math.sin(2 * dl) * Math.cos(2 * sl) -
      (35 / 24) * n ** 3 * Math.sin(3 * dl) * Math.cos(3 * sl))
  const I = M - 100000
  const II = (nu / 2) * sin * cos
  const III = (nu / 24) * sin * cos ** 3 * (5 - tan ** 2 + 9 * eta2)
  const IIIA = (nu / 720) * sin * cos ** 5 * (61 - 58 * tan ** 2 + tan ** 4)
  const IV = nu * cos
  const V = (nu / 6) * cos ** 3 * (nu / rho - tan ** 2)
  const VI = (nu / 120) * cos ** 5 * (5 - 18 * tan ** 2 + tan ** 4 + 14 * eta2 - 58 * tan ** 2 * eta2)
  const d = lon - toRad(-2)
  return {
    easting: 400000 + IV * d + V * d ** 3 + VI * d ** 5,
    northing: I + II * d ** 2 + III * d ** 4 + IIIA * d ** 6,
  }
}

const gunzip = async (bytes: Uint8Array) => {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const MAX_CHUNKS = 64

/**
 * Reads DEFRA bands for a point from `<pointsBase>/index.json`, `index.bin`
 * and byte ranges of `data.bin` (one ~3 KB gzip chunk per 320 m square, kept
 * in memory; the CDN and browser cache the immutable, content-hashed files).
 */
export const createNoiseCellReader = (pointsBase: string, fetchImpl: typeof fetch = fetch) => {
  const root = pointsBase.replace(/\/+$/, "")
  let indexPromise: Promise<Index> | null = null
  const chunks = new Map<number, Promise<Uint8Array | null>>()

  const index = () =>
    (indexPromise ??= (async () => {
      const res = await fetchImpl(`${root}/index.json`)
      if (!res.ok) throw new Error(`noise index ${res.status}`)
      const idx = (await res.json()) as Index
      const bin = await fetchImpl(`${root}/${idx.indexBin ?? "index.bin"}`)
      if (!bin.ok) throw new Error(`noise index.bin ${bin.status}`)
      const buf = new Uint8Array(await bin.arrayBuffer())
      if (buf.byteLength !== idx.cols * idx.rows * 8) throw new Error("noise index.bin size mismatch")
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
      idx.offsets = new Uint32Array(idx.cols * idx.rows * 2)
      for (let i = 0; i < idx.offsets.length; i++) idx.offsets[i] = view.getUint32(i * 4, true)
      return idx
    })().catch((error) => {
      indexPromise = null
      throw error
    }))

  const chunk = (idx: Index, id: number) => {
    const hit = chunks.get(id)
    if (hit) return hit
    const offset = idx.offsets[id * 2]
    const length = idx.offsets[id * 2 + 1]
    const p: Promise<Uint8Array | null> =
      length === 0
        ? Promise.resolve(null)
        : fetchImpl(`${root}/data.bin`, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } })
            .then(async (res) => {
              if (!res.ok) throw new Error(`noise data ${res.status}`)
              const body = new Uint8Array(await res.arrayBuffer())
              // A server that ignores Range sends the whole file with 200.
              return gunzip(res.status === 206 ? body : body.subarray(offset, offset + length))
            })
    p.catch(() => chunks.delete(id))
    chunks.set(id, p)
    if (chunks.size > MAX_CHUNKS) chunks.delete(chunks.keys().next().value as number)
    return p
  }

  /** DEFRA band index of the cell under the point; 0 = no data; null = outside the grid or layer. */
  const bandAt = async (latitude: number, longitude: number, layer: string): Promise<number | null> => {
    const idx = await index()
    const li = idx.layers.indexOf(layer)
    if (li < 0 || !idx.layersPresent.includes(layer)) return null
    const { easting, northing } = wgs84ToBng(latitude, longitude)
    const col = Math.floor((easting - idx.originE) / idx.cellMeters)
    const row = Math.floor((idx.originN - northing) / idx.cellMeters)
    if (col < 0 || row < 0 || col >= idx.gridCols || row >= idx.gridRows) return null
    const C = idx.chunkCells
    const data = await chunk(idx, Math.floor(row / C) * idx.cols + Math.floor(col / C))
    if (!data) return 0
    return data[(li * 2 + 1) * C * C + (row % C) * C + (col % C)]
  }

  return { bandAt }
}
