import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from "maplibre-gl"

import { wgs84ToBng } from "@/lib/map/noise-cell-reader"
import {
  buildMesh,
  cellBoxFor,
  chunksForCellBox,
  gridChunkUrl,
  gridLevelFor,
  gridMercatorBox,
  lngLatToMercator,
  meshCorner,
  meshRangeFor,
  meshZoomForLevel,
  pixelMetersAt,
  translateMat4,
  type GridIndex,
  type MeshCorner,
  type MeshRange,
} from "@/lib/map/noise-grid-gl-math"

/**
 * Draws one DEFRA grid layer (road, rail or airport; any period) straight
 * from the raw 10 m EPSG:27700 band grid (`<base>/grid`), so the colour under
 * a screen pixel is the band of the 10 m cell under that pixel's lat/lng: the
 * cell /api/noise/point and noise-cell-reader.ts read. No Mercator tiles.
 *
 * - A Mercator mesh carries each vertex's exact BNG position (CPU, wgs84ToBng);
 *   the GPU interpolates it per triangle (affine error <= 7 mm, see
 *   noise-grid-gl-math.ts) and the fragment shader looks the cell up:
 *   cell -> pyramid level -> chunk -> atlas slot (indirection texture) ->
 *   band (R8UI atlas) -> colour (256 x 1 palette).
 * - Only chunks in view (plus one chunk of margin) load, nearest first, at
 *   most 6 at a time; a pan aborts fetches that left the view. Decompression
 *   is a DecompressionStream; at most 8 chunk uploads per frame.
 * - A chunk that is not loaded yet falls back to any loaded level (finer
 *   first, then coarser), so panning and zooming never blank loaded areas;
 *   the coarsest level is always requested as a floor.
 * - Switching period or day/night swaps the chunk set and palette; the GL
 *   program and textures stay.
 */

const CHUNK = 256
const SLOTS_PER_ROW = 8
const MAX_IN_FLIGHT = 6
const MAX_UPLOADS_PER_FRAME = 8
/** Index texture value for "this chunk has no file: every cell is band 0". */
const EMPTY = 0xffff
/**
 * Fade width at the edge of the baked grid, in 10 m cells (1.5 km). Past the
 * grid there is no DEFRA data, so the layer (wash included) fades to nothing
 * instead of ending in a hard rectangle. The grid reaches 1.9 km or more past
 * the map's maxBounds, so inside the viewable area nothing is faded.
 */
export const EDGE_FADE_CELLS = 150

const indexPromises = new globalThis.Map<string, Promise<GridIndex>>()

let visibleFetches = 0
/** On-screen chunk fetches in flight across all grid layers; idle prefetch waits for 0. */
export const gridFetchesInFlight = () => visibleFetches

