#!/usr/bin/env node
/**
 * Build precomputed OSM local-source density tiles.
 *
 * Usage:
 *   pnpm generate-poi-density
 *   pnpm generate-poi-density -- --from-cache --min-zoom 10 --max-zoom 12
 */
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { deflateSync } from "node:zlib"
import { fileURLToPath } from "node:url"

import openingHours from "opening_hours"

const execFileAsync = promisify(execFile)

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT_ROOT = path.join(ROOT, "data/poi-density")
const PUBLIC_ROOT = path.join(ROOT, "public/poi-density")
const TILE_ROOT = path.join(PUBLIC_ROOT, "tiles")
const FEATURES_PATH = path.join(OUT_ROOT, "features.json")
const MANIFEST_PATH = path.join(PUBLIC_ROOT, "manifest.json")
const TILE_SIZE = 256
const BOUNDS = { west: -0.57, south: 51.24, east: 0.36, north: 51.73 }
const DEFAULT_MIN_ZOOM = 10
const DEFAULT_MAX_ZOOM = 12
const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
]

const DENSITY_SLOTS = [
  "weekday-day",
  "weekday-night",
  "weekend-day",
  "weekend-night",
]

const WEIGHTS = {
  pub: 0.28,
  bar: 0.34,
  nightclub: 1,
  music_venue: 0.82,
  hospital: 0.32,
}

const FALLBACK_ACTIVITY = {
  pub: {
    "weekday-day": 0.18,
    "weekday-night": 0.62,
    "weekend-day": 0.36,
    "weekend-night": 0.92,
  },
  bar: {
    "weekday-day": 0.12,
    "weekday-night": 0.72,
    "weekend-day": 0.28,
    "weekend-night": 0.98,
  },
  nightclub: {
    "weekday-day": 0.01,
    "weekday-night": 0.62,
    "weekend-day": 0.03,
    "weekend-night": 1,
  },
  music_venue: {
    "weekday-day": 0.02,
    "weekday-night": 0.58,
    "weekend-day": 0.08,
    "weekend-night": 0.9,
  },
  hospital: {
    "weekday-day": 0.34,
    "weekday-night": 0.42,
    "weekend-day": 0.3,
    "weekend-night": 0.42,
  },
}

/**
 * Approximate annoying indoor-with-window-open reach in metres.
 * These are deliberately conservative: the raster is context, not measured dB.
 */
const REACH_METERS = {
  pub: 34,
  bar: 38,
  nightclub: 90,
  music_venue: 72,
  hospital: 120,
}

const OVERVIEW_RADIUS_BOOST_BY_ZOOM = {
  10: 1.9,
  11: 1.35,
  12: 1,
}

// Cap is the 0–1 normalisation denominator before colour ramping.
const NORMALIZATION_CAP_BY_ZOOM = {
  10: 0.9,
  11: 0.72,
  12: 0.58,
}

const MAX_FEATURE_CONTRIBUTION = {
  pub: 0.22,
  bar: 0.26,
  nightclub: 0.55,
  music_venue: 0.48,
  hospital: 0.18,
}

const args = new Set(process.argv.slice(2))
const getArgNumber = (name, fallback) => {
  const prefix = `${name}=`
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  if (!value) return fallback
  const parsed = Number(value.slice(prefix.length))
  return Number.isInteger(parsed) ? parsed : fallback
}

const minZoom = getArgNumber("--min-zoom", DEFAULT_MIN_ZOOM)
const maxZoom = getArgNumber("--max-zoom", DEFAULT_MAX_ZOOM)
const useCache = args.has("--from-cache")

const buildOverpassQuery = () => `[out:json][timeout:180];
(
  nwr(${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east})["amenity"~"^(pub|bar|nightclub|music_venue|hospital)$"];
  nwr(${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east})["amenity"~"^(pub|bar)$"]["live_music"="yes"];
);
out center tags;`

const fetchOverpass = async () => {
  const query = buildOverpassQuery()
  let lastError = null

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "-sS",
          "-G",
          endpoint,
          "--data-urlencode",
          `data=${query}`,
          "-H",
          "User-Agent: ssh.ldn-poi-density/1.0",
          "-H",
          "Accept: application/json",
          "--max-time",
          "180",
        ],
        { maxBuffer: 80 * 1024 * 1024 }
      )
      return JSON.parse(stdout).elements ?? []
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error("Overpass request failed")
}

