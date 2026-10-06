"""
A Blender frame, finished: the main render (denoised, linear) and its dust pass (linear, not
denoised) added in light, the exposure set, then the same Khronos PBR Neutral tone map and
sRGB the site's pictures always had.

  python tools/blender/finish.py <base> <out.png|jpg> [--exposure -0.9] [--dust 1.0]

<base> is desk.py's --out without the extension (it wrote <base>-main.exr, <base>-dust.exr).
"""
import os, sys
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
import cv2
import numpy as np

base, out = sys.argv[1], sys.argv[2]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
exposure = 2 ** arg('--exposure', -0.9)
dust_gain = arg('--dust', 1.0)


def read(p):
    p = p[:-4] + '.npy'                                         # desk.py saves each EXR's pixels so
    return np.load(p).astype(np.float32) if os.path.exists(p) else None


def neutral(c):
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


img = np.nan_to_num(read(base + '-main.exr'))
# the swappable pictures back in (tools/blender/cards.py): from --posters <dir> (poster_<key>.png)
posters = sys.argv[sys.argv.index('--posters') + 1] if '--posters' in sys.argv else None
if posters and os.path.exists(base + '-cards.npy'):
    import json
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cards as C
    names = json.load(open(base + '-cards.json'))
    pics = {i: C.load_picture(f'{posters}/{n}.png') for i, n in enumerate(names, 1) if os.path.exists(f'{posters}/{n}.png')}
    img = C.apply(img, np.load(base + '-cards.npy'), pics)
dust = read(base + '-dust.exr')
if dust is not None:
    img = img + np.nan_to_num(dust)[..., :3] * dust_gain
img = img * exposure
H, W = img.shape[:2]
k = W / 1920
# the lens, as a film camera's would: the brightest light blooming softly into its surroundings,
# the corners a little darker (both in light, before the tone map)
bloom = arg('--bloom', 0.0)
if bloom > 0:
    bright = np.maximum(img - 0.9, 0)
    glow = sum(cv2.GaussianBlur(bright, (0, 0), s * k) * wgt for s, wgt in ((4, 0.5), (16, 0.3), (48, 0.2)))
    img = img + glow * bloom
vig = arg('--vignette', 0.0)
if vig > 0:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r2 = ((xx - W / 2) / (W / 2)) ** 2 * 0.7 + ((yy - H / 2) / (H / 2)) ** 2 * 0.3
    img = img * (1 - vig * r2 ** 1.1)[..., None]
out_lin = neutral(img)
# the grade: the shadows a shade cooler, as the sky's light in the shade is (a film's split tone)
split = arg('--split', 0.0)
if split > 0:
    lum = (out_lin @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
    shade = np.clip(1 - lum / 0.35, 0, 1) ** 2
    out_lin = out_lin * (1 + split * shade * np.array([-0.35, -0.05, 0.45], np.float32))
res = srgb8(out_lin)
grain = arg('--grain', 0.0)
if grain > 0:
    rng = np.random.default_rng(int(arg('--seed', 1)))
    n = rng.normal(0, grain * 255, (H, W, 1)).astype(np.float32)
    res = np.clip(res.astype(np.float32) + n, 0, 255).astype(np.uint8)
cv2.imwrite(out, res, [cv2.IMWRITE_JPEG_QUALITY, 94] if out.endswith('.jpg') else [])
print('wrote', out, res.shape)
