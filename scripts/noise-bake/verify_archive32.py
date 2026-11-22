import json, gzip, numpy as np, os
from bake import LAYERS, W, H
D = "baked/points32"; idx = json.load(open(f"{D}/index.json")); C = idx["chunkCells"]; cols, rows = idx["cols"], idx["rows"]
ib = np.frombuffer(open(f"{D}/index.bin", "rb").read(), "<u4").reshape(-1, 2); data = open(f"{D}/data.bin", "rb").read()
assert len(ib) == cols * rows
bad = 0; chunks = 0; cells = 0
for L_i, L in enumerate(LAYERS):
    pass
masters = {L: np.load(f"master/{L}.npz") for L in LAYERS}
pad = {}
for L in LAYERS:
    d = np.zeros((rows*C, cols*C), np.uint8); b = d.copy(); d[:H, :W] = masters[L]["db05"]; b[:H, :W] = masters[L]["band"]; pad[L] = (d, b)
for y in range(rows):
    for x in range(cols):
        off, ln = ib[y * cols + x]
        if ln == 0:
            for L in LAYERS:
                d, b = pad[L]
                if d[y*C:(y+1)*C, x*C:(x+1)*C].any() or b[y*C:(y+1)*C, x*C:(x+1)*C].any(): bad += 1
            continue
        raw = gzip.decompress(data[off:off+ln]); chunks += 1; p = 0
        for L in LAYERS:
            d, b = pad[L]
            for plane in (d, b):
                a = np.frombuffer(raw[p:p+C*C], np.uint8).reshape(C, C); p += C*C
                if not np.array_equal(a, plane[y*C:(y+1)*C, x*C:(x+1)*C]): bad += 1
        assert p == len(raw)
print(json.dumps({"chunks_checked": chunks, "mismatching_planes": bad, "lossless": bad == 0}))
