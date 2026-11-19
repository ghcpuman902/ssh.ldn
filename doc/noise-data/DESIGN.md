# Noise data: design skeleton

Owner: Mangle. Status 18 Nov 2026: day 1 built on `feat/defra-local-grid` (point API on a local baked grid). Day 2 (below) is approved and scheduled.

This file is the skeleton for how ssh.ldn gets, stores and serves DEFRA noise data. Every agent working on noise tiles, the noise lookup, the report tab or map loading reads it first. The full research, with sources and every measurement, is in the spec page "ssh-ldn: quick noise lookup spec".

## How to take feedback

The principles below are settled. They were measured, not guessed.

When Mangle reports a bug, or says something doesn't work or feels wrong:

1. Assume a principle is fine and an implementation detail is wrong. That is nearly always the case.
2. Look for two mechanisms fighting each other. Each can follow a principle and still break the other. Examples: idle prefetch competing with on-screen tiles for the network; a cache header and a versioned URL that disagree; the map's own tile retry and our sampler both fetching the same tile.
3. Fix that detail. Keep the principle.
4. Do not drop, weaken or rewrite a principle, or swap in a different design, unless Mangle explicitly says so. If you think a principle itself is wrong, say why with numbers and ask. Don't change it quietly.
5. Log every reported bug in `doc/noise-data/COMPLAINTS.md`: what was reported, the real cause, the fix, and the regression test. Add a test wherever one is possible.

## Skeleton

### 1. Source and licence
- Data: DEFRA Strategic Noise Mapping Round 4 (2021 model year), road, rail and airport (`Airport_Noise_ALL_*`), each as Lden, Lday, Leve and Lnight. 12 layers, native 10 m grid in British National Grid (EPSG:27700).
- Licence: Open Government Licence v3. Re-hosting and derived outputs are allowed. We must show the attribution, must not imply Defra endorses us, and must not spread requests across IPs or user agents.
- Attribution, shown with the map and in every API response: "Contains public sector information licensed under the Open Government Licence v3.0. © Department for Environment, Food & Rural Affairs copyright and/or database right 2023."
- Why: DEFRA allows bots 10 requests a minute and standard users 200. The old app spent 12 DEFRA requests on every lookup. Fetching once and serving our own copy removes that limit and the cost.

