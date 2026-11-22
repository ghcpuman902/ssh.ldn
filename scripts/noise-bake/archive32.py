"""Point-lookup archive: 128x128-cell chunks, each record = gzip(for layer in LAYERS: db05 plane, band plane).
Writes baked/points/index.json + baked/points/data.bin. Empty chunks have length 0."""
import os, json, gzip, time, numpy as np
from bake import LAYERS, E0, NTOP, CELL, W, H
C = int(os.environ.get('CHUNK', 32)); OUTD = os.environ.get('OUTD', 'baked/points32'); cols, rows = -(-W // C), -(-H // C)
present = [L for L in LAYERS if os.path.exists(f"master/{L}.npz")]
planes = {}
for L in LAYERS:
    if L in present:
        z = np.load(f"master/{L}.npz"); d = np.zeros((rows*C, cols*C), np.uint8); b = d.copy()
        d[:H, :W] = z["db05"]; b[:H, :W] = z["band"]; planes[L] = (d, b)
os.makedirs(OUTD, exist_ok=True)
offs, lens = [], []; pos = 0; raw_total = 0
with open(f"{OUTD}/data.bin", "wb") as f:
    for y in range(rows):
        for x in range(cols):
            parts = []; anyv = False
            for L in LAYERS:
                if L in planes:
                    d, b = planes[L]; pd = d[y*C:(y+1)*C, x*C:(x+1)*C]; pb = b[y*C:(y+1)*C, x*C:(x+1)*C]
                    anyv |= bool(pd.any() or pb.any()); parts += [pd.tobytes(), pb.tobytes()]
                else: parts += [bytes(C*C), bytes(C*C)]
            if not anyv: offs.append(pos); lens.append(0); continue
            raw = b"".join(parts); raw_total += len(raw)
            g = gzip.compress(raw, 9, mtime=0); f.write(g); offs.append(pos); lens.append(len(g)); pos += len(g)
idx = {"format": "ssh-ldn-noise-points", "version": 2, "crs": "EPSG:27700", "originE": E0, "originN": NTOP, "cellMeters": CELL,
       "chunkCells": C, "cols": cols, "rows": rows, "gridCols": W, "gridRows": H, "layers": LAYERS, "layersPresent": present,
       "planes": ["db05", "band"], "db05": "value/2 = dB; 0 = no data or below DEFRA's mapping threshold",
       "band": "DEFRA band index from the unstyled WMS GeoTIFF; 0 = no data. Airport bands use DEFRA's airport scale.",
       "compression": "gzip", "indexBin": "index.bin", "indexBinFormat": "uint32 little-endian pairs [offset, length] per chunk, row-major, length 0 = empty chunk", "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
       "source": "DEFRA Strategic Noise Mapping Round 4 (2021), environment.data.gov.uk WMS, native 10 m",
       "attribution": "Contains public sector information licensed under the Open Government Licence v3.0. © Department for Environment, Food & Rural Affairs copyright and/or database right 2023."}
json.dump(idx, open(f"{OUTD}/index.json", "w"))
open(f"{OUTD}/index.bin", "wb").write(np.array([v for p in zip(offs, lens) for v in p], dtype="<u4").tobytes())
nz = [l for l in lens if l]
print(json.dumps({"chunks": len(lens), "nonempty": len(nz), "data_bytes": pos, "max_chunk": max(nz) if nz else 0,
                  "median_chunk": int(np.median(nz)) if nz else 0, "index_bin_bytes": os.path.getsize(f"{OUTD}/index.bin"), "present": present}))
