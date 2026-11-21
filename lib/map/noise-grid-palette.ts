import { defraGlowRgba } from "@/lib/map/night-glow-tiles"
import {
  roadBandOf,
  roadLayerForSlot,
  type LocalNoiseSlot,
} from "@/lib/map/noise-tiles"
import bakePalette from "@/scripts/noise-bake/palette_derived.json"

type DerivedPalette = Record<string, Record<string, { rgba: number[] }>>

const derived = bakePalette as DerivedPalette

/**
 * Band -> RGBA (straight alpha, 0-255) for one grid layer, 256 entries, as a
 * 256 x 1 texture. Same colours as the old baked tiles (scripts/noise-bake/
 * bake_tiles.py `lut`): DEFRA's own colours from palette_derived.json;
 * airport_Lden has no band 1 sample and follows airport_Lday; band 0 is
 * DEFRA's below-threshold white wash (alpha 179) for every road and rail
 * layer, rail_Lnight included, and transparent for airport.
 */
export const gridLayerPalette = (layer: string): Uint8Array => {
  // Road + local sources holds road bands: the road palette as it is.
  if (layer.startsWith("roadlocal_")) {
    return gridLayerPalette(roadLayerForSlot(layer.slice(10) as LocalNoiseSlot))
  }
  // Local sources alone hold round(2 x dB): each value gets the colour of
  // its road band, so a venue and a road at the same dB look the same.
  if (layer.startsWith("local_")) {
    const slot = layer.slice(6) as LocalNoiseSlot
    const road = gridLayerPalette(roadLayerForSlot(slot))
    const out = new Uint8Array(256 * 4)
    for (let v = 1; v < 256; v++) {
      const band = roadBandOf(v / 2, slot.endsWith("night"))
      if (band > 0) out.set(road.subarray(band * 4, band * 4 + 4), v * 4)
    }
    return out
  }
  const out = new Uint8Array(256 * 4)
  const own = derived[layer] ?? {}
  const entries =
    layer === "airport_Lden" ? { ...derived.airport_Lday, ...own } : own
  for (const [band, value] of Object.entries(entries)) {
    const b = Number(band)
    if (b > 0 && b < 256) out.set(value.rgba.slice(0, 4), b * 4)
  }
  if (layer.startsWith("road_") || layer.startsWith("rail_")) {
    out.set([255, 255, 255, 179], 0)
  }
  return out
}

/** The night glow of a palette (night-glow-tiles.ts), band by band. */
export const glowPalette = (palette: Uint8Array) => {
  const out = new Uint8Array(palette.length)
  for (let i = 0; i < palette.length; i += 4) {
    const glow = defraGlowRgba(palette[i], palette[i + 1], palette[i + 2], palette[i + 3])
    if (glow) out.set(glow, i)
  }
  return out
}
