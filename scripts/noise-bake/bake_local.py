"""Local noise sources (OSM pubs, bars, clubs, music venues, hospitals) on the exact DEFRA 10 m BNG grid.

Model (an estimate, not measured; tune here):
  attenuation A(d) = 20 log10(max(d,10)/10) + 0.05 * max(d-10, 0)   [spherical spreading + ~0.5 dB/10 m screening]
  at 10 m a venue is LREF + 10 log10(weight x activity): LREF = 66 dB for a nightclub at full tilt, weight = the
  density design's relative source strength (WEIGHTS: pub 0.28, bar 0.34, nightclub 1, music venue 0.82,
  hospital 0.32), activity = the share of the slot it is open. Venues add as energy. With this, a busy pub
  falls to 45 dB at ~35 m and a club at ~85 m, the design's REACH_METERS (hospitals reach less: weight 0.32).
  Cells below 35 dB local get nothing.

Layers per slot s in weekday-day, weekday-night, weekend-day, weekend-night:
  local_<s>     uint8 = round(2 * local dB) (0 = under 35 dB): local sources alone.
  roadlocal_<s> uint8 = DEFRA band of road + local energy, never below the road band
                (day slots use road_Lday, nights road_Lnight; band k = [lo+5k, lo+5k+5), lo = 35 day / 30 night).
Both get the same max pyramid and chunking as bake_grid.py and are added to baked/grid/index.json.
Input: local_activity.json from scripts/noise-bake/local_activity.mjs (venue BNG from the app's own wgs84ToBng)."""
import os, json, gzip, time, numpy as np
E0, NTOP, CELL, W, H = 502005, 203005, 10, 6000, 5000  # = bake.py
OUT = "baked/grid"; T = 256
FLOOR = 35.0
LREF = 66.0
def atten(d): d = np.maximum(d, 10.0); return 20 * np.log10(d / 10) + 0.05 * (d - 10)
def band_of(L, night):
    lo, top = (30.0, 10) if night else (35.0, 9)
    b = np.floor((L - lo) / 5).astype(np.int16); b[L < lo + 5] = 0
    return np.clip(b, 0, top).astype(np.uint8)
def write_layer(idx, name, a):
    idx["layers"][name] = {}; k = 0
    while True:
        nc, nr = -(-a.shape[1] // T), -(-a.shape[0] // T)
        pad = np.zeros((nr*T, nc*T), np.uint8); pad[:a.shape[0], :a.shape[1]] = a; present = []
        for y in range(nr):
            for x in range(nc):
                t = pad[y*T:(y+1)*T, x*T:(x+1)*T]
                if not t.any(): continue
                d = f"{OUT}/{name}/{k}"; os.makedirs(d, exist_ok=True)
                open(f"{d}/{x}_{y}.gz", "wb").write(gzip.compress(t.tobytes(), 9, mtime=0)); present.append(y*nc + x)
        idx["layers"][name][str(k)] = present
        if nc == 1 and nr == 1: break
        h2, w2 = -(-a.shape[0]//2)*2, -(-a.shape[1]//2)*2; p = np.zeros((h2, w2), np.uint8); p[:a.shape[0], :a.shape[1]] = a
        a = p.reshape(h2//2, 2, w2//2, 2).max(axis=(1, 3)); k += 1
if __name__ == "__main__":
    src = json.load(open("local_activity.json")); reach = src["reachMeters"]; weight = src["weights"]
    idx = json.load(open(f"{OUT}/index.json"))
    road = {p: np.load(f"master/road_{p}.npz") for p in ("Lday", "Lnight")}
    report = {}
    for slot in src["slots"]:
        night = slot.endswith("night"); P = "Lnight" if night else "Lday"
        energy = np.zeros((H, W), np.float64); used = 0
        for f in src["features"]:
            act = f["activity"][slot]
            if act <= 0: continue
            L10 = LREF + 10 * np.log10(weight[f["amenity"]] * act)
            # radius where it falls to FLOOR
            r = 10.0
            while L10 - atten(np.array(r)) > FLOOR and r < 2000: r += 10
            c0 = int(np.floor((f["e"] - E0) / CELL)); r0 = int(np.floor((NTOP - f["n"]) / CELL)); rc = int(r // CELL) + 1
            ra, rb, ca, cb = max(0, r0 - rc), min(H, r0 + rc + 1), max(0, c0 - rc), min(W, c0 + rc + 1)
            if ra >= rb or ca >= cb: continue
            ce = E0 + (np.arange(ca, cb) + 0.5) * CELL; cn = NTOP - (np.arange(ra, rb) + 0.5) * CELL
            d = np.hypot(ce[None, :] - f["e"], cn[:, None] - f["n"])
            L = L10 - atten(d); m = L >= FLOOR
            energy[ra:rb, ca:cb] += np.where(m, 10 ** (L / 10), 0); used += 1
        local = np.where(energy > 0, 10 * np.log10(np.maximum(energy, 1e-12)), 0.0)
        local[local < FLOOR] = 0
        code = np.clip(np.round(local * 2), 0, 255).astype(np.uint8)
        rdb = road[P]["db05"].astype(np.float64) / 2; rband = road[P]["band"]
        comb = 10 * np.log10(np.where(rdb > 0, 10 ** (rdb / 10), 0) + np.where(code > 0, 10 ** (code / 20), 0) + 1e-300)
        cband = np.where(code > 0, band_of(comb, night), 0).astype(np.uint8)
        rl = np.maximum(rband, cband)
        write_layer(idx, f"local_{slot}", code); write_layer(idx, f"roadlocal_{slot}", rl)
        raised = int((rl > rband).sum())
        report[slot] = {"venues": used, "localCells": int((code > 0).sum()), "raisedCells": raised, "maxLocalDb": float(code.max() / 2),
                        "raisedBySteps": {int(s): int(((rl.astype(int) - rband) == s).sum()) for s in range(1, 6)}}
        print(slot, report[slot], flush=True)
    idx["built"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    idx["localModel"] = {"layers": "local_<slot> = round(2*dB) local sources alone (0 = <35 dB); roadlocal_<slot> = DEFRA band of road+local energy",
                         "attenuation": "20log10(d/10)+0.05(d-10), d>=10 m", "sourceAt10m": "66 + 10log10(weight*activity)", "weights": weight, "floorDb": FLOOR,
                         "reachMeters": reach, "roadPeriod": {"day": "road_Lday", "night": "road_Lnight"}}
    json.dump(idx, open(f"{OUT}/index.json", "w")); json.dump(report, open("bake_local_report.json", "w"), indent=1)
