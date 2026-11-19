"""Shared Web Mercator <-> BNG helpers for the day-2 bake."""
import math, numpy as np
from pyproj import Transformer
from bake import E0, NTOP, W, H
_t = Transformer.from_crs(4326, 27700, always_xy=True)
_tb = Transformer.from_crs(27700, 4326, always_xy=True)
lon0, lat0 = _tb.transform(E0, NTOP - H * 10); lon1, lat1 = _tb.transform(E0 + W * 10, NTOP)
def tile_xy(lon, lat, z):
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
def tile_range(z):
    xa, yb = tile_xy(lon0, lat0, z); xb, ya = tile_xy(lon1, lat1, z)
    return int(xa), int(xb), int(ya), int(yb)   # x0,x1,y0,y1 inclusive
def cell_index(tx, ty, z, sub=1):
    """For a tile, return (rows, cols, ok) index arrays shaped (256*sub,256*sub) of the 10 m cell under each sample point."""
    n = 2 ** z; px = (np.arange(256 * sub) + 0.5) / (256 * sub)
    X, Y = np.meshgrid(tx + px, ty + px)
    lon = X / n * 360 - 180; lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * Y / n))))
    e, nn = _t.transform(lon, lat)
    c = np.floor((e - E0) / 10).astype(int); r = np.floor((NTOP - nn) / 10).astype(int)
    ok = (c >= 0) & (c < W) & (r >= 0) & (r < H)
    return r, c, ok
def sample_band(band, tx, ty, z, sub=1):
    r, c, ok = cell_index(tx, ty, z, sub)
    a = np.zeros(r.shape, np.uint8); a[ok] = band[r[ok], c[ok]]
    if sub > 1:
        s = 256
        a = a.reshape(s, sub, s, sub).max(axis=(1, 3))
    return a
