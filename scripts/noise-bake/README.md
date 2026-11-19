# Noise bake scripts

Python scripts that turn the fetched DEFRA GeoTIFFs into what ssh.ldn serves. Read `doc/noise-data/DESIGN.md` first.

Run from a folder holding `raw/` (the 722 DEFRA GeoTIFFs), `calib.jsonl` and the scripts. Needs numpy, Pillow, tifffile, pyproj.

1. `bake.py` builds `master/<layer>.npz`: dB in 0.5 dB steps plus DEFRA's band index per 10 m cell.
2. `derive_palette.py` reads DEFRA's own styled z12 tiles and writes `palette_derived.json` (band to DEFRA colour per layer).
3. `bake_tiles.py` writes `baked/tiles-merc/<layer>/<z>/<x>/<y>.webp`, z8 to 13, lossless RGBA WebP.
4. `archive32.py` writes the 32-cell lookup archive (`index.json`, `index.bin`, `data.bin`).
5. `verify_tiles.py` and `verify_archive32.py` are the lossless gates.