const elementCoordinates = (element) => {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat, longitude: element.lon }
  }
  if (element.center) {
    return { latitude: element.center.lat, longitude: element.center.lon }
  }
  return null
}

const normaliseElements = (elements) => {
  const seen = new Set()
  const features = []

  for (const element of elements) {
    const coordinates = elementCoordinates(element)
    const amenity = element.tags?.amenity
    if (!coordinates || !(amenity in WEIGHTS)) continue

    const id = `${element.type}/${element.id}`
    if (seen.has(id)) continue
    seen.add(id)

    features.push({
      id,
      name: element.tags?.name ?? null,
      amenity,
      openingHours: element.tags?.opening_hours ?? null,
      liveMusic: element.tags?.live_music === "yes",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    })
  }

  return features
}

const probeDateForSlot = (slot) => {
  if (slot === "weekday-day") return new Date(Date.UTC(2026, 6, 1, 12, 0, 0))
  if (slot === "weekday-night") return new Date(Date.UTC(2026, 6, 2, 1, 0, 0))
  if (slot === "weekend-day") return new Date(Date.UTC(2026, 6, 4, 12, 0, 0))
  return new Date(Date.UTC(2026, 6, 5, 1, 0, 0))
}

const activityForSlot = (feature, slot) => {
  if (!feature.openingHours) {
    return FALLBACK_ACTIVITY[feature.amenity][slot]
  }

  try {
    return new openingHours(feature.openingHours).getState(probeDateForSlot(slot))
      ? 1
      : 0.18
  } catch {
    return FALLBACK_ACTIVITY[feature.amenity][slot]
  }
}

const lngLatToWorldPixel = (longitude, latitude, z) => {
  const scale = 2 ** z * TILE_SIZE
  const x = ((longitude + 180) / 360) * scale
  const latRad = (latitude * Math.PI) / 180
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    scale
  return { x, y }
}

