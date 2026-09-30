import {
  encodeNoiseTimeSlot,
  type NoiseTimeSlot,
} from "@/lib/map/noise-time"

/** Larger than the default 1200×630 card, still the 1.91:1 ratio platforms keep. */
export const SHARE_CARD_WIDTH = 1600
export const SHARE_CARD_HEIGHT = 840

/**
 * Interactive search flies to zoom 15. The card steps back to zoom 14 on a
 * wide frame so the pin sits in its neighbourhood instead of a single block.
 */
export const SHARE_CARD_ZOOM = 14
export const SHARE_CARD_TILE_SIZE = 256

const PAGE_PADDING = 20
const FRAME_RADIUS = 40

export const SHARE_MAP_FRAME = {
  x: PAGE_PADDING,
  y: PAGE_PADDING,
  width: SHARE_CARD_WIDTH - PAGE_PADDING * 2,
  height: SHARE_CARD_HEIGHT - PAGE_PADDING * 2,
  radius: FRAME_RADIUS,
} as const

/** Shift the camera down so the pin sits in the map above the caption. */
export const SHARE_PIN_LIFT = 84

const STREET_WIDTH_WITH_SCORE = 1080
const STREET_WIDTH_PLAIN = 1340
const META_TITLE_MAX = 42

const LONDON_BOUNDS = {
  west: -0.57,
  south: 51.24,
  east: 0.36,
  north: 51.73,
} as const

const ESRI_TILE = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas"

export const describeNoiseScore = (score: number) => {
  if (score >= 75) return "ssh has left the chat"
  if (score >= 55) return "ssh is a suggestion"
  if (score >= 35) return "ssh-able, most days"
  return "a rare London hush"
}

export type ShareCardInput = {
  address: string
  latitude: number
  longitude: number
  score?: number
}

export type ShareAddressLines = {
  street: string
  place: string
}

const readParam = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() ?? ""
}

const isWithinShareBounds = (latitude: number, longitude: number) =>
  longitude >= LONDON_BOUNDS.west &&
  longitude <= LONDON_BOUNDS.east &&
  latitude >= LONDON_BOUNDS.south &&
  latitude <= LONDON_BOUNDS.north

export const parseShareCardSearchParams = (
  input: Record<string, string | string[] | undefined>
): ShareCardInput | null => {
  const address = readParam(input.address).slice(0, 200)
  const latitude = Number(readParam(input.lat))
  const longitude = Number(readParam(input.lng))

  if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  if (!isWithinShareBounds(latitude, longitude)) return null

  const scoreRaw = readParam(input.score)
  if (!scoreRaw) {
    return { address, latitude, longitude }
  }

  const score = Number(scoreRaw)
  if (!Number.isFinite(score)) {
    return { address, latitude, longitude }
  }

  return {
    address,
    latitude,
    longitude,
    score: Math.max(0, Math.min(100, Math.round(score))),
  }
}

export const buildShareQuery = ({
  address,
  latitude,
  longitude,
  timeSlot,
  score,
}: {
  address: string
  latitude: number
  longitude: number
  timeSlot?: NoiseTimeSlot
  score?: number
}) => {
  const params = new URLSearchParams()
  params.set("address", address)
  params.set("lat", latitude.toFixed(6))
  params.set("lng", longitude.toFixed(6))
  if (timeSlot) params.set("timeSlot", encodeNoiseTimeSlot(timeSlot))
  if (score !== undefined) params.set("score", String(score))
  return params.toString()
}

export const buildShareCardPath = (input: ShareCardInput) => {
  const params = new URLSearchParams()
  params.set("address", input.address)
  params.set("lat", input.latitude.toFixed(6))
  params.set("lng", input.longitude.toFixed(6))
  if (input.score !== undefined) params.set("score", String(input.score))
  return `/og?${params.toString()}`
}

const tidyAddress = (address: string) =>
  address
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,\s*(UK|United Kingdom|Great Britain|England)$/i, "")
    .trim()

const isLondonSegment = (value: string) => /^london\b/i.test(value)

const isLocatorSegment = (value: string) =>
  /^(flat|apartment|apt|unit|suite|block)\b/i.test(value)

/** Street on the first line, the rest underneath, so a long address is not one cut-off title. */
export const splitShareAddress = (address: string): ShareAddressLines => {
  const tidy = tidyAddress(address)
  const dropped = /^Dropped pin \((.+)\)$/i.exec(tidy)

  if (dropped) {
    return { street: "Dropped pin", place: dropped[1] ?? "London" }
  }

  if (/^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(tidy)) {
    return { street: tidy, place: "London" }
  }

  const parts = tidy
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return { street: "London", place: "" }
  if (parts.length === 1) return { street: parts[0] ?? "London", place: "" }

  const streetParts = [parts[0] ?? "London"]
  let index = 1

  while (index < parts.length && !isLondonSegment(parts[index] ?? "")) {
    const current = streetParts.join(", ")
    const next = parts[index]
    if (!next) break
    if (current.length >= 12 && !streetParts.every(isLocatorSegment)) break

    streetParts.push(next)
    index += 1
  }

  return {
    street: streetParts.join(", "),
    place: parts.slice(index).join(", "),
  }
}

