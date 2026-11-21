/**
 * Pure maths for the WebGL noise layer (components/map/noise-grid-gl-layer.ts):
 * Web Mercator <-> lng/lat, the Mercator mesh that carries exact British
 * National Grid positions, the zoom -> pyramid level rule, which grid chunks a
 * view needs, and a JS mirror of the fragment shader's cell lookup.
 *
 * Why a mesh: the colour under a screen pixel must be the band of the 10 m
 * BNG cell under that pixel's lat/lng, the same cell /api/noise/point and
 * lib/map/noise-cell-reader.ts read. Mercator -> BNG is not affine, but over a
 * small enough Mercator square it is affine to well under a millimetre, so
 * each mesh vertex carries its exact BNG position (computed on the CPU with
 * the proven wgs84ToBng) and the GPU interpolates linearly inside each
 * triangle. noise-grid-gl-math.test.mjs measures the error.
 *
 * Self-contained on purpose (no imports; the BNG transform is passed in) so
 * node --test can load it.
 */

export type ToBng = (lat: number, lng: number) => { easting: number; northing: number }

export type GridLevel = {
  cellMeters: number
  /** Chunks across and down at this level. */
  cols: number
  rows: number
  /** Cells across and down at this level. */
  levelCols: number
  levelRows: number
}

/** `<base>/grid/index.json` (see _agent/shader/BRIEF.md "Data contract"). */
export type GridIndex = {
  originE: number
  /** Northing of the grid's top edge. */
  originN: number
  cellMeters: number
  chunkCells: number
  gridCols: number
  gridRows: number
  levels: Record<string, GridLevel>
  /** layer -> level -> present chunk ids (y * cols + x). Absent ids are all band 0. */
  layers: Record<string, Record<string, number[]>>
}

export type GridGeometry = Pick<
  GridIndex,
  "originE" | "originN" | "cellMeters" | "chunkCells" | "gridCols" | "gridRows" | "levels"
>

// ---------------------------------------------------------------------------
// Web Mercator, world units [0, 1] (x east, y south), as MapLibre uses them.

export const lngLatToMercator = (lng: number, lat: number) => {
  const phi = (lat * Math.PI) / 180
  return {
    x: (lng + 180) / 360,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2,
  }
}

export const mercatorToLngLat = (x: number, y: number) => ({
  lng: x * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
})

/** BNG easting/northing -> WGS84 by Newton steps on the forward transform (exact to < 1 um). */
export const bngToLngLat = (easting: number, northing: number, toBng: ToBng) => {
  let lat = 51.5
  let lng = -0.1
  const h = 1e-6
  for (let i = 0; i < 6; i++) {
    const c = toBng(lat, lng)
    const dLat = toBng(lat + h, lng)
    const dLng = toBng(lat, lng + h)
    const a = (dLat.easting - c.easting) / h
    const b = (dLng.easting - c.easting) / h
    const cc = (dLat.northing - c.northing) / h
    const d = (dLng.northing - c.northing) / h
    const de = easting - c.easting
    const dn = northing - c.northing
    const det = a * d - b * cc
    lat += (d * de - b * dn) / det
    lng += (-cc * de + a * dn) / det
  }
  return { lng, lat }
}

// ---------------------------------------------------------------------------
// Zoom -> pyramid level.

/**
 * Metres per CSS pixel at a MapLibre zoom. MapLibre's world is 512 px wide at
 * zoom 0, so this is 156543.03 * cos(lat) / 2^(zoom + 1): MapLibre zoom 12 is
 * the old 256 px tile zoom 13 (11.9 m pixels in London).
 */
export const pixelMetersAt = (mapZoom: number, lat: number) =>
  (78271.516964 * Math.cos((lat * Math.PI) / 180)) / 2 ** mapZoom

/** Level 0 (the exact 10 m cells) whenever a CSS pixel is at most this many metres. */
export const LEVEL0_MAX_PIXEL_METERS = 12

/**
 * The rule: level 0 whenever a CSS pixel is <= 12 m (MapLibre zoom >= 12 in
 * London, i.e. the old tile z13 and up), so every cell is drawn exactly.
 * Coarser views use the max-band pyramid, level k = floor(log2(pixelMeters /
 * 10)) and at least 1, clamped to the pyramid: each level-k cell is the
 * loudest of its 2^k x 2^k 10 m cells, so thin roads survive, like the old
 * z8-11 tiles.
 */
