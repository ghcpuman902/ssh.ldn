"""Coverage1: fetch the DEFRA chunks around the original 6x5 London block so the grid covers the map's maxBounds.
New block: 8x7 chunks, E 492005..572005, N 143005..213005 (the original 30 are skipped). One worker per dataset,
GAP s between requests per worker, band + stretch GeoTIFF per chunk, then GFI calibration into calib.jsonl."""
import os, sys, json, time, threading, hashlib, urllib.request, urllib.parse, urllib.error, logging, numpy as np, tifffile
logging.disable(50)
UA = "ssh-ldn-research/1.0 (one-off London noise-map download, OGL v3; contact via ssh-ldn.app)"
DS = {"road": "562c9d56-7c2d-4d42-83bb-578d6e97a517", "rail": "3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947", "airport": "dac9cba4-abe7-43bd-b8e9-8a83da52edd8"}
def lname(k, p): return {"road": f"Road_Noise_{p}_England_Round_4_All", "rail": f"Rail_Noise_{p}_England_Round_4_All", "airport": f"Airport_Noise_ALL_{p}"}[k]
GAP = float(os.environ.get("GAP", "8")); lock = threading.Lock()
CHUNKS = [(492005 + i * 10000, 143005 + j * 10000) for j in range(7) for i in range(8) if not (1 <= i <= 6 and 1 <= j <= 5)]
def log(m):
    with lock: open("fetch_ext.log", "a").write(time.strftime("%H:%M:%S ") + m + "\n")
class W:
    def __init__(s, k): s.k = k; s.last = 0.0
    def get(s, q):
        u = f"https://environment.data.gov.uk/geoservices/datasets/{DS[s.k]}/wms?" + urllib.parse.urlencode(q)
        for a in range(10):
            w = GAP - (time.time() - s.last)
            if w > 0: time.sleep(w)
            s.last = time.time()
            try: return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read()
            except urllib.error.HTTPError as e:
                if e.code != 429 and e.code < 500: raise
                b = min(600, 30 * 2 ** a); log(f"{s.k} HTTP {e.code} backoff {b}"); time.sleep(b)
            except Exception as e:
                b = min(600, 30 * 2 ** a); log(f"{s.k} err {e!r} backoff {b}"); time.sleep(b)
        raise SystemExit("giving up " + u)
    def gfi(s, layer, e, n):
        q = dict(SERVICE="WMS", VERSION="1.3.0", CRS="EPSG:27700", REQUEST="GetFeatureInfo", LAYERS=layer, QUERY_LAYERS=layer,
                 BBOX=f"{e-5},{n-5},{e+5},{n+5}", WIDTH=1, HEIGHT=1, I=0, J=0, INFO_FORMAT="application/json")
        f = json.loads(s.get(q)).get("features") or []
        return f[0]["properties"].get("GRAY_INDEX") if f else None
    def run(s):
        done = {json.loads(l)["file"] for l in open("calib.jsonl")}; rng = np.random.default_rng(7)
        for p in ("Lden", "Lnight", "Lday", "Leve"):
            L = f"{s.k}_{p}"; layer = lname(s.k, p); os.makedirs(f"raw/{L}", exist_ok=True)
            for e, n in CHUNKS:
                paths = {}
                for st, nm in (("", "band"), ("raster", "stretch")):
                    path = f"raw/{L}/{L}_E{e}_N{n}.{nm}.tif"; paths[nm] = path
                    if os.path.exists(path) and os.path.getsize(path) > 1000: continue
                    q = dict(SERVICE="WMS", VERSION="1.3.0", CRS="EPSG:27700", REQUEST="GetMap", LAYERS=layer, STYLES=st,
                             FORMAT="image/geotiff", BBOX=f"{e},{n},{e+10000},{n+10000}", WIDTH=1000, HEIGHT=1000)
                    b = s.get(q)
                    if b[:4] not in (b"II*\x00", b"MM\x00*"): log(f"NOT TIFF {path} {b[:120]!r}"); raise SystemExit(1)
                    open(path + ".part", "wb").write(b); os.replace(path + ".part", path)
                    with lock: open("manifest_ext.jsonl", "a").write(json.dumps({"file": path, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}) + "\n")
                f = paths["stretch"]
                if f in done: continue
                sv_ = tifffile.imread(f); bd = tifffile.imread(paths["band"])
                nod = (bd == 0) if s.k != "airport" else ((bd == 0) | (bd >= 10))
                rec = {"file": f, "layer": L, "E": e, "N": n}
                if nod.all(): rec["empty"] = True
                else:
                    sv = np.where(nod, -1, sv_.astype(int)); r, c = np.unravel_index(np.argmax(sv), sv.shape)
                    rec["max"] = {"r": int(r), "c": int(c), "v": int(sv_[r, c]), "db": s.gfi(layer, e + 10*int(c) + 5, n + 10000 - 10*int(r) - 5)}
                    if s.k == "airport" or rng.random() < 0.1:
                        sv = np.where(nod, 999, sv_.astype(int)); r, c = np.unravel_index(np.argmin(sv), sv.shape)
                        rec["min"] = {"r": int(r), "c": int(c), "v": int(sv_[r, c]), "db": s.gfi(layer, e + 10*int(c) + 5, n + 10000 - 10*int(r) - 5)}
                    if s.k != "airport": rec["nodata_v"] = int(np.unique(sv_[nod])[0]) if nod.any() else None
                with lock: open("calib.jsonl", "a").write(json.dumps(rec) + "\n")
                log(f"ok {f} {'empty' if rec.get('empty') else rec['max']['db']}")
            log(f"layer done {L}")
ks = sys.argv[1:] or ["road", "rail", "airport"]
ts = [threading.Thread(target=W(k).run) for k in ks]; [t.start() for t in ts]; [t.join() for t in ts]; log("ALL DONE")
