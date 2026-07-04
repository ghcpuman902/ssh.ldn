import type { Map as MapLibreMap } from "maplibre-gl"

/** Local source emoji — same semantics as the layer toggle, readable on the map. */
export const NIGHTLIFE_AMENITY_EMOJI = {
  pub: "🍺",
  bar: "🍸",
  nightclub: "🪩",
  music_venue: "🎸",
  hospital: "🏥",
  default: "🍻",
} as const

export type NightlifeEmojiImageKey = keyof typeof NIGHTLIFE_AMENITY_EMOJI

export const nightlifeEmojiImageId = (key: NightlifeEmojiImageKey) =>
  `nightlife-emoji-${key}`

const EMOJI_IMAGE_SIZE = 48

const createEmojiImageData = (
  emoji: string,
  size = EMOJI_IMAGE_SIZE
): ImageData => {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Could not create emoji canvas context")
  }

  ctx.clearRect(0, 0, size, size)
  ctx.font = `${Math.round(size * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(emoji, size / 2, size / 2 + 1)

  return ctx.getImageData(0, 0, size, size)
}

/** Register local source emoji sprites on the map (idempotent — safe after style reload). */
export const registerNightlifeEmojiImages = (map: MapLibreMap) => {
  for (const [key, emoji] of Object.entries(NIGHTLIFE_AMENITY_EMOJI)) {
    const id = nightlifeEmojiImageId(key as NightlifeEmojiImageKey)
    if (map.hasImage(id)) continue

    map.addImage(id, createEmojiImageData(emoji), { pixelRatio: 2 })
  }
}