export const gridLevelFor = (pixelMeters: number, maxLevel: number) => {
  if (!(pixelMeters > LEVEL0_MAX_PIXEL_METERS)) return 0
  const k = Math.floor(Math.log2(pixelMeters / 10))
  return Math.min(maxLevel, Math.max(1, k))
}

// ---------------------------------------------------------------------------
// Mesh.

/**
 * Mesh squares are Web Mercator tiles of this zoom (256 px tile zoom; 2^-16
 * world units, about 380 m in London) for level 0. Measured over 4,000
 * random London points (noise-grid-gl-math.test.mjs, test A): max affine
 * error 7 mm at zoom 16, 2.8 cm at 15, 11 cm at 14 (1.8 mm at 17). The bar is
 * 0.1 m; zoom 16 is 14x under it, so a pixel can only show the neighbouring
 * cell when its centre is within 7 mm of a cell edge, and a view needs a few
 * thousand squares at most.
 */
export const MESH_ZOOM_LEVEL0 = 16

/** Coarser levels have coarser cells, so the mesh may be coarser too (error grows 4x per step, cells 2x). */
export const meshZoomForLevel = (level: number) => Math.max(10, MESH_ZOOM_LEVEL0 - level)

export type MeshCorner = { col: number; row: number }

/** Exact BNG position of a mesh vertex in grid cell units (col east from originE, row south from originN). */
export const meshCorner = (
  i: number,
  j: number,
  meshZoom: number,
  grid: Pick<GridGeometry, "originE" | "originN" | "cellMeters">,
  toBng: ToBng
): MeshCorner => {
  const s = 2 ** meshZoom
  const { lng, lat } = mercatorToLngLat(i / s, j / s)
  const { easting, northing } = toBng(lat, lng)
  return {
    col: (easting - grid.originE) / grid.cellMeters,
    row: (grid.originN - northing) / grid.cellMeters,
  }
}

export type MeshRange = { meshZoom: number; i0: number; j0: number; i1: number; j1: number }

/** Mercator bounding box (x0 <= x1, y0 <= y1) of the whole grid, from its edges. */
export const gridMercatorBox = (grid: GridGeometry, toBng: ToBng) => {
  const W = grid.gridCols * grid.cellMeters
  const H = grid.gridRows * grid.cellMeters
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const steps = 16
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    for (const [e, n] of [
      [grid.originE + t * W, grid.originN],
      [grid.originE + t * W, grid.originN - H],
      [grid.originE, grid.originN - t * H],
      [grid.originE + W, grid.originN - t * H],
    ]) {
      const { lng, lat } = bngToLngLat(e, n, toBng)
      const m = lngLatToMercator(lng, lat)
      x0 = Math.min(x0, m.x)
      y0 = Math.min(y0, m.y)
      x1 = Math.max(x1, m.x)
      y1 = Math.max(y1, m.y)
    }
  }
  return { x0, y0, x1, y1 }
}

/**
 * Mesh squares covering a Mercator box, clipped to the grid's box (edges are
 * slightly curved in Mercator, so the grid box is padded by one square).
 * i1/j1 are exclusive. Null when they do not meet.
 */
export const meshRangeFor = (
  view: { x0: number; y0: number; x1: number; y1: number },
  gridBox: { x0: number; y0: number; x1: number; y1: number },
  meshZoom: number
): MeshRange | null => {
  const s = 2 ** meshZoom
  const i0 = Math.floor(Math.max(view.x0, gridBox.x0) * s) - 1
  const j0 = Math.floor(Math.max(view.y0, gridBox.y0) * s) - 1
  const i1 = Math.ceil(Math.min(view.x1, gridBox.x1) * s) + 1
  const j1 = Math.ceil(Math.min(view.y1, gridBox.y1) * s) + 1
  if (i1 <= i0 || j1 <= j0) return null
  return { meshZoom, i0, j0, i1, j1 }
}

export type MeshBuffers = {
  /** Mercator position relative to `origin`, float32 pairs (4 vertices per square). */
  positions: Float32Array
  /** BNG cell position minus the square's integer base, float32 pairs. */
  local: Float32Array
  /** Integer base cell (col, row) of the square, the same for its 4 vertices. */
  base: Int32Array
  /** Two triangles per square: (00, 10, 11) and (00, 11, 01). */
  indices: Uint32Array
  origin: { x: number; y: number }
  quads: number
}

