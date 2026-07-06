#!/usr/bin/env node
/**
 * Downloads horizontal London borough council logos from Wikipedia / Wikimedia Commons.
 * Run: node scripts/download-borough-logos.mjs
 */

import { mkdir, writeFile, unlink, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, "../public/boroughs")

/** slug -> { out: local filename, wikiFile?: Wikipedia file title, commonsFile?, directUrl? } */
const COUNCIL_LOGOS = [
  { slug: "barking-dagenham", out: "barking-dagenham-logo.svg", commonsFile: "Barking_and_Dagenham_logo.svg" },
  { slug: "barnet", out: "barnet-logo.svg", wikiFile: "LB_Barnet_logo.svg" },
  { slug: "bexley", out: "bexley-logo.svg", wikiFile: "Lb_bexley_logo.svg" },
  { slug: "brent", out: "brent-logo.svg", wikiFile: "Brent_London_Borough_Council_logo.svg" },
  { slug: "bromley", out: "bromley-logo.svg", wikiFile: "Lb_bromley.svg" },
  { slug: "camden", out: "camden-logo.svg", wikiFile: "Lb_camden_logo.svg" },
  { slug: "city-of-london", out: "city-of-london-logo.svg", commonsFile: "City_of_London_logo.svg" },
  { slug: "croydon", out: "croydon-logo.svg", commonsFile: "Lb_croydon_logo.svg" },
  { slug: "ealing", out: "ealing-logo.svg", wikiFile: "Lb_ealing_logo.svg" },
  { slug: "enfield", out: "enfield-logo.svg", wikiFile: "Lb_enfield_logo.svg" },
  { slug: "greenwich", out: "greenwich-logo.svg", wikiFile: "RB_Greenwich.svg" },
  { slug: "hackney", out: "hackney-logo.svg", wikiFile: "Lb_hackney_logo.svg" },
  { slug: "hammersmith-fulham", out: "hammersmith-fulham-logo.svg", wikiFile: "Lb_Hammersmith_and_Fulham_logo.svg" },
  { slug: "haringey", out: "haringey-logo.png", commonsFile: "Haringey_Logo.png" },
  { slug: "harrow", out: "harrow-logo.svg", wikiFile: "London_Borough_of_Harrow_logo.svg" },
  { slug: "havering", out: "havering-logo.svg", wikiFile: "Lb_havering_logo.svg" },
  { slug: "hillingdon", out: "hillingdon-logo.svg", wikiFile: "Lb_hillingdon_logo.svg" },
  { slug: "hounslow", out: "hounslow-logo.svg", wikiFile: "Lb_hounslow_logo.svg" },
  { slug: "islington", out: "islington-logo.svg", wikiFile: "IslingtonCouncil.svg" },
  { slug: "kensington-chelsea", out: "kensington-chelsea-logo.svg", wikiFile: "Rb_kensington_and_chelsea_logo.svg" },
  { slug: "kingston", out: "kingston-logo.svg", wikiFile: "Rb_kingston_upon_thames_logo.svg" },
  { slug: "lambeth", out: "lambeth-logo.svg", wikiFile: "Lb_lambeth_logo.svg" },
  { slug: "lewisham", out: "lewisham-logo.svg", wikiFile: "Lewisham_Council_Logo.svg" },
  { slug: "merton", out: "merton-logo.svg", wikiFile: "Lb_merton_logo.svg" },
  { slug: "newham", out: "newham-logo.svg", wikiFile: "Lb_newham_logo.svg" },
  { slug: "redbridge", out: "redbridge-logo.png", wikiFile: "LBRedbridge_logo.png" },
  { slug: "richmond-thames", out: "richmond-thames-logo.svg", wikiFile: "Lb_richmond_logo.svg" },
  { slug: "southwark", out: "southwark-logo.svg", wikiFile: "Southwark_London_Borough_Council.svg" },
  { slug: "sutton", out: "sutton-logo.svg", wikiFile: "Lb_sutton_logo.svg" },
  { slug: "tower-hamlets", out: "tower-hamlets-logo.svg", wikiFile: "Lb_tower_hamlets.svg" },
  { slug: "waltham-forest", out: "waltham-forest-logo.svg", wikiFile: "Lb_waltham_forest_logo.svg" },
  { slug: "wandsworth", out: "wandsworth-logo.svg", wikiFile: "Wandsworth_Council_logo.svg" },
  { slug: "westminster", out: "westminster-logo.svg", wikiFile: "City_of_westminster_logo.svg" },
]

const UA = "ssh.ldn borough logo downloader (https://github.com/manglekuo/ssh.ldn)"

const wikiFileUrl = (fileTitle) =>
  `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(fileTitle.replace(/ /g, "_"))}`

const commonsFileUrl = (fileTitle) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileTitle.replace(/ /g, "_"))}`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const downloadOne = async ({ slug, out, wikiFile, commonsFile, directUrl }) => {
  const dest = path.join(OUT_DIR, out)
  const url = directUrl ?? (commonsFile ? commonsFileUrl(commonsFile) : wikiFileUrl(wikiFile))

  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  })

  if (!response.ok) {
    throw new Error(`${slug}: HTTP ${response.status} for ${url}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get("content-type") ?? ""

  if (buffer.length < 400) {
    throw new Error(`${slug}: file too small (${buffer.length} bytes)`)
  }

  if (
    contentType.includes("text/html") ||
    buffer.toString("utf8", 0, 15).toLowerCase().includes("<!doctype")
  ) {
    throw new Error(`${slug}: received HTML instead of image`)
  }

  await writeFile(dest, buffer)
  console.log(`✓ ${slug} → ${out} (${(buffer.length / 1024).toFixed(1)} KB)`)
}

const removeLegacyAssets = async () => {
  const keep = new Set(COUNCIL_LOGOS.map((entry) => entry.out))
  const files = await readdir(OUT_DIR)

  for (const file of files) {
    if (keep.has(file)) {
      continue
    }
    if (
      file.endsWith(".svg") ||
      file.endsWith(".png") ||
      file.endsWith(".ico") ||
      file.endsWith("-mark.png")
    ) {
      await unlink(path.join(OUT_DIR, file))
      console.log(`  removed legacy ${file}`)
    }
  }
}

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true })

  let failed = 0
  for (const entry of COUNCIL_LOGOS) {
    try {
      await downloadOne(entry)
      await sleep(1200)
    } catch (error) {
      failed += 1
      console.error(`✗ ${entry.slug}: ${error.message}`)
    }
  }

  await removeLegacyAssets()

  if (failed > 0) {
    process.exitCode = 1
    console.error(`\n${failed} download(s) failed.`)
  } else {
    console.log(`\nDownloaded ${COUNCIL_LOGOS.length} council logos.`)
  }
}

main()
