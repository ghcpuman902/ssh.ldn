import { DEFRA_RASTER_BANDS } from "@/lib/map/defra-raster-legend"

/**
 * Night tiles go through this protocol so noise reads as light on the dark
 * basemap: each DEFRA band keeps its hue family, but quiet bands fade into the
 * dark and loud ones get brighter and more opaque. Brighter still means
 * louder. Runs once per tile (not per frame); gauges and audio sample the
 * original tiles, so the data is untouched.
 */
export const NIGHT_GLOW_PROTOCOL = "ssh-glow"

/** Indexed like DEFRA_RASTER_BANDS: [r, g, b, alpha 0–1]. */
const NIGHT_GLOW_BANDS: ReadonlyArray<readonly [number, number, number, number]> =
  [
    [0, 176, 80, 0],
    [110, 190, 120, 0.14],
    [245, 220, 110, 0.3],
    [255, 170, 70, 0.5],
    [255, 96, 80, 0.8],
    [214, 140, 255, 1],
  ]

/** Same cut-off as the legend sampler: anything further is not a noise band. */
const MAX_BAND_DISTANCE_SQ = 14_000

export const nightGlowTileUrl = (path: string) =>
  `${NIGHT_GLOW_PROTOCOL}://${path.replace(/^\//, "")}`

const nearestBand = (red: number, green: number, blue: number) => {
  let best = -1
  let bestDistance = MAX_BAND_DISTANCE_SQ
  DEFRA_RASTER_BANDS.forEach(({ rgb }, index) => {
    const distance =
      (red - rgb[0]) ** 2 + (green - rgb[1]) ** 2 + (blue - rgb[2]) ** 2
    if (distance <= bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

const recolourToGlow = (pixels: Uint8ClampedArray) => {
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]
    if (alpha === 0) continue

    const band = nearestBand(pixels[index], pixels[index + 1], pixels[index + 2])
    const glow = band >= 0 ? NIGHT_GLOW_BANDS[band] : null
    if (!glow || glow[3] === 0) {
      pixels[index + 3] = 0
      continue
    }

    pixels[index] = glow[0]
    pixels[index + 1] = glow[1]
    pixels[index + 2] = glow[2]
    pixels[index + 3] = Math.round(alpha * glow[3])
  }
}

const loadGlowTile = async (url: string, signal: AbortSignal) => {
  const response = await fetch(
    new URL(url.slice(`${NIGHT_GLOW_PROTOCOL}://`.length), window.location.origin),
    { signal }
  )
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
  recolourToGlow(image.data)
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
