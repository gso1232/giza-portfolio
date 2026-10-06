"""
One frame of the room's loop, finished: the two traced light layers (src/desk-render.js
traceLoopFrame 'base' and 'sun', denoised with LINEAR=1) and the air (airPass: dust, and
steam lit by the sun and by the room), added in linear with the stills' balance (the
room's shade cool and dim, the sun warm), then tone mapped.

  python tools/loop-frame.py <shots dir> <base name> <sun name> <air png> <out> [dust gain] [steam gain]
"""
import json, sys
import numpy as np
import cv2

shots, bname, sname, air, out = sys.argv[1:6]
kd = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
ks = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0
SCALE = 4.0                                     # airPass's `scale`

cool = np.array([0.85, 0.95, 1.15], np.float32) * 0.4
warm = np.array([1.0, 0.9, 0.78], np.float32)


def neutral(c, exposure):
    c = c * exposure
    start, desat = 0.8 - 0.04, 0.15
    x = np.min(c, axis=2, keepdims=True)
    c = c - np.where(x < 0.08, x - 6.25 * x * x, 0.04)
    peak = np.max(c, axis=2, keepdims=True)
    dd = 1 - start
    new_peak = 1 - dd * dd / np.maximum(peak + dd - start, 1e-6)
    comp = c * (new_peak / np.maximum(peak, 1e-6))
    g = 1 - 1 / (desat * (peak - new_peak) + 1)
    comp = comp * (1 - g) + new_peak * g
    return np.where(peak < start, c, comp)


def srgb8(c):
    c = np.clip(c, 0, 1)
    c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    return (c[..., ::-1] * 255 + 0.5).astype(np.uint8)


b = np.nan_to_num(np.load(f'{shots}/{bname}-linear.npy').astype(np.float32))
s = np.nan_to_num(np.load(f'{shots}/{sname}-linear.npy').astype(np.float32))
exposure = json.load(open(f'{shots}/{bname}.json'))['exposure'] * 0.9
a = cv2.imread(air, cv2.IMREAD_COLOR)[..., ::-1].astype(np.float32) / 255
if a.shape[:2] != b.shape[:2]:
    a = cv2.resize(a, (b.shape[1], b.shape[0]), interpolation=cv2.INTER_AREA)
a = np.power(a, 2.2) / SCALE                   # back to linear light
dust, steam_sun, steam_room = a[..., 0:1], a[..., 1:2], a[..., 2:3]
# the air takes the colour of what lights it: the sun's warm light, the room's cool shade
img = b * cool + s * warm + (dust * kd + steam_sun * ks) * warm * 1.6 + steam_room * ks * cool * 2.0
img = srgb8(neutral(img, exposure))
dead = img.sum(axis=2) == 0
if dead.any():
    img[dead] = cv2.medianBlur(img, 5)[dead]
cv2.imwrite(out, img, [cv2.IMWRITE_JPEG_QUALITY, 93] if out.endswith('.jpg') else [])
print('wrote', out, img.shape)
