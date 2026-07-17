# Public noise data validation notes

Generated: 2026-07-15

## Build

```bash
pnpm build-public-noise
```

Outputs:

- `public/data/public-noise/observations.json` — 390 observations
- `public/data/public-noise/segments.geojson` — 98 station-pair segments
- `public/data/public-noise/stations.geojson` — TfL/OSM stations
- `public/data/public-noise/sources.json` — provenance manifest

## Source QA checklist

| Source | Extracted? | Station match | Geometry | Notes |
|---|---|---|---|---|
| central-r3291 | Yes (standing+seated) | Good | Track-following | Passenger Tier A |
| bakerloo-r3292 | Yes (standing) | Good | Track-following | Outer blank rows skipped |
| central-r3451 | Yes (summary LAeq) | Good | Track-following | Test-vehicle position |
| stratford-leyton-foi | Yes (cab comparative + history) | Good | Track-following | Cab proxy; history on Stratford–Leyton |
| northern-r2900 | Yes (appendix medians) | Fixed King's Cross alias | Track-following | Cab Tier B |
| anuar-2025 | Catalogued CC BY | N/A | N/A | Hotspot validation context |
| Other catalogue sources | Metadata only | N/A | N/A | Not inventing section values |

## Colour scheme

- Teal/green → blue → purple (AQ-inspired; purple = noisier)
- Grey = no data (never treat as quiet)

## Screenshots

Captured via MapLibre QA preview (`doc/public-noise-data/validation/qa-preview.html`):

| File | What it shows |
|---|---|
| [screenshots/all-sources.png](screenshots/all-sources.png) | All 98 sections, dBA 64–97 |
| [screenshots/central-r3291.png](screenshots/central-r3291.png) | Central passenger survey — 34 sections |
| [screenshots/bakerloo-r3292.png](screenshots/bakerloo-r3292.png) | Bakerloo passenger survey — 20 sections |
| [screenshots/northern-r2900.png](screenshots/northern-r2900.png) | Northern cab proxy — 30 sections |

Visual checks: Central corridor tracks through Zone 1 with purple hotspot near Stratford–Leyton; Bakerloo follows NW–SE alignment; Northern follows N–S Bank/Camden corridor. Colour ramp green → yellow → orange → red → purple; grey full-line tracks show unmeasured sections of covered lines.

## Next.js route

`/maps/public-noise-data` requires the app's existing Next.js server (do not start a second one). When localhost:3999 is running, verify filters + URL sync there; QA preview above validates spatial data independently.
