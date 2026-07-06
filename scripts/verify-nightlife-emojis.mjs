#!/usr/bin/env node
/**
 * Verification script for nightlife emoji markers.
 * Run: node scripts/verify-nightlife-emojis.mjs
 * Requires local dev server at http://localhost:3999
 */
import { chromium } from "playwright"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.VERIFY_BASE_URL ?? "http://localhost:3999"
const OUT_DIR = path.join(ROOT, "..", "artifacts", "nightlife-verify")
const SCREENSHOT = path.join(OUT_DIR, "local-dev-emojis-proof.png")
const REPORT = path.join(OUT_DIR, "proof.json")

const getMapInstance = () => {
  const container = document.querySelector(".maplibregl-map")
  if (!container) return null

  for (const key of Object.keys(container)) {
    if (key.startsWith("_") || key.includes("map")) {
      const value = container[key]
      if (value && typeof value.hasImage === "function") {
        return value
      }
    }
  }

  return null
}

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })

  const apiCalls = []
  page.on("response", (response) => {
    if (response.url().includes("/api/discovery/osm/nightlife")) {
      apiCalls.push({
        url: response.url(),
        status: response.status(),
      })
    }
  })

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 })

  for (let i = 0; i < 4; i += 1) {
    await page.locator(".maplibregl-ctrl-zoom-in").click()
    await page.waitForTimeout(700)
  }

  await page.waitForTimeout(12_000)

  const layerButtons = page.locator('[aria-label="Noise layer visibility"] button')
  for (let i = 0; i < 3; i += 1) {
    const pressed = await layerButtons.nth(i).getAttribute("aria-pressed")
    if (pressed === "true") {
      await layerButtons.nth(i).click()
    }
  }

  await page.waitForTimeout(1500)

  const mapMetrics = await page.evaluate(() => {
    const map = window.__sshMap
    if (!map) return { error: "no map instance (window.__sshMap missing)" }

    const emojiIds = [
      "nightlife-emoji-pub",
      "nightlife-emoji-bar",
      "nightlife-emoji-nightclub",
      "nightlife-emoji-music_venue",
      "nightlife-emoji-hospital",
      "nightlife-emoji-default",
    ]

    const renderedSymbols = map.queryRenderedFeatures({
      layers: ["nightlife-venues-symbol"],
    })
    const renderedCircles = map.queryRenderedFeatures({
      layers: ["nightlife-venues-noise-aura"],
    })

    const center = map.getCenter()
    const zoom = map.getZoom()

    return {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      hasImages: Object.fromEntries(emojiIds.map((id) => [id, map.hasImage(id)])),
      renderedSymbolCount: renderedSymbols.length,
      renderedCircleCount: renderedCircles.length,
      sampleSymbols: renderedSymbols.slice(0, 5).map((feature) => ({
        amenity: feature.properties?.amenity,
        name: feature.properties?.name,
      })),
      layerVisibility: {
        symbol: map.getLayoutProperty("nightlife-venues-symbol", "visibility"),
        nightlifeToggle: document.querySelector(
          '[aria-label="Toggle Local noise sources"]'
        )?.getAttribute("aria-pressed"),
      },
    }
  })

  await page.screenshot({ path: SCREENSHOT, fullPage: false })

  const directApi = await page.evaluate(async () => {
    const response = await fetch("/api/discovery/osm/nightlife?row=6&col=11")
    const data = await response.json()
    return {
      status: response.status,
      featureCount: data.features?.length ?? 0,
      error: data.error ?? null,
    }
  })

  await browser.close()

  const proof = {
    verifiedAt: new Date().toISOString(),
    branch: process.env.GIT_BRANCH ?? "unknown",
    baseUrl: BASE_URL,
    screenshot: SCREENSHOT,
    directApi,
    mapMetrics,
    nightlifeApiCalls: {
      total: apiCalls.length,
      ok: apiCalls.filter((call) => call.status === 200).length,
      sample: apiCalls.slice(0, 3),
    },
    pass:
      mapMetrics.renderedSymbolCount > 0 &&
      Object.values(mapMetrics.hasImages ?? {}).every(Boolean) &&
      directApi.featureCount > 0 &&
      directApi.status === 200,
  }

  await writeFile(REPORT, `${JSON.stringify(proof, null, 2)}\n`)

  console.log(JSON.stringify(proof, null, 2))
  process.exit(proof.pass ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
