import { DEFRA_ROUND4_PALETTE } from "@/lib/map/defra-raster-legend"

/**
 * Night tiles go through this protocol so noise reads as light on the dark
 * basemap: quiet bands fade into the dark, a warm amber glow builds with
 * loudness, and from the red band up it turns white-hot and then icy blue, so
 * busy roads read as charged cores in an amber falloff (noise, not
 * streetlight). Brighter (luminance × alpha) always means louder. Venue
 * density tiles also come through here by day, to flatten their alpha into
 * hard-edged bands. Runs once per tile (not per frame); gauges and audio sample
 * the original tiles, so the data is untouched.
 */
export const NIGHT_GLOW_PROTOCOL = "ssh-glow"

type Rgb = readonly [number, number, number]
type Glow = readonly [number, number, number, number]

/**
 * `glow` is [r, g, b, alpha 0–1] per band, indexed like the source palette.
 * `flatAlpha` (0–255) replaces the source pixel's alpha per band, for tiles
 * whose alpha is a smooth gradient: without it they read as soft blobs even
 * with nearest resampling.
 */
type GlowPalette = {
  source: ReadonlyArray<Rgb>
  glow: ReadonlyArray<Glow>
  flatAlpha?: ReadonlyArray<number>
}

/** "venues-day" keeps the day colours and only flattens the alpha. */
export type NightGlowPalette = "defra" | "venues" | "venues-day"

// POI density ramp from scripts/generate-poi-density-tiles.mjs, sparsest
// first, and the middle of each band's alpha range there (34–72, 83–120,
// 126–168, 171–206, 203–224).
const VENUE_SOURCE: ReadonlyArray<Rgb> = [
  [56, 189, 248],
  [34, 197, 94],
  [250, 204, 21],
  [249, 115, 22],
  [239, 68, 68],
]
const VENUE_FLAT_ALPHA = [56, 100, 146, 188, 216]

const GLOW_PALETTES: Record<NightGlowPalette, GlowPalette> = {
  defra: {
    source: DEFRA_ROUND4_PALETTE,
    glow: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [130, 68, 28, 0.07],
      [150, 80, 32, 0.12],
      [205, 120, 48, 0.24],
      [250, 160, 70, 0.5],
      [255, 226, 180, 0.6],
      [240, 240, 245, 0.8],
      [210, 232, 255, 0.95],
      [200, 230, 255, 1],
    ],
  },
  // A rosier ember than the roads, so venues stay distinguishable.
  venues: {
    source: VENUE_SOURCE,
    glow: [
      [170, 80, 60, 1],
      [215, 110, 80, 1],
      [245, 150, 100, 1],
      [255, 185, 140, 1],
      [255, 215, 190, 1],
    ],
    flatAlpha: VENUE_FLAT_ALPHA,
  },
  "venues-day": {
    source: VENUE_SOURCE,
    glow: VENUE_SOURCE.map(([red, green, blue]) => [red, green, blue, 1]),
    flatAlpha: VENUE_FLAT_ALPHA,
  },
}

/** Tiles are flat palette colours; anything further away is not a band. */
const MAX_BAND_DISTANCE_SQ = 2_500

export const nightGlowTileUrl = (path: string, palette: NightGlowPalette) =>
  `${NIGHT_GLOW_PROTOCOL}://${palette}/${path.replace(/^\//, "")}`

const nearestBand = (
  source: ReadonlyArray<Rgb>,
  red: number,
  green: number,
  blue: number
) => {
  let best = -1
  let bestDistance = MAX_BAND_DISTANCE_SQ
  source.forEach((rgb, index) => {
    const distance =
      (red - rgb[0]) ** 2 + (green - rgb[1]) ** 2 + (blue - rgb[2]) ** 2
    if (distance <= bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

const recolourToGlow = (pixels: Uint8ClampedArray, palette: GlowPalette) => {
  // Tiles hold a handful of flat colours, so cache the lookup per colour.
  const bands = new Map<number, number>()
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]
    if (alpha === 0) continue

    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const key = (red << 16) | (green << 8) | blue
    let band = bands.get(key)
    if (band === undefined) {
      band = nearestBand(palette.source, red, green, blue)
      bands.set(key, band)
    }

    const glow = band >= 0 ? palette.glow[band] : null
    if (!glow || glow[3] === 0) {
      pixels[index + 3] = 0
      continue
    }

    pixels[index] = glow[0]
    pixels[index + 1] = glow[1]
    pixels[index + 2] = glow[2]
    pixels[index + 3] = Math.round(
      (palette.flatAlpha?.[band] ?? alpha) * glow[3]
    )
  }
}

const parseGlowUrl = (url: string) => {
  const rest = url.slice(`${NIGHT_GLOW_PROTOCOL}://`.length)
  const slash = rest.indexOf("/")
  const name = rest.slice(0, slash)
  const palette = name in GLOW_PALETTES ? (name as NightGlowPalette) : "defra"
  return { palette: GLOW_PALETTES[palette], path: rest.slice(slash + 1) }
}

const loadGlowTile = async (url: string, signal: AbortSignal) => {
  const { palette, path } = parseGlowUrl(url)
  const response = await fetch(new URL(path, window.location.origin), {
    signal,
  })
  if (!response.ok) throw new Error(`Glow tile ${response.status}`)

  const blob = await response.blob()
  if (typeof OffscreenCanvas === "undefined") {
    return { data: await blob.arrayBuffer() }
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    return { data: await blob.arrayBuffer() }
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  recolourToGlow(image.data, palette)
  context.putImageData(image, 0, 0)

  return { data: canvas.transferToImageBitmap() }
}

let registration: Promise<void> | null = null
let registered = false

export const isNightGlowProtocolReady = () => registered

/** Registers the protocol once, on the same maplibre-gl instance the map loads. */
export const registerNightGlowProtocol = () => {
  registration ??= import("maplibre-gl").then(({ addProtocol }) => {
    addProtocol(NIGHT_GLOW_PROTOCOL, (params, abortController) =>
      loadGlowTile(params.url, abortController.signal)
    )
    registered = true
  })
  return registration
}