/** `<base>/grid/index.json`, once per base. */
export const loadGridIndex = (base: string) => {
  let p = indexPromises.get(base)
  if (!p) {
    p = fetch(`${base}/grid/index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`noise grid index ${res.status}`)
        return res.json() as Promise<GridIndex>
      })
      .catch((error) => {
        indexPromises.delete(base)
        throw error
      })
    indexPromises.set(base, p)
  }
  return p
}

const gunzip = async (bytes: ArrayBuffer) => {
  // A host that adds Content-Encoding: gzip has already had the browser
  // decompress it; a raw chunk is exactly 256 x 256 bytes with no gzip magic.
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  if (bytes.byteLength === CHUNK * CHUNK && !(head[0] === 0x1f && head[1] === 0x8b)) {
    return new Uint8Array(bytes)
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const VERTEX = `#version 300 es
in vec2 a_pos;
in vec2 a_local;
in ivec2 a_base;
uniform mat4 u_matrix;
out vec2 v_local;
flat out ivec2 v_base;
void main() {
  v_local = a_local;
  v_base = a_base;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
in vec2 v_local;
flat in ivec2 v_base;
uniform usampler2D u_atlas;
uniform usampler2D u_index;
uniform sampler2D u_palette;
uniform ivec2 u_grid;
uniform int u_level;
uniform int u_maxLevel;
uniform int u_rowOffset[8];
uniform float u_opacity;
uniform float u_edgeFade;
out vec4 fragColor;
void main() {
  // The 10 m cell under this fragment: integer base + floor(local offset).
  ivec2 cell = v_base + ivec2(floor(v_local));
  if (cell.x < 0 || cell.y < 0 || cell.x >= u_grid.x || cell.y >= u_grid.y) discard;
  // Wanted level first, then finer loaded levels, then coarser ones.
  for (int i = 0; i <= u_maxLevel; i++) {
    int level = i <= u_level ? u_level - i : i;
    ivec2 lc = cell >> level;
    ivec2 chunk = lc >> 8;
    uint entry = texelFetch(u_index, ivec2(chunk.x, u_rowOffset[level] + chunk.y), 0).r;
    if (entry == 0u) continue;
    uint band = 0u;
    if (entry != 65535u) {
      int slot = int(entry) - 1;
      ivec2 at = ivec2(slot % ${SLOTS_PER_ROW}, slot / ${SLOTS_PER_ROW}) * ${CHUNK} + (lc & ${CHUNK - 1});
      band = texelFetch(u_atlas, at, 0).r;
    }
    vec4 c = texelFetch(u_palette, ivec2(int(band), 0), 0);
    // Distance to the nearest grid edge, in cells: no data beyond it, so fade.
    vec2 pos = vec2(v_base) + v_local;
    vec2 far = vec2(u_grid) - pos;
    float edge = smoothstep(0.0, u_edgeFade, min(min(pos.x, pos.y), min(far.x, far.y)));
    fragColor = vec4(c.rgb * c.a, c.a) * (u_opacity * edge);
    return;
  }
  discard;
}`

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`noise grid shader: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

/** How many 64 KB chunks one layer may keep on the GPU: the view at level 0 plus margin, 32-128. */
export const atlasCapacity = (cssWidth: number, cssHeight: number) => {
  const span = CHUNK * 10 // metres per level-0 chunk
  const px = 12 // metres per CSS pixel at the finest level-0 zoom
  const need = (Math.ceil((cssWidth * px) / span) + 3) * (Math.ceil((cssHeight * px) / span) + 3)
  return Math.min(128, Math.max(32, Math.ceil(need / SLOTS_PER_ROW) * SLOTS_PER_ROW))
}

type Gl = {
  gl: WebGL2RenderingContext
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  posBuffer: WebGLBuffer
  localBuffer: WebGLBuffer
  baseBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  atlas: WebGLTexture
  indexTex: WebGLTexture
  palette: WebGLTexture
  uniforms: Record<string, WebGLUniformLocation | null>
  capacity: number
}

export type NoiseGridLayerState = {
  /** Grid layer name, e.g. "road_Lden". */
  layer: string
  /** 256 x RGBA, straight alpha. */
  palette: Uint8Array
  /** Multiplied into every colour, like raster-opacity. */
  opacity: number
  visible: boolean
}

export class NoiseGridGlLayer implements CustomLayerInterface {
  readonly id: string
  readonly type = "custom" as const
  readonly renderingMode = "2d" as const

  private base: string
  private state: NoiseGridLayerState
  private map: MapLibreMap | null = null
  private g: Gl | null = null
  private grid: GridIndex | null = null
  private gridBox: { x0: number; y0: number; x1: number; y1: number } | null = null
  private present = new globalThis.Map<string, Set<number>>()
  private rowOffset: number[] = []
  private indexData: Uint16Array = new Uint16Array(0)
  private indexDirty = true
  private indexAllocated = false
  private paletteDirty = true

  /** `${layer}/${level}/${id}` -> atlas slot */
  private resident = new globalThis.Map<string, number>()
  private lastUsed = new globalThis.Map<string, number>()
  private freeSlots: number[] = []
  private inFlight = new globalThis.Map<string, AbortController>()
  private ready = new globalThis.Map<string, Uint8Array>()
  private wanted: string[] = []
  private failedKeys = new Set<string>()
  private frame = 0

  private corners = new globalThis.Map<number, MeshCorner>()
  private cornerZoom = -1
  private mesh: { range: MeshRange; origin: { x: number; y: number }; count: number } | null = null

  private failed = false

  constructor(id: string, base: string, state: NoiseGridLayerState) {
    this.id = id
    this.base = base
    this.state = state
  }

  /** Swap layer, palette, opacity or visibility; the GL program and textures stay. */
  setState(next: NoiseGridLayerState) {
    const prev = this.state
    this.state = next
    if (next.layer !== prev.layer) {
      for (const c of this.inFlight.values()) c.abort()
      this.inFlight.clear()
      this.ready.clear()
      this.failedKeys.clear()
      this.indexDirty = true
    }
    if (next.palette !== prev.palette) this.paletteDirty = true
    if (!next.visible) {
      for (const c of this.inFlight.values()) c.abort()
      this.inFlight.clear()
    }
    this.map?.triggerRepaint()
  }

  /** Chunks the current view still waits for (0 = everything in view is drawn). */
  get pending() {
    if (!this.grid || !this.g) return Infinity
    return this.wanted.filter((key) => !this.resident.has(key) && !this.failedKeys.has(key)).length
  }

  /**
   * GL objects are created on the first render, not here: MapLibre caches GL
   * state and only resets that cache after a custom layer's render.
   */
  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    if (typeof WebGL2RenderingContext === "undefined" || !(gl instanceof WebGL2RenderingContext)) {
      this.failed = true
      console.warn("noise grid layer needs WebGL2")
      return
    }
    void loadGridIndex(this.base)
      .then((grid) => {
        if (grid.chunkCells !== CHUNK) throw new Error(`noise grid chunkCells ${grid.chunkCells}`)
        this.gridBox = gridMercatorBox(grid, wgs84ToBng)
        const levels = Object.keys(grid.levels).map(Number).sort((a, b) => a - b)
        let off = 0
        this.rowOffset = []
        for (const k of levels) {
          this.rowOffset[k] = off
          off += grid.levels[String(k)].rows
        }
        this.indexData = new Uint16Array(grid.levels["0"].cols * off)
        this.indexAllocated = false
        this.indexDirty = true
        this.grid = grid
        this.map?.triggerRepaint()
      })
      .catch((error) => {
        this.failed = true
        console.error(error)
      })
  }

  onRemove(_map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    for (const c of this.inFlight.values()) c.abort()
    this.inFlight.clear()
    const g = this.g
    if (g && g.gl === gl) {
      gl.deleteProgram(g.program)
      g.gl.deleteVertexArray(g.vao)
      for (const b of [g.posBuffer, g.localBuffer, g.baseBuffer, g.indexBuffer]) gl.deleteBuffer(b)
      for (const t of [g.atlas, g.indexTex, g.palette]) gl.deleteTexture(t)
    }
    this.g = null
    this.map = null
    this.resident.clear()
    this.lastUsed.clear()
    this.ready.clear()
    this.wanted = []
    this.mesh = null
    this.indexAllocated = false
    this.indexDirty = true
    this.paletteDirty = true
  }

  private createGl(gl: WebGL2RenderingContext, map: MapLibreMap): Gl {
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`noise grid program: ${gl.getProgramInfoLog(program)}`)
    }
    const uniforms: Gl["uniforms"] = {}
    for (const name of ["u_matrix", "u_atlas", "u_index", "u_palette", "u_grid", "u_level", "u_maxLevel", "u_rowOffset", "u_opacity", "u_edgeFade"]) {
      uniforms[name] = gl.getUniformLocation(program, name)
    }

    const vao = gl.createVertexArray()!
    const posBuffer = gl.createBuffer()!
    const localBuffer = gl.createBuffer()!
    const baseBuffer = gl.createBuffer()!
    const indexBuffer = gl.createBuffer()!
    gl.bindVertexArray(vao)
    const attrib = (name: string, buffer: WebGLBuffer, int: boolean) => {
      const loc = gl.getAttribLocation(program, name)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(loc)
      if (int) gl.vertexAttribIPointer(loc, 2, gl.INT, 0, 0)
      else gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    }
    attrib("a_pos", posBuffer, false)
    attrib("a_local", localBuffer, false)
    attrib("a_base", baseBuffer, true)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bindVertexArray(null)

    const canvas = map.getCanvas()
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    const capacity = Math.min(
      atlasCapacity(canvas.clientWidth || 1024, canvas.clientHeight || 768),
      Math.floor(maxSize / CHUNK) * SLOTS_PER_ROW
    )
    const intTexture = (w: number, h: number, format: number) => {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      if (w > 0) gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h)
      return t
    }
    const atlas = intTexture(SLOTS_PER_ROW * CHUNK, (capacity / SLOTS_PER_ROW) * CHUNK, gl.R8UI)
    const indexTex = intTexture(0, 0, gl.R16UI) // sized once the grid index arrives
    const palette = intTexture(256, 1, gl.RGBA8)
    this.freeSlots = Array.from({ length: capacity }, (_, i) => capacity - 1 - i)
    return { gl, program, vao, posBuffer, localBuffer, baseBuffer, indexBuffer, atlas, indexTex, palette, uniforms, capacity }
  }

  private isPresent(key: string) {
    const [layer, level, id] = key.split("/")
    return this.presentSet(layer, Number(level)).has(Number(id))
  }

  private presentSet(layer: string, level: number) {
    const k = `${layer}/${level}`
    let s = this.present.get(k)
    if (!s) {
      s = new Set(this.grid?.layers[layer]?.[String(level)] ?? [])
      this.present.set(k, s)
    }
    return s
  }

  private corner = (i: number, j: number) => {
    const key = i * 4194304 + j
    let c = this.corners.get(key)
    if (!c) {
      c = meshCorner(i, j, this.cornerZoom, this.grid!, wgs84ToBng)
      this.corners.set(key, c)
    }
    return c
  }

  /** Lng/lat of the canvas corners and edge midpoints. */
  private viewPoints(map: MapLibreMap) {
    const canvas = map.getCanvas()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const pts: { lng: number; lat: number }[] = []
    for (const [x, y] of [[0, 0], [w / 2, 0], [w, 0], [w, h / 2], [w, h], [w / 2, h], [0, h], [0, h / 2]]) {
      const p = map.unproject([x, y])
      pts.push({ lng: p.lng, lat: p.lat })
    }
    return pts
  }

  /** Decide what the view needs; start and abort fetches. */
  private plan(map: MapLibreMap, level: number, points: { lng: number; lat: number }[]) {
    const grid = this.grid!
    const layer = this.state.layer
    const maxLevel = Math.max(...Object.keys(grid.levels).map(Number))
    const box = cellBoxFor(points, grid, wgs84ToBng)
    const capacity = this.g!.capacity
    const keys = chunksForCellBox(box, level, grid, 1).map((id) => `${layer}/${level}/${id}`)
    // Always keep the coarsest level as a floor under everything else.
    if (level !== maxLevel) {
      for (const id of chunksForCellBox(box, maxLevel, grid, 0)) keys.push(`${layer}/${maxLevel}/${id}`)
    }
    const wanted = keys.filter((k) => this.isPresent(k)).slice(0, capacity)
    this.wanted = wanted
    const wantedSet = new Set(wanted)
    for (const [key, controller] of this.inFlight) {
      if (!wantedSet.has(key)) {
        controller.abort()
        this.inFlight.delete(key)
      }
    }
    for (const key of this.ready.keys()) if (!wantedSet.has(key)) this.ready.delete(key)
    for (const key of wanted) {
      if (this.inFlight.size >= MAX_IN_FLIGHT) break
      if (this.resident.has(key) || this.inFlight.has(key) || this.ready.has(key) || this.failedKeys.has(key)) continue
      this.fetchChunk(map, key)
    }
  }

  private fetchChunk(map: MapLibreMap, key: string) {
    const [layer, level, id] = key.split("/")
    const cols = this.grid!.levels[level].cols
    const controller = new AbortController()
    this.inFlight.set(key, controller)
    visibleFetches++
    fetch(gridChunkUrl(this.base, layer, Number(level), Number(id), cols), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`noise grid chunk ${res.status}`)
        return res.arrayBuffer()
      })
      .then(gunzip)
      .then((data) => {
        if (this.inFlight.get(key) !== controller) return // stale: aborted or layer switched
        this.inFlight.delete(key)
        if (data.length !== CHUNK * CHUNK) throw new Error(`noise grid chunk ${key} size ${data.length}`)
        this.ready.set(key, data)
        map.triggerRepaint()
      })
      .catch((error: unknown) => {
        if (this.inFlight.get(key) === controller) this.inFlight.delete(key)
        if ((error as Error)?.name === "AbortError") return
        // Don't retry every frame; a layer switch or remount clears this.
        this.failedKeys.add(key)
        console.warn(error)
      })
      .finally(() => {
        visibleFetches--
      })
  }

  private allocSlot(protect: Set<string>) {
    const free = this.freeSlots.pop()
    if (free !== undefined) return free
    let oldestKey: string | null = null
    let oldest = Infinity
    for (const [key, used] of this.lastUsed) {
      if (protect.has(key)) continue
      if (used < oldest) {
        oldest = used
        oldestKey = key
      }
    }
    if (oldestKey === null) return null
    const slot = this.resident.get(oldestKey)!
    this.resident.delete(oldestKey)
    this.lastUsed.delete(oldestKey)
    this.indexDirty = true
    return slot
  }

  private upload(g: Gl) {
    const { gl } = g
    if (this.ready.size === 0) return
    const protect = new Set(this.wanted)
    let n = 0
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, g.atlas)
    for (const [key, data] of this.ready) {
      if (n >= MAX_UPLOADS_PER_FRAME) break
      const slot = this.allocSlot(protect)
      if (slot === null) break
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0,
        (slot % SLOTS_PER_ROW) * CHUNK, Math.floor(slot / SLOTS_PER_ROW) * CHUNK,
        CHUNK, CHUNK, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data
      )
      this.ready.delete(key)
      this.resident.set(key, slot)
      this.lastUsed.set(key, this.frame)
      this.indexDirty = true
      n++
    }
    if (this.ready.size > 0) this.map?.triggerRepaint()
  }

  private updateIndex(g: Gl) {
    if (!this.indexDirty || !this.grid) return
    const grid = this.grid
    const layer = this.state.layer
    const width = grid.levels["0"].cols
    const data = this.indexData
    data.fill(0)
    for (const [k, L] of Object.entries(grid.levels)) {
      const level = Number(k)
      const present = this.presentSet(layer, level)
      for (let y = 0; y < L.rows; y++) {
        for (let x = 0; x < L.cols; x++) {
          const id = y * L.cols + x
          const slot = present.has(id) ? this.resident.get(`${layer}/${level}/${id}`) : undefined
          data[(this.rowOffset[level] + y) * width + x] = !present.has(id) ? EMPTY : slot === undefined ? 0 : slot + 1
        }
      }
    }
    const { gl } = g
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, g.indexTex)
    if (!this.indexAllocated) {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, width, data.length / width)
      this.indexAllocated = true
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, data.length / width, gl.RED_INTEGER, gl.UNSIGNED_SHORT, data)
    this.indexDirty = false
  }

  private updatePalette(g: Gl) {
    if (!this.paletteDirty) return
    const { gl } = g
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, g.palette)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.state.palette)
    this.paletteDirty = false
  }

  /**
   * Mesh over the view plus half a view of slack on each side, rebuilt only
   * when the view leaves it, the level changes, or it is far too big.
   */
  private updateMesh(g: Gl, level: number, points: { lng: number; lat: number }[]) {
    const meshZoom = meshZoomForLevel(level)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const p of points) {
      const m = lngLatToMercator(p.lng, p.lat)
      x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x); y1 = Math.max(y1, m.y)
    }
    const s = 2 ** meshZoom
    const cur = this.mesh?.range
    const inside =
      cur &&
      cur.meshZoom === meshZoom &&
      x0 * s >= cur.i0 && y0 * s >= cur.j0 && x1 * s <= cur.i1 && y1 * s <= cur.j1 &&
      (cur.i1 - cur.i0) * (cur.j1 - cur.j0) <= 16 * Math.max(1, (x1 - x0) * s * (y1 - y0) * s)
    if (inside) return
    const dx = (x1 - x0) / 2
    const dy = (y1 - y0) / 2
    const range = meshRangeFor({ x0: x0 - dx, y0: y0 - dy, x1: x1 + dx, y1: y1 + dy }, this.gridBox!, meshZoom)
    if (!range) {
      this.mesh = null
      return
    }
    if (this.cornerZoom !== meshZoom || this.corners.size > 200_000) {
      this.corners.clear()
      this.cornerZoom = meshZoom
    }
    const origin = { x: (range.i0 + range.i1) / 2 / s, y: (range.j0 + range.j1) / 2 / s }
    const mesh = buildMesh(range, this.corner, origin)
    const { gl } = g
    gl.bindVertexArray(g.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, g.posBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, g.localBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.local, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, g.baseBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.base, gl.DYNAMIC_DRAW)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW)
    gl.bindVertexArray(null)
    this.mesh = { range, origin, count: mesh.indices.length }
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const map = this.map
    if (this.failed || !map || !this.grid || !this.gridBox) return
    if (!this.state.visible || this.state.opacity <= 0) return
    if (!this.g) {
      try {
        this.g = this.createGl(gl as WebGL2RenderingContext, map)
      } catch (error) {
        this.failed = true
        console.error(error)
        return
      }
    }
    const g = this.g
    if (g.gl !== gl) return
    this.frame++

    const grid = this.grid
    const maxLevel = Math.max(...Object.keys(grid.levels).map(Number))
    const centre = map.getCenter()
    const level = gridLevelFor(pixelMetersAt(map.getZoom(), centre.lat), maxLevel)
    const points = this.viewPoints(map)

    this.plan(map, level, points)
    for (const key of this.wanted) if (this.resident.has(key)) this.lastUsed.set(key, this.frame)
    this.upload(g)
    this.updateIndex(g)
    this.updatePalette(g)
    this.updateMesh(g, level, points)
    if (!this.mesh) return

    const matrix = Float32Array.from(
      translateMat4(args.defaultProjectionData.mainMatrix, this.mesh.origin.x, this.mesh.origin.y)
    )
    gl.useProgram(g.program)
    gl.disable(gl.CULL_FACE)
    const u = g.uniforms
    gl.uniformMatrix4fv(u.u_matrix, false, matrix)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, g.atlas)
    gl.uniform1i(u.u_atlas, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, g.indexTex)
    gl.uniform1i(u.u_index, 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, g.palette)
    gl.uniform1i(u.u_palette, 2)
    gl.uniform2i(u.u_grid, grid.gridCols, grid.gridRows)
    gl.uniform1i(u.u_level, level)
    gl.uniform1i(u.u_maxLevel, maxLevel)
    const offsets = new Int32Array(8)
    this.rowOffset.forEach((o, k) => (offsets[k] = o))
    gl.uniform1iv(u.u_rowOffset, offsets)
    gl.uniform1f(u.u_opacity, this.state.opacity)
    gl.uniform1f(u.u_edgeFade, EDGE_FADE_CELLS)
    g.gl.bindVertexArray(g.vao)
    gl.drawElements(gl.TRIANGLES, this.mesh.count, gl.UNSIGNED_INT, 0)
    g.gl.bindVertexArray(null)
  }
}
