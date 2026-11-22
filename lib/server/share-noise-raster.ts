import { gunzipSync } from "node:zlib"

import { wgs84ToBng } from "@/lib/map/noise-cell-reader"
import {
  cellLookup,
  gridChunkUrl,
  type GridIndex,
} from "@/lib/map/noise-grid-gl-math"
import { gridLayerPalette } from "@/lib/map/noise-grid-palette"
import { encodeRgbaPng } from "@/lib/server/png-encode"

/**
 * The noise layer of a share card, drawn on the server the way the map's
 * WebGL layer draws it (lib/map/noise-grid-gl-layer.ts): every output pixel
 * shows the 10 m BNG cell under its own lat/lng (never a resampled tile;
 * doc/noise-data/COMPLAINTS.md, 20 Nov), with the same palettes, the same
 * render order and default opacities, and the same fade at the grid edge.
 *
 * Weekday daytime with every source on (Mangle, t1329u): airport_Lday,
 * rail_Lday, then road + local sources (roadlocal_weekday-day).
 */
export const SHARE_NOISE_LAYERS = [
  { layer: "airport_Lday", opacity: 0.48 },
  { layer: "rail_Lday", opacity: 0.55 },
  { layer: "roadlocal_weekday-day", opacity: 0.62 },
] as const

/** Same as EDGE_FADE_CELLS in noise-grid-gl-layer.ts (that module is client-only). */
const EDGE_FADE_CELLS = 150

/** BNG is computed on this pixel mesh and interpolated between (it is smooth at this scale). */
const MESH = 8

export type ShareNoiseView = {
  /** Web Mercator world pixels (256 * 2^zoom wide) of the card's top-left corner. */
  left: number
  top: number
  worldSize: number
  width: number
  height: number
}

const worldToLngLat = (x: number, y: number, worldSize: number) => {
  const lng = (x / worldSize) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / worldSize
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lat, lng }
}

const indexCache = new Map<string, Promise<GridIndex>>()
const loadIndex = (base: string) => {
  let p = indexCache.get(base)
  if (!p) {
    p = fetch(`${base}/grid/index.json`).then((r) => {
      if (!r.ok) throw new Error(`noise grid index ${r.status}`)
      return r.json() as Promise<GridIndex>
    })
    p.catch(() => indexCache.delete(base))
    indexCache.set(base, p)
  }
  return p
}

const loadChunk = async (url: string) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  return buf[0] === 0x1f && buf[1] === 0x8b ? new Uint8Array(gunzipSync(buf)) : buf
}

/**
 * RGBA PNG of the noise for one view, or null when the bake is not published
 * or unreachable (the card then shows the basemap alone).
 */
export const renderShareNoisePng = async (
  base: string | null,
  view: ShareNoiseView
): Promise<Buffer | null> => {
  if (!base) return null
  const grid = await loadIndex(base)
  const { width, height } = view

  // Level-0 cell position (float col, row) at each mesh node.
  const mw = Math.ceil(width / MESH) + 1
  const mh = Math.ceil(height / MESH) + 1
  const meshCol = new Float64Array(mw * mh)
  const meshRow = new Float64Array(mw * mh)
  for (let j = 0; j < mh; j++) {
    for (let i = 0; i < mw; i++) {
      const { lat, lng } = worldToLngLat(view.left + i * MESH, view.top + j * MESH, view.worldSize)
      const { easting, northing } = wgs84ToBng(lat, lng)
      meshCol[j * mw + i] = (easting - grid.originE) / grid.cellMeters
      meshRow[j * mw + i] = (grid.originN - northing) / grid.cellMeters
    }
  }

  // Chunks every layer needs (level 0: one 256 x 256 chunk = 2.56 km).
  const needed = new Set<number>()
  const C = grid.chunkCells
  const cols0 = grid.levels["0"].cols
  for (let k = 0; k < meshCol.length; k++) {
    const c = Math.floor(meshCol[k] / C)
    const r = Math.floor(meshRow[k] / C)
    if (c >= 0 && r >= 0 && c < cols0 && r < grid.levels["0"].rows) needed.add(r * cols0 + c)
  }

  const layers = await Promise.all(
    SHARE_NOISE_LAYERS.map(async ({ layer, opacity }) => {
      const present = new Set(grid.layers[layer]?.["0"] ?? [])
      const chunks = new Map<number, Uint8Array | null>()
      await Promise.all(
        [...needed].map(async (id) => {
          chunks.set(id, present.has(id) ? await loadChunk(gridChunkUrl(base, layer, 0, id, cols0)) : null)
        })
      )
      return { palette: gridLayerPalette(layer), opacity, chunks }
    })
  )

  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const j = Math.floor(y / MESH)
    const fy = (y - j * MESH) / MESH
    for (let x = 0; x < width; x++) {
      const i = Math.floor(x / MESH)
      const fx = (x - i * MESH) / MESH
      // Pixel centre, bilinear between the four mesh nodes.
      const a = j * mw + i
      const lerp = (m: Float64Array) => {
        const top = m[a] + (m[a + 1] - m[a]) * (fx + 0.5 / MESH)
        const bot = m[a + mw] + (m[a + mw + 1] - m[a + mw]) * (fx + 0.5 / MESH)
        return top + (bot - top) * (fy + 0.5 / MESH)
      }
      const col = lerp(meshCol)
      const row = lerp(meshRow)
      const cell = cellLookup(Math.floor(col), Math.floor(row), 0, grid)
      if (!cell) continue
      const edgeDist = Math.min(col, row, grid.gridCols - col, grid.gridRows - row)
      const t = Math.max(0, Math.min(1, edgeDist / EDGE_FADE_CELLS))
      const edge = t * t * (3 - 2 * t) // smoothstep, as the shader

      // Premultiplied "over", bottom layer first.
      let r = 0
      let g = 0
      let b = 0
      let al = 0
      for (const L of layers) {
        const chunk = L.chunks.get(cell.chunkId)
        const band = chunk ? chunk[cell.texel] : 0
        const p = band * 4
        const ca = (L.palette[p + 3] / 255) * L.opacity * edge
        if (ca <= 0) continue
        r = L.palette[p] * ca + r * (1 - ca)
        g = L.palette[p + 1] * ca + g * (1 - ca)
        b = L.palette[p + 2] * ca + b * (1 - ca)
        al = ca + al * (1 - ca)
      }
      if (al <= 0) continue
      const o = (y * width + x) * 4
      out[o] = Math.round(r / al)
      out[o + 1] = Math.round(g / al)
      out[o + 2] = Math.round(b / al)
      out[o + 3] = Math.round(al * 255)
    }
  }
  return encodeRgbaPng(out, width, height)
}
