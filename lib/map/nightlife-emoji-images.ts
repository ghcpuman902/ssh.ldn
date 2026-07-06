import type { Map as MapLibreMap, MapStyleImageMissingEvent } from "maplibre-gl"

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
const EMOJI_IMAGE_PREFIX = "nightlife-emoji-"

const boundMaps = new WeakSet<MapLibreMap>()

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

const emojiKeyFromImageId = (id: string): NightlifeEmojiImageKey | null => {
  if (!id.startsWith(EMOJI_IMAGE_PREFIX)) return null
  const key = id.slice(EMOJI_IMAGE_PREFIX.length)
  if (!(key in NIGHTLIFE_AMENITY_EMOJI)) return null
  return key as NightlifeEmojiImageKey
}

const addEmojiImage = (map: MapLibreMap, key: NightlifeEmojiImageKey) => {
  const id = nightlifeEmojiImageId(key)
  if (map.hasImage(id)) return

  map.addImage(id, createEmojiImageData(NIGHTLIFE_AMENITY_EMOJI[key]), {
    pixelRatio: 2,
  })
}

/** Register local source emoji sprites on the map (idempotent — safe after style reload). */
export const registerNightlifeEmojiImages = (map: MapLibreMap) => {
  for (const key of Object.keys(
    NIGHTLIFE_AMENITY_EMOJI
  ) as NightlifeEmojiImageKey[]) {
    addEmojiImage(map, key)
  }
}

const handleStyleImageMissing = (
  map: MapLibreMap,
  event: MapStyleImageMissingEvent
) => {
  const key = emojiKeyFromImageId(event.id)
  if (!key) return

  addEmojiImage(map, key)
}

/**
 * Register emoji sprites and keep them available after style reloads.
 * MapLibre drops custom images when the style changes; symbol layers need
 * `styleimagemissing` + re-register or icons silently fail to render.
 */
export const bindNightlifeEmojiImages = (map: MapLibreMap) => {
  registerNightlifeEmojiImages(map)

  if (boundMaps.has(map)) {
    return
  }

  boundMaps.add(map)

  map.on("styleimagemissing", (event) => {
    handleStyleImageMissing(map, event)
  })

  map.on("styledata", () => {
    registerNightlifeEmojiImages(map)
  })
}

/** After nightlife GeoJSON arrives, ensure sprites exist and relayout symbols. */
export const refreshNightlifeEmojiImages = (map: MapLibreMap) => {
  registerNightlifeEmojiImages(map)
  map.triggerRepaint()
}
