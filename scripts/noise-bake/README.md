# Noise bake scripts

Python scripts that turn the fetched DEFRA GeoTIFFs into what ssh.ldn serves. Read `doc/noise-data/DESIGN.md` first.

`fetch_ext.py` fetches the 26 extra chunks for the coverage box (`bake.py` holds the grid constants; every other script imports them or reads `index.json`).

Run from a folder holding `raw/` (the DEFRA GeoTIFFs: 56 chunks × 12 layers × 2), `calib.jsonl` and the scripts. Needs numpy, Pillow, tifffile, pyproj.

1. `bake.py` builds `master/<layer>.npz`: dB in 0.5 dB steps plus DEFRA's band index per 10 m cell.
2. `derive_palette.py` reads DEFRA's own styled z12 tiles and writes `palette_derived.json` (band to DEFRA colour per layer).
3. `bake_tiles.py` writes `baked/tiles-merc/<layer>/<z>/<x>/<y>.webp`, z8 to 13, lossless RGBA WebP.
4. `archive32.py` writes the 32-cell lookup archive (`index.json`, `index.bin`, `data.bin`).
5. `verify_tiles.py` and `verify_archive32.py` are the lossless gates.
6. `bake_grid.py` writes `baked/grid/` (the 256-cell gzip band chunks and max pyramid the WebGL layer draws).
7. Local sources: `node scripts/noise-bake/local_activity.mjs > local_activity.json` (OSM venues, slot activity, BNG via the app's `wgs84ToBng`), then `bake_local.py` adds `local_<slot>` and `roadlocal_<slot>` to `baked/grid/`; `verify_local.py` checks them against a brute-force energy sum.
8. `make_upload.py` stages `points/` + `grid/` for public Blob under `noise/<hash>/` (hash over every file).