/**
 * Per-square vertices (not shared) so each square carries its own integer
 * base: the shader then works with local offsets of a few dozen cells, where
 * float32 holds about 4 um, instead of absolute columns up to 6000, where it
 * holds only about 5 mm.
 */
export const buildMesh = (
  range: MeshRange,
  corner: (i: number, j: number) => MeshCorner,
  origin: { x: number; y: number }
): MeshBuffers => {
  const { meshZoom, i0, j0, i1, j1 } = range
  const s = 2 ** meshZoom
  const nx = i1 - i0
  const ny = j1 - j0
  const quads = nx * ny
  const positions = new Float32Array(quads * 8)
  const local = new Float32Array(quads * 8)
  const base = new Int32Array(quads * 8)
  const indices = new Uint32Array(quads * 6)
  let q = 0
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const c = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)]
      const ij = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ]
      const baseCol = Math.floor(Math.min(c[0].col, c[1].col, c[2].col, c[3].col))
      const baseRow = Math.floor(Math.min(c[0].row, c[1].row, c[2].row, c[3].row))
      for (let v = 0; v < 4; v++) {
        const o = (q * 4 + v) * 2
        positions[o] = ij[v][0] / s - origin.x
        positions[o + 1] = ij[v][1] / s - origin.y
        local[o] = c[v].col - baseCol
        local[o + 1] = c[v].row - baseRow
        base[o] = baseCol
        base[o + 1] = baseRow
      }
      const v0 = q * 4
      indices.set([v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3], q * 6)
      q++
    }
  }
  return { positions, local, base, indices, origin, quads }
}

const f = Math.fround

/**
 * JS mirror of what the GPU does for a fragment at Mercator (x, y): pick the
 * mesh triangle, interpolate the float32 local offsets with barycentric
 * weights in float32, add the integer base. `corner` must be the same
 * function the mesh was built with.
 */
export const interpolateMesh = (
  x: number,
  y: number,
  meshZoom: number,
  corner: (i: number, j: number) => MeshCorner
) => {
  const s = 2 ** meshZoom
  const fx = x * s
  const fy = y * s
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const u = fx - i
  const v = fy - j
  const c = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)]
  const baseCol = Math.floor(Math.min(c[0].col, c[1].col, c[2].col, c[3].col))
  const baseRow = Math.floor(Math.min(c[0].row, c[1].row, c[2].row, c[3].row))
  const lc = c.map((p) => f(p.col - baseCol))
  const lr = c.map((p) => f(p.row - baseRow))
  // Triangle (00, 10, 11) when u >= v, else (00, 11, 01).
  const [ids, w] =
    u >= v
      ? [[0, 1, 2], [f(1 - u), f(u - v), f(v)]]
      : [[0, 2, 3], [f(1 - v), f(u), f(v - u)]]
  const dot = (a: number[]) =>
    f(f(f(w[0] * a[ids[0]]) + f(w[1] * a[ids[1]])) + f(w[2] * a[ids[2]]))
  const localCol = dot(lc)
  const localRow = dot(lr)
  return {
    baseCol,
    baseRow,
    localCol,
    localRow,
    /** Float64 sum, for error measurement only (the shader never forms it). */
    col: baseCol + localCol,
    row: baseRow + localRow,
  }
}

/** The shader's integer cell: base + floor(local). */
export const meshCell = (m: { baseCol: number; baseRow: number; localCol: number; localRow: number }) => ({
  col: m.baseCol + Math.floor(m.localCol),
  row: m.baseRow + Math.floor(m.localRow),
})

/**
 * Level-0 cell -> chunk and texel at pyramid level k, exactly as the fragment
 * shader does it. Null outside the grid (the shader discards).
 */
export const cellLookup = (col: number, row: number, level: number, grid: GridGeometry) => {
  if (col < 0 || row < 0 || col >= grid.gridCols || row >= grid.gridRows) return null
  const C = grid.chunkCells
  const kc = col >> level
  const kr = row >> level
  const chunkX = Math.floor(kc / C)
  const chunkY = Math.floor(kr / C)
  const cols = grid.levels[String(level)].cols
  return {
    chunkX,
    chunkY,
    chunkId: chunkY * cols + chunkX,
    /** Index into the chunk's uint8[C * C], row-major, row 0 = north. */
    texel: (kr - chunkY * C) * C + (kc - chunkX * C),
  }
}

