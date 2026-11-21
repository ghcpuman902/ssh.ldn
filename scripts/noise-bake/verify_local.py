import json, gzip, numpy as np, math
src=json.load(open("local_activity.json")); idx=json.load(open("baked/grid/index.json")); W=src["weights"]
E0,NTOP=502005,203005
def A(d): d=max(d,10.0); return 20*math.log10(d/10)+0.05*(d-10)
def cell(name,r,c):
    p=f"baked/grid/{name}/0/{c//256}_{r//256}.gz"
    try: t=np.frombuffer(gzip.decompress(open(p,'rb').read()),np.uint8).reshape(256,256)
    except FileNotFoundError: return 0
    return int(t[r%256,c%256])
rng=np.random.default_rng(1); bad=0; n=0
road={p:np.load(f"master/road_{p}.npz") for p in ("Lday","Lnight")}
for slot in src["slots"]:
  night=slot.endswith("night"); P="Lnight" if night else "Lday"
  feats=[f for f in src["features"] if f["activity"][slot]>0]
  for _ in range(60):
    f=feats[rng.integers(len(feats))]; c=int((f["e"]-E0)//10)+int(rng.integers(-12,13)); r=int((NTOP-f["n"])//10)+int(rng.integers(-12,13))
    if not (0<=r<5000 and 0<=c<6000): continue
    ce=E0+(c+.5)*10; cn=NTOP-(r+.5)*10; E=0
    for g in feats:
      d=math.hypot(ce-g["e"],cn-g["n"])
      if d>2100: continue
      L=66+10*math.log10(W[g["amenity"]]*g["activity"][slot])-A(d)
      if L>=35: E+=10**(L/10)
    L=10*math.log10(E) if E>0 else 0
    want=0 if L<35 else round(L*2); got=cell(f"local_{slot}",r,c)
    rdb=road[P]["db05"][r,c]/2; rb=int(road[P]["band"][r,c])
    if got:
      comb=10*math.log10((10**(rdb/10) if rdb>0 else 0)+10**(got/20)); lo,top=(30,10) if night else (35,9)
      cb=0 if comb<lo+5 else min(top,int((comb-lo)//5)); wantb=max(rb,cb)
    else: wantb=rb
    gotb=cell(f"roadlocal_{slot}",r,c); n+=1
    if abs(want-got)>1 or wantb!=gotb: bad+=1; print("BAD",slot,r,c,want,got,wantb,gotb)
print("checked",n,"bad",bad)
