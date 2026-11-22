"""Lossless gate: decode every baked tile, map colour -> band, compare to master band at every pixel (z12-13 nearest cell; z8-11 loudest in footprint)."""
import glob, json, numpy as np
from multiprocessing import Pool
from PIL import Image
from bake import LAYERS
from merc import cell_index
import bake_tiles
def check(a):
    z, x, y = a; sub = 4 if z <= 11 else 1; r, c, ok = cell_index(x, y, z, sub); bad = 0; n = 0
    for L in LAYERS:
        band = V[L]; g = np.zeros(r.shape, np.uint8); g[ok] = band[r[ok], c[ok]]
        if sub > 1: g = g.reshape(256, sub, 256, sub).max(axis=(1, 3))
        im = np.array(Image.open(f"baked/tiles-merc/{L}/{z}/{x}/{y}.webp").convert("RGBA"))
        lut = INV[L]  # rgba tuple -> band
        dec = np.zeros(g.shape, np.uint8)
        flat = im.reshape(-1, 4); keys = (flat[:, 0].astype(np.uint32) << 24) | (flat[:, 1].astype(np.uint32) << 16) | (flat[:, 2].astype(np.uint32) << 8) | flat[:, 3]
        out = np.zeros(len(keys), np.int32)
        for k, b in lut.items(): out[keys == k] = b
        unknown = ~np.isin(keys, list(lut.keys())); bad += int(unknown.sum())
        bad += int((out.reshape(g.shape) != g).sum()); n += g.size
    return bad, n
def init():
    global V, INV
    V = {L: np.load(f"master/{L}.npz")["band"] for L in LAYERS}; INV = {}
    for L in LAYERS:
        t = bake_tiles.lut(L); INV[L] = {int((int(t[b][0]) << 24) | (int(t[b][1]) << 16) | (int(t[b][2]) << 8) | int(t[b][3])): b for b in range(256) if t[b][3] or b == 0}
        INV[L].setdefault(0, 0)
if __name__ == "__main__":
    from merc import tile_range
    jobs = [(z, x, y) for z in range(8, 14) for x in range(tile_range(z)[0], tile_range(z)[1] + 1) for y in range(tile_range(z)[2], tile_range(z)[3] + 1)]
    with Pool(8, initializer=init) as p: res = p.map(check, jobs, chunksize=8)
    print(json.dumps({"tile_positions": len(jobs), "layer_tiles": len(jobs) * 12, "pixels": sum(r[1] for r in res), "mismatching_pixels": sum(r[0] for r in res), "lossless": sum(r[0] for r in res) == 0}))