export const truncateAtWord = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= max) return text

  const slice = text.slice(0, Math.max(1, max - 1))
  const lastSpace = slice.lastIndexOf(" ")
  const cut =
    lastSpace > Math.floor(max * 0.55) ? slice.slice(0, lastSpace) : slice

  return `${cut.replace(/[,\s]+$/, "")}…`
}

/**
 * Link-preview title. Kept to one short line: street, score when we have it,
 * and the brand only when the street is already short enough not to wrap.
 */
export const formatShareMetaTitle = (
  lines: ShareAddressLines,
  score?: number
) => {
  const scoreSuffix = score !== undefined ? ` · ${score}` : ""
  const brandSuffix = " · ssh-ldn"
  const withBrandBudget = META_TITLE_MAX - scoreSuffix.length - brandSuffix.length
  const scoreBudget = META_TITLE_MAX - scoreSuffix.length

  if (lines.street.length <= withBrandBudget) {
    return `${lines.street}${scoreSuffix}${brandSuffix}`
  }

  if (lines.street.length <= scoreBudget) {
    return `${lines.street}${scoreSuffix}`
  }

  return `${truncateAtWord(lines.street, scoreBudget)}${scoreSuffix}`
}

export const formatShareDescription = (
  lines: ShareAddressLines,
  score?: number
) => {
  const phrase =
    score !== undefined
      ? describeNoiseScore(score)
      : "London noise for this address"
  const location = lines.place ? `${lines.street}, ${lines.place}` : lines.street
  const full = `${location}. ${phrase}.`

  if (full.length <= 150) return full

  const short = `${lines.street}. ${phrase}.`
  if (short.length <= 150) return short
  return truncateAtWord(short, 150)
}

const lineCapacity = (width: number, fontSize: number, lines: number) =>
  Math.floor(width / (fontSize * 0.58)) * lines

export const layoutShareStreet = (street: string, hasScore: boolean) => {
  const width = hasScore ? STREET_WIDTH_WITH_SCORE : STREET_WIDTH_PLAIN

  if (street.length <= lineCapacity(width, 44, 1)) {
    return { text: street, fontSize: 44, lineHeight: 50, lines: 1 as const, width }
  }

  if (street.length <= lineCapacity(width, 34, 2)) {
    return { text: street, fontSize: 34, lineHeight: 40, lines: 2 as const, width }
  }

  return {
    text: truncateAtWord(street, lineCapacity(width, 30, 2)),
    fontSize: 30,
    lineHeight: 36,
    lines: 2 as const,
    width,
  }
}

export const layoutSharePlace = (place: string, width: number) =>
  truncateAtWord(place, lineCapacity(width, 22, 1))

const lngLatToWorld = (longitude: number, latitude: number) => {
  const clamped = Math.min(85.05112878, Math.max(-85.05112878, latitude))
  const scale = SHARE_CARD_TILE_SIZE * 2 ** SHARE_CARD_ZOOM
  const x = ((longitude + 180) / 360) * scale
  const latRad = (clamped * Math.PI) / 180
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    scale

  return { x, y }
}

export type ShareMapTile = {
  key: string
  left: number
  top: number
  size: number
  baseUrl: string
  labelUrl: string
}

export const layoutShareMap = (latitude: number, longitude: number) => {
  const { width, height } = SHARE_MAP_FRAME
  const point = lngLatToWorld(longitude, latitude)
  const centerX = point.x
  const centerY = point.y + SHARE_PIN_LIFT
  const left = centerX - width / 2
  const top = centerY - height / 2
  const size = SHARE_CARD_TILE_SIZE
  const zoom = SHARE_CARD_ZOOM
  const x0 = Math.floor(left / size)
  const y0 = Math.floor(top / size)
  const x1 = Math.floor((left + width - 1) / size)
  const y1 = Math.floor((top + height - 1) / size)
  const limit = 2 ** zoom
  const tiles: ShareMapTile[] = []

  for (let tileX = x0; tileX <= x1; tileX += 1) {
    for (let tileY = y0; tileY <= y1; tileY += 1) {
      if (tileX < 0 || tileY < 0 || tileX >= limit || tileY >= limit) continue

      const path = `${zoom}/${tileY}/${tileX}`
      tiles.push({
        key: `${tileX}-${tileY}`,
        left: tileX * size - left,
        top: tileY * size - top,
        size,
        baseUrl: `${ESRI_TILE}/World_Light_Gray_Base/MapServer/tile/${path}`,
        labelUrl: `${ESRI_TILE}/World_Light_Gray_Reference/MapServer/tile/${path}`,
      })
    }
  }

  return {
    tiles,
    pinLeft: point.x - left,
    pinTop: point.y - top,
  }
}
