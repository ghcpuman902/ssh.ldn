"""Bake London DEFRA layers: master 10 m grid (0.5 dB byte + band), WebP band pyramid, dB point archive.
Grid: BNG, top-left cell edge E=502005 N=203005, 10 m cells, 6000 cols x 5000 rows.
Decoding stretch v (1..255): road/rail db = max*(v-0.5)/254 (v>=2), v==255 -> max; airport min+(max-min)*(v-0.5)/254 ..."""
import os, sys, json, glob, gzip, io, time, logging, numpy as np, tifffile
from PIL import Image
logging.disable(50)
E0, NTOP, CELL, W, H = 502005, 203005, 10, 6000, 5000
LAYERS = [f"{k}_{p}" for k in ("road", "rail", "airport") for p in ("Lden", "Lday", "Leve", "Lnight")]
cal = {}
for l in open("calib.jsonl"):
    r = json.loads(l); cal[r["file"]] = r
def decode_db(s, nod, rec, kind):
    s = s.astype(np.float64); out = np.zeros(s.shape, np.float64)
    mx = rec["max"]["db"]
    if kind == "airport":
        # linear through both calibrated cells (the top valid cell can be v=254 when no-data takes 255)
        mn = rec["min"]["db"]; v0 = rec["min"]["v"]; v1 = rec["max"]["v"]
        db = mn + (mx - mn) * (s - v0) / max(1, v1 - v0)
    else:
        db = mx * (s - 0.5) / 254
    if kind != "airport": db[s >= 255] = mx
    out[~nod] = db[~nod]; return out
def master(L):
    kind = L.split("_")[0]
    db05 = np.zeros((H, W), np.uint8); band = np.zeros((H, W), np.uint8); missing = []
    for j in range(5):
        for i in range(6):
            E, N = E0 + i * 10000, 153005 + j * 10000
            f = f"raw/{L}/{L}_E{E}_N{N}.stretch.tif"
            if not os.path.exists(f) or f not in cal: missing.append(f); continue
            s = tifffile.imread(f); b = tifffile.imread(f.replace(".stretch.", ".band.")).astype(np.uint8)
            nod = (b == 0) if kind != "airport" else ((b == 0) | (b >= 10))
            r0 = (NTOP - (N + 10000)) // 10; c0 = (E - E0) // 10
            rec = cal[f]
            if not rec.get("empty"):
                db = decode_db(s, nod, rec, kind)
                q = np.where(nod, 0, np.clip(np.round(db * 2), 1, 255)).astype(np.uint8)
                db05[r0:r0+1000, c0:c0+1000] = q
            bb = b.copy(); bb[nod] = 0
            band[r0:r0+1000, c0:c0+1000] = bb
    return db05, band, missing
def webp(a):
    bio = io.BytesIO(); Image.fromarray(a, "L").save(bio, "WEBP", lossless=True, quality=100, method=6); return bio.getvalue()
def pyramid(L, band, out):
    sizes = {}; a = band; z = 0; tiles = {}
    while True:
        cell = CELL * 2 ** z; n_c = -(-a.shape[1] // 256); n_r = -(-a.shape[0] // 256)
        pad = np.zeros((n_r * 256, n_c * 256), np.uint8); pad[:a.shape[0], :a.shape[1]] = a
        tot = 0; cnt = 0
        for y in range(n_r):
            for x in range(n_c):
                t = pad[y*256:(y+1)*256, x*256:(x+1)*256]
                if not t.any(): continue
                b = webp(t); d = f"{out}/tiles/{L}/{z}"; os.makedirs(d, exist_ok=True)
                open(f"{d}/{x}_{y}.webp", "wb").write(b); tot += len(b); cnt += 1
        sizes[z] = {"cell_m": cell, "cols": n_c, "rows": n_r, "tiles": cnt, "bytes": tot}
        if n_c == 1 and n_r == 1: break
        h2, w2 = -(-a.shape[0] // 2) * 2, -(-a.shape[1] // 2) * 2
        p = np.zeros((h2, w2), np.uint8); p[:a.shape[0], :a.shape[1]] = a
        a = p.reshape(h2 // 2, 2, w2 // 2, 2).max(axis=(1, 3)); z += 1
    return sizes
if __name__ == "__main__":
    out = "baked"; os.makedirs("master", exist_ok=True); os.makedirs(out, exist_ok=True)
    report = json.load(open(f"{out}/report.json")) if os.path.exists(f"{out}/report.json") else {}
    for L in (sys.argv[1:] or LAYERS):
        t0 = time.time(); db05, band, missing = master(L)
        np.savez_compressed(f"master/{L}.npz", db05=db05, band=band)
        sz = pyramid(L, band, out)
        report[L] = {"missing": len(missing), "pyramid": sz, "valid_cells": int((band > 0).sum()), "s": round(time.time() - t0, 1)}
        print(L, json.dumps(report[L]), flush=True)
        json.dump(report, open(f"{out}/report.json", "w"), indent=1)
