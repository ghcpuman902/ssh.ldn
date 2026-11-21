"""Shader data: per layer, a max-band pyramid of 256x256-cell chunks as raw uint8 gzip (row-major, row 0 = north edge).
Level 0 is the exact 10 m master band plane (the same plane points/ holds). Level k cell = 10*2^k m, value = max band of its 2^k x 2^k cells.
Out: baked/grid/index.json, baked/grid/<L>/<k>/<x>_<y>.gz (only non-empty chunks)."""
import os, json, gzip, time, numpy as np
from bake import LAYERS, E0, NTOP, CELL, W, H
OUT = "baked/grid"; T = 256; idx = {"format": "ssh-ldn-noise-grid", "version": 1, "crs": "EPSG:27700", "originE": E0, "originN": NTOP,
  "cellMeters": CELL, "chunkCells": T, "gridCols": W, "gridRows": H, "encoding": "gzip(uint8[256*256]) row-major, row 0 = north, value = DEFRA band (0 = none)",
  "levels": {}, "layers": {}}
for L in LAYERS:
    a = np.load(f"master/{L}.npz")["band"]; k = 0; idx["layers"][L] = {}
    while True:
        nc, nr = -(-a.shape[1] // T), -(-a.shape[0] // T)
        pad = np.zeros((nr*T, nc*T), np.uint8); pad[:a.shape[0], :a.shape[1]] = a; present = []
        for y in range(nr):
            for x in range(nc):
                t = pad[y*T:(y+1)*T, x*T:(x+1)*T]
                if not t.any(): continue
                d = f"{OUT}/{L}/{k}"; os.makedirs(d, exist_ok=True)
                open(f"{d}/{x}_{y}.gz", "wb").write(gzip.compress(t.tobytes(), 9, mtime=0)); present.append(y*nc + x)
        idx["levels"][str(k)] = {"cellMeters": CELL*2**k, "cols": nc, "rows": nr, "levelCols": int(a.shape[1]), "levelRows": int(a.shape[0])}
        idx["layers"][L][str(k)] = present
        if nc == 1 and nr == 1: break
        h2, w2 = -(-a.shape[0]//2)*2, -(-a.shape[1]//2)*2; p = np.zeros((h2, w2), np.uint8); p[:a.shape[0], :a.shape[1]] = a
        a = p.reshape(h2//2, 2, w2//2, 2).max(axis=(1, 3)); k += 1
    print(L, flush=True)
idx["built"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
json.dump(idx, open(f"{OUT}/index.json", "w"))
