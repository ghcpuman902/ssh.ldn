import glob, io, json, collections, numpy as np
from PIL import Image
from merc import sample_band
P = {"day": "Lday", "night": "Lnight", "evening": "Leve", "all": "Lden"}
out = {}
for kind in ("road", "rail", "airport"):
    for per, pl in P.items():
        L = f"{kind}_{pl}"; band = np.load(f"master/{L}.npz")["band"]
        H = collections.defaultdict(collections.Counter)
        for f in glob.glob(f"styled/tiles/{kind}/{per}/12/*/*.png"):
            x, y = f[:-4].split('/')[-2:]
            x, y = int(x), int(y)
            im = np.array(Image.open(f).convert("RGBA")); b = sample_band(band, x, y, 12)
            for bv in np.unique(b):
                m = b == bv
                cols, cnt = np.unique(im[m].reshape(-1, 4), axis=0, return_counts=True)
                for c, n in zip(cols, cnt): H[int(bv)][tuple(int(v) for v in c)] += int(n)
        res = {}
        for bv, cn in sorted(H.items()):
            tot = sum(cn.values()); top = cn.most_common(3)
            res[bv] = {"rgba": top[0][0], "share": round(top[0][1] / tot, 3), "runner": top[1:2], "n": tot}
        out[L] = res; print(L, {k: (v["rgba"], v["share"]) for k, v in res.items()}, flush=True)
json.dump(out, open("palette_derived.json", "w"), default=list)