### 2. One-off fetch and master grid
- London box: E 502,005–562,005, N 153,005–203,005 (6,000 × 5,000 cells of 10 m), fetched as 1000 px WMS GeoTIFFs. Per chunk: the band image (no style) and the stretched dB image ('raster' style). 722 files, 689 MB, about 1.5 hours at about 7.5 requests a minute, 0 rate-limit errors.
- Real dB from the stretched image, calibrated with exact point readings (GetFeatureInfo). Road and rail: dB = max × (v − 0.5) / 254, from one reading at the loudest cell per chunk; v = 1 means no data. Airport: a straight line through the quietest and loudest valid cells (band 10 or 11 means no data, and the loudest valid cell can be v = 254).
- Master copy per layer: dB in 0.5 dB steps as one byte (0 = no data or below DEFRA's threshold), plus DEFRA's own band index. Keep both: bands worked out from dB differ at about 2.5% of band edges.
- Accuracy gate: 50 random exact DEFRA readings (22 road, 15 rail, 13 airport) are within 0.37 dB at worst, 0.125 dB on average, and none over 0.5 dB. The fixture is `lib/server/__fixtures__/noise-grid-gate.json`; the test runs whenever the baked data is present.
- Why dB and not only bands: bands make 65 and 69.5 dB look the same. Agents and scores need the difference. Browsers only need bands.

### 3. Map tiles (browser)
- Bake Web Mercator tiles in the grid MapLibre already uses, zoom 8–13, lossless WebP, with DEFRA's palette baked in (MapLibre GL JS 5.24 has no raster colour ramp). With 10 colours WebP stores a palette, so size stays close to the band tiles. Measured, road Lden: zoom 13 (11.9 m pixels) is 354 tiles and 2.81 MB; zoom 12 is 98 tiles and 0.94 MB.
- Show them by changing the tile URL in `defraTileUrl` (`components/map/noise-map-layers.tsx`): maxzoom 13, `raster-resampling: nearest` past that. `lib/map/raster-pixel-sampler.ts` reads the same tiles and maps colours back to bands exactly.
- Why: MapLibre already orders tile loading, caches tiles, and shows a loaded parent or children while a tile arrives. A URL swap gets all of that for free. A custom GPU layer would have to rebuild it. Zoom 14, or a GPU layer for true 10 m sharpness, comes later and only if Mangle asks.
- Lossless round-trip is a gate: every tile pixel must decode to the band of the 10 m cell under it.

### 4. Lookup archive (server, agents)
- One archive: `index.json` plus `data.bin`, read by HTTP range or file offset. Each record is one gzip chunk holding, for all 12 layers, a dB plane and a band plane. Loader and route: `lib/server/noise-grid.ts`, `app/api/noise/point/route.ts`. Location set by `NOISE_GRID_BASE` (a local folder or an https base). It defaults to `_agent/defra-fetch/baked/points`, which is not committed.
- Chunk size: 32 cells (320 m). Median read 3.4 KB, centre of London 5.9 KB, worst 9.3 KB; 28,891 chunks, about 105 MB in total; binary index about 230 KB, kept in server memory. Day 1 used 128 cells (median 50.9 KB, centre 92 KB, worst 127 KB). Moving to 32 cells is a day 2 task.
- Why 32 cells: central London is about twice as dense as outer London, so big chunks hurt most where demand is highest. An adaptive quadtree (split while over 8 KB) gave the same 9.3 KB worst case with more code, so fixed 32 cells won. A per-layer split only helps if callers ask for fewer layers.

### 5. Hosting and cache headers
- Public Vercel Blob, under a folder named by content hash, for example `noise/<hash>/...`. Never overwrite a published file; a new bake gets a new hash.
- `Cache-Control: public, max-age=31536000, immutable`. Blob caches files up to 512 MB at the CDN, answers repeat requests with 304 and supports range requests.
- Why: hashed URLs mean a cached file is never stale, so browsers and the CDN can keep it for a year. This is what makes repeat views and agent calls cost almost nothing.
- Do not pre-compress binary files with Content-Encoding. Vercel's handling is unreliable and Safari can't read double compression. WebP is already compressed, and the archive is gzip records decoded on the server.

### 6. Loading: view first, then idle prefetch
- View first: only what is on screen loads at first, at normal priority, through MapLibre. Panning, zooming and search always win over anything in the background.
- Idle prefetch starts only after MapLibre's idle event, about 2 s with no input, and only while the tab is visible. Any pan, zoom or search aborts the queue at once.
- Scheduling: `scheduler.postTask({ priority: "background" })` in Chrome and Firefox 142+, `requestIdleCallback` as the fallback, a MessageChannel or timer in Safari (it has neither). Fetch with `priority: "low"`, at most 2 at a time.
- Order: coarse zooms first, then rings outward from the user's current view (not from a fixed centre). Measured on the day 1 pyramid: coarse levels for all 12 layers 2.9 MB; rings at 10 m within 5 km 0.94 MB, 10 km 3.5 MB, 20 km 11.5 MB.
- Budget: none when Save-Data is on or the connection is 2G (Chromium exposes these). Safari exposes neither, so it gets coarse levels plus a 5 km ring, about 4 MB.
- Storage: the plain HTTP cache. No service worker for now, because Safari deletes script-written storage, including Cache Storage, after 7 days of Safari use without interaction.
- Why: users see their own area immediately, and idle time turns about 30 MB of London into instant panning later.
- Watch for conflicts: prefetch must never delay on-screen tiles. If it does, fix the scheduling, not the principle.

### 7. Report tab
- Call `/api/noise/point` first and render the numbers before Google Maps finishes loading. Google adds context; it must not gate our data.

### 8. Public point API for agents
- `GET /api/noise/point?lat=..&lng=..`, `GET ?points=lat,lng;lat,lng`, or `POST { points: [{ lat, lng }] }`, at most 50 points. It returns road, rail and airport separately, each with Lden, Lday, Leve and Lnight as dB (0.5 dB steps, null when there is no data) and band, plus the attribution.
- Train noise stays separate because it can be a positive sign for a pub.
- GET responses are cached (`s-maxage=86400, stale-while-revalidate=604800`), and the route has a 60-a-minute rate limit.
- Day 2 adds it to `PUBLIC_API_PREFIXES` in `proxy.ts`, to `llms.txt`, and to the bot-protection exception, so agents get through.
- Why: callers bring their own candidate places; we only answer "how loud is it here, and from what" quickly.

## Day 2 order and gates

1. Re-bake Mercator tiles and the 32-cell archive. Gate: lossless, and sizes within 10% of the numbers above.
2. Upload to public Blob (approved by Mangle, 18 Nov). Gate: a range request returns 206; a repeat returns 304 or a cache hit.
3. Swap `defraTileUrl` and the sampler. Gate: 5 spots look the same as DEFRA, no 404s, and sampler bands equal API bands at 20 points.
4. Idle prefetcher. Gate: the first view finishes before any prefetch request, a pan cancels the queue, and a reload loads tiles from cache. Checked in Chrome and Safari.
5. Report tab calls the point API first. Gate: on throttled Slow 4G, the numbers show before Google.
6. Point route reads the Blob archive and goes public. Gate: the 50-point test still passes; timings recorded.
7. Chrome and Safari checks, 20 venues old versus new, then a PR. Push, preview and merge only on Mangle's fresh OK.

If time runs out, cut in this order: idle prefetch, then the night-glow tile variant (keep its live proxy), then the report-tab change.

## Day 2 implementation notes (19 Nov 2026)

These record how the principles above were built. They change no principle.

- Tiles: `scripts/noise-bake/bake_tiles.py`, z8–13, 12 layers, lossless RGBA WebP. Colours come from DEFRA's own styled tiles (`palette_derived.json`), so the sampler's palette matching is unchanged. z12–13 show the band of the cell under the pixel centre; z8–11 show the loudest band in the pixel's footprint so thin roads survive. Road and rail (except rail Lnight) keep DEFRA's white wash for below-threshold cells; rail Lnight's smaller extent can't be recovered, so it stays transparent there.
- A z13 pixel is 11.9 m and a cell is 10 m, so near a band edge the sampler can show the neighbouring cell's band. Measured: 108 of 120 sampler/API comparisons are identical and the other 12 are all within one cell. Exact agreement everywhere needs z14 (not built; ask Mangle).
- Archive version 2: 32-cell chunks, `index.json` (geometry only) plus `index.bin` (uint32 little-endian offset and length per chunk). The loader reads both v1 and v2.
- Publishing: the code reads `NEXT_PUBLIC_NOISE_DATA_BASE` (`<public Blob origin>/noise/<hash>`). Unset means the map keeps using the live WMS proxy and the point API keeps using the local folder, so nothing changes until a bake is published.
- Gates: `scripts/noise-bake/verify_tiles.py`, `verify_archive32.py`, `gate-sampler.mjs`, `compare-defra-tiles.mjs`, `compare-venues.mjs`.
