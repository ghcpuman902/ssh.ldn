"""Upload tree for public Blob: points/ (the v2 32-cell archive, from baked/points32) + grid/ (shader chunks). No Mercator tiles.
Hash = first 12 hex of sha256 over sorted (path, sha256) lines. Writes baked/upload-manifest.json and stages baked/upload/."""
import os, json, hashlib, shutil
SRC = {"points": "baked/points32", "grid": "baked/grid"}; OUT = "baked/upload"
shutil.rmtree(OUT, ignore_errors=True); entries = []
for dst, src in SRC.items():
    for d, _, fs in os.walk(src):
        for f in sorted(fs):
            p = os.path.join(d, f); rel = dst + "/" + os.path.relpath(p, src)
            b = open(p, "rb").read(); entries.append([rel, hashlib.sha256(b).hexdigest(), len(b)])
            os.makedirs(os.path.dirname(f"{OUT}/{rel}"), exist_ok=True); shutil.copyfile(p, f"{OUT}/{rel}")
entries.sort(); h = hashlib.sha256("".join(f"{r} {s}\n" for r, s, _ in entries).encode()).hexdigest()[:12]
m = {"hash": h, "prefix": f"noise/{h}/", "files": len(entries), "bytes": sum(e[2] for e in entries),
     "cacheControl": "public, max-age=31536000, immutable", "entries": entries}
json.dump(m, open("baked/upload-manifest.json", "w")); print(h, len(entries), m["bytes"])