// ---------------------------------------------------------------------------
// Which chunks a view needs.

export type CellBox = { minCol: number; minRow: number; maxCol: number; maxRow: number }

/** Level-0 cell box (float) covering lng/lat points, e.g. the view's corners and edge midpoints. */
export const cellBoxFor = (
  points: ReadonlyArray<{ lng: number; lat: number }>,
  grid: Pick<GridGeometry, "originE" | "originN" | "cellMeters">,
  toBng: ToBng
): CellBox => {
  let minCol = Infinity
  let minRow = Infinity
  let maxCol = -Infinity
  let maxRow = -Infinity
  for (const p of points) {
    const { easting, northing } = toBng(p.lat, p.lng)
    const col = (easting - grid.originE) / grid.cellMeters
    const row = (grid.originN - northing) / grid.cellMeters
    minCol = Math.min(minCol, col)
    minRow = Math.min(minRow, row)
    maxCol = Math.max(maxCol, col)
    maxRow = Math.max(maxRow, row)
  }
  return { minCol, minRow, maxCol, maxRow }
}

/**
 * Chunk ids at `level` covering a level-0 cell box plus `margin` chunks,
 * nearest the box centre first. Includes ids that have no file (all band 0);
 * the caller checks the index.
 */
export const chunksForCellBox = (box: CellBox, level: number, grid: GridGeometry, margin = 1) => {
  const L = grid.levels[String(level)]
  if (!L) return []
  const span = grid.chunkCells * 2 ** level
  const cx0 = Math.max(0, Math.floor(box.minCol / span) - margin)
  const cy0 = Math.max(0, Math.floor(box.minRow / span) - margin)
  const cx1 = Math.min(L.cols - 1, Math.floor(box.maxCol / span) + margin)
  const cy1 = Math.min(L.rows - 1, Math.floor(box.maxRow / span) + margin)
  const midX = (box.minCol + box.maxCol) / 2 / span
  const midY = (box.minRow + box.maxRow) / 2 / span
  const out: { id: number; d: number }[] = []
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      out.push({ id: y * L.cols + x, d: Math.hypot(x + 0.5 - midX, y + 0.5 - midY) })
    }
  }
  return out.sort((a, b) => a.d - b.d).map((c) => c.id)
}

// ---------------------------------------------------------------------------
// Files and matrices.

export const gridChunkUrl = (base: string, layer: string, level: number, id: number, cols: number) =>
  `${base}/grid/${layer}/${level}/${id % cols}_${Math.floor(id / cols)}.gz`

/** m * translate(x, y, 0), column-major, in float64 (so the large terms cancel before float32). */
export const translateMat4 = (m: ArrayLike<number>, x: number, y: number) => {
  const out = new Float64Array(16)
  for (let k = 0; k < 16; k++) out[k] = m[k]
  for (let r = 0; r < 4; r++) out[12 + r] = m[r] * x + m[4 + r] * y + m[12 + r]
  return out
}

/**
 * Tap snap (Mangle, 21 Nov 2026). When a CSS pixel is this many metres or
 * more (MapLibre zoom ~13.3 and below in London), a device pixel can span two
 * 10 m cells, so a tap inside it can land in a cell the shader did not draw
 * there. The UI reading then uses the cell under the centre of the tapped
 * device pixel: exactly the cell the fragment shader drew. Closer in, the
 * exact tap spot is kept. /api/noise/point itself never snaps.
 */
export const SNAP_MIN_PIXEL_METERS = 5

export const shouldSnapReading = (cssPixelMeters: number) => cssPixelMeters >= SNAP_MIN_PIXEL_METERS

/** CSS position of the centre of the device pixel under a CSS point (what the shader shades). */
export const devicePixelCentre = (x: number, y: number, devicePixelRatio: number) => {
  const r = devicePixelRatio > 0 ? devicePixelRatio : 1
  return { x: (Math.floor(x * r) + 0.5) / r, y: (Math.floor(y * r) + 0.5) / r }
}
