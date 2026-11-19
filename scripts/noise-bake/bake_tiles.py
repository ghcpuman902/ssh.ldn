"""Day 2 step 1a: bake Web Mercator tiles z8-13 for all 12 layers, DEFRA colours baked in, lossless WebP RGBA.
Band -> RGBA comes from palette_derived.json (derived from DEFRA's own styled tiles, see PROGRESS.md).
z12-13: band of the 10 m cell under the pixel centre. z8-11: loudest band in the pixel footprint (4x4 samples) so thin roads survive.
band 0 (below threshold / no data) is transparent unless WHITE_FILL=1 (DEFRA paints it white at alpha 179 for road/rail)."""
import os, io, sys, json, time, numpy as np
from multiprocessing import Pool
from PIL import Image
from bake import LAYERS
from merc import tile_range, cell_index
OUT = "baked/tiles-merc"; ZS = range(8, 14); WHITE = os.environ.get("WHITE_FILL") == "1"
def lut(L):
    d = json.load(open("palette_derived.json"))
    pal = d[L]
    if L == "airport_Lden": pal = {**d["airport_Lday"], **{k: v for k, v in pal.items()}}  # Lden band 1 has no sample; follows Lday
    t = np.zeros((256, 4), np.uint8)
    for b, v in pal.items():
        if int(b) > 0: t[int(b)] = v["rgba"]
    if WHITE and L.startswith(("road", "rail")): t[0] = (255, 255, 255, 179)
    return t
_bands = {}; _luts = {}
def init():
    for L in LAYERS: _bands[L] = np.load(f"master/{L}.npz")["band"]; _luts[L] = lut(L)
def webp(rgba):
    b = io.BytesIO(); Image.fromarray(rgba, "RGBA").save(b, "WEBP", lossless=True, quality=100, method=6, exact=True); return b.getvalue()
def job(a):
    z, x, y = a; sub = 4 if z <= 11 else 1
    r, c, ok = cell_index(x, y, z, sub); res = {}
    for L in LAYERS:
        band = _bands[L]; g = np.zeros(r.shape, np.uint8); g[ok] = band[r[ok], c[ok]]
        if sub > 1: g = g.reshape(256, sub, 256, sub).max(axis=(1, 3))
        rgba = _luts[L][g]; rgba[(rgba[..., 3] == 0)] = 0
        d = f"{OUT}/{L}/{z}/{x}"; os.makedirs(d, exist_ok=True); w = webp(rgba)
        open(f"{d}/{y}.webp", "wb").write(w); res[L] = (len(w), bool(g.any()))
    return z, x, y, res
if __name__ == "__main__":
    jobs = []
    for z in ZS:
        x0, x1, y0, y1 = tile_range(z); jobs += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    print(len(jobs), "tile positions", flush=True); t0 = time.time(); stats = {}
    with Pool(8, initializer=init) as p:
        for i, (z, x, y, res) in enumerate(p.imap_unordered(job, jobs, chunksize=4)):
            for L, (n, nz) in res.items():
                s = stats.setdefault(L, {}).setdefault(z, {"files": 0, "nonempty": 0, "bytes": 0}); s["files"] += 1; s["nonempty"] += nz; s["bytes"] += n
            if i % 100 == 0: print(i, round(time.time() - t0), flush=True)
    json.dump(stats, open("baked/tiles-merc-report.json", "w"), indent=1); print("done", round(time.time() - t0))