const metersPerPixel = (latitude, z) =>
  (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** z

const tileRangeForBounds = (z) => {
  const nw = lngLatToWorldPixel(BOUNDS.west, BOUNDS.north, z)
  const se = lngLatToWorldPixel(BOUNDS.east, BOUNDS.south, z)
  return {
    minX: Math.floor(nw.x / TILE_SIZE),
    maxX: Math.floor(se.x / TILE_SIZE),
    minY: Math.floor(nw.y / TILE_SIZE),
    maxY: Math.floor(se.y / TILE_SIZE),
  }
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

const encodePng = (rgba, width = TILE_SIZE, height = TILE_SIZE) => {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const colourFor = (normalised) => {
  if (normalised <= 0.025) return [0, 0, 0, 0]
  if (normalised < 0.18) return [56, 189, 248, Math.round(34 + normalised * 210)]
  if (normalised < 0.36) return [34, 197, 94, Math.round(46 + normalised * 205)]
  if (normalised < 0.58) return [250, 204, 21, Math.round(58 + normalised * 190)]
  if (normalised < 0.78) return [249, 115, 22, Math.round(70 + normalised * 175)]
  return [239, 68, 68, Math.round(86 + Math.min(0.92, normalised) * 150)]
}

const renderSlotZoom = async ({ features, slot, z }) => {
  const tiles = new Map()
  const cap = NORMALIZATION_CAP_BY_ZOOM[z] ?? 1
  const range = tileRangeForBounds(z)

  const getTile = (tileX, tileY) => {
    if (
      tileX < range.minX ||
      tileX > range.maxX ||
      tileY < range.minY ||
      tileY > range.maxY
    ) {
      return null
    }

    const key = `${tileX}/${tileY}`
    let tile = tiles.get(key)
    if (!tile) {
      tile = new Float32Array(TILE_SIZE * TILE_SIZE)
      tiles.set(key, tile)
    }
    return tile
  }

  for (const feature of features) {
    const activity = activityForSlot(feature, slot)
    const sourceWeight = Math.min(
      MAX_FEATURE_CONTRIBUTION[feature.amenity],
      WEIGHTS[feature.amenity] * activity
    )
    if (sourceWeight <= 0.015) continue

    const point = lngLatToWorldPixel(feature.longitude, feature.latitude, z)
    const centerX = Math.round(point.x)
    const centerY = Math.round(point.y)
    const radiusMeters =
      REACH_METERS[feature.amenity] * (OVERVIEW_RADIUS_BOOST_BY_ZOOM[z] ?? 1)
    const radius = Math.max(
      1,
      Math.round(radiusMeters / metersPerPixel(feature.latitude, z))
    )
    const sigma = Math.max(0.85, radius / 2.6)

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared > radius * radius) continue

        const worldX = centerX + dx
        const worldY = centerY + dy
        const tileX = Math.floor(worldX / TILE_SIZE)
        const tileY = Math.floor(worldY / TILE_SIZE)
        const tile = getTile(tileX, tileY)
        if (!tile) continue

        const pixelX = ((worldX % TILE_SIZE) + TILE_SIZE) % TILE_SIZE
        const pixelY = ((worldY % TILE_SIZE) + TILE_SIZE) % TILE_SIZE
        const kernel = Math.exp(-distanceSquared / (2 * sigma * sigma))
        const index = pixelY * TILE_SIZE + pixelX
        const contribution = Math.min(sourceWeight * kernel, sourceWeight)
        tile[index] = 1 - (1 - tile[index]) * (1 - contribution)
      }
    }
  }

  let written = 0
  for (const [key, density] of tiles) {
    const rgba = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4)
    let max = 0
    for (let i = 0; i < density.length; i += 1) {
      const normalised = Math.min(1, Math.log1p(density[i] * 1.8) / cap)
      if (normalised > max) max = normalised
      const [r, g, b, a] = colourFor(normalised)
      const offset = i * 4
      rgba[offset] = r
      rgba[offset + 1] = g
      rgba[offset + 2] = b
      rgba[offset + 3] = a
    }

    if (max <= 0.015) continue
    const [x, y] = key.split("/")
    const outPath = path.join(TILE_ROOT, slot, String(z), x, `${y}.png`)
    await mkdir(path.dirname(outPath), { recursive: true })
    await writeFile(outPath, encodePng(rgba))
    written += 1
  }

  return written
}

const loadFeatures = async () => {
  if (useCache) {
    return JSON.parse(await readFile(FEATURES_PATH, "utf8")).features
  }

  const elements = await fetchOverpass()
  const features = normaliseElements(elements)
  await mkdir(OUT_ROOT, { recursive: true })
  await writeFile(FEATURES_PATH, `${JSON.stringify({ bounds: BOUNDS, features })}\n`)
  return features
}

const main = async () => {
  if (minZoom > maxZoom) {
    throw new Error("--min-zoom must be <= --max-zoom")
  }

  const features = await loadFeatures()
  await rm(TILE_ROOT, { recursive: true, force: true })

  const tileCounts = {}
  for (const slot of DENSITY_SLOTS) {
    tileCounts[slot] = {}
    for (let z = minZoom; z <= maxZoom; z += 1) {
      const written = await renderSlotZoom({ features, slot, z })
      tileCounts[slot][z] = written
      console.log(`${slot} z${z}: ${written} tiles`)
    }
  }

  const featureHash = createHash("sha256")
    .update(JSON.stringify(features.map(({ id, amenity, latitude, longitude }) => ({
      id,
      amenity,
      latitude,
      longitude,
    }))))
    .digest("hex")

  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "OpenStreetMap Overpass",
        bounds: BOUNDS,
        minZoom,
        maxZoom,
        tileSize: TILE_SIZE,
        featureCount: features.length,
        featureHash,
        normalisedRange: [0, 1],
        weights: WEIGHTS,
        reachMeters: REACH_METERS,
        maxFeatureContribution: MAX_FEATURE_CONTRIBUTION,
        overviewRadiusBoost: OVERVIEW_RADIUS_BOOST_BY_ZOOM,
        normalisationCaps: NORMALIZATION_CAP_BY_ZOOM,
        tileCounts,
      },
      null,
      2
    )}\n`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
