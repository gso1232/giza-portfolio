"""
The loop's frames put together and finished (tools/blender/loop.py rendered the parts): the
still base, the plants' part laid in with a soft edge, the steam over it by its alpha, the dust
added, then the stills' finishing (exposure, bloom, vignette, the cool shade, grain) and H.264.

  python tools/blender/loop_finish.py <dir> <out.mp4> [--fps 24] [--exposure -0.9] [--dust 1.5]

A preview of a loop still rendering: --frames n takes the first n, --pingpong plays them forward
then back so the half loop has no jump.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

d, out = sys.argv[1], sys.argv[2]
arg = lambda k, v: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else v
fps = int(arg('--fps', 24))
R = json.load(open(f'{d}/regions.json'))
W, H, N = R['w'], R['h'], R['frames']
N = int(arg('--frames', N))
exposure = 2 ** arg('--exposure', -0.9)
dust_gain, bloom, vig, split, grain = arg('--dust', 1.5), arg('--bloom', 0.08), arg('--vignette', 0.28), arg('--split', 0.3), arg('--grain', 0.006)

from tone import neutral, srgb8                                    # the stills' own tone map
base = np.load(f'{d}/base.npy').astype(np.float32)
# the haze's own light (the base with it, less the base without): the parts are rendered clear
haze = base - np.load(f'{d}/base-clear.npy').astype(np.float32) if os.path.exists(f'{d}/base-clear.npy') else 0 * base
# the swappable pictures (tools/blender/cards.py): --posters <dir> of poster_<key>.png
posters = sys.argv[sys.argv.index('--posters') + 1] if '--posters' in sys.argv else None
card_map, pics = None, {}
if posters and os.path.exists(f'{d}/cards.npy'):
    import cards as C
    card_map = np.load(f'{d}/cards.npy')
    pics = {i: C.load_picture(f'{posters}/{n}.png') for i, n in enumerate(json.load(open(f'{d}/cards.json')), 1) if os.path.exists(f'{posters}/{n}.png')}


def feather(h, w, px):
    """a mask 1 inside, falling to 0 over `px` at the edges (so a part lays in without a seam)"""
    y = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None] / px
    x = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :] / px
    m = np.clip(np.minimum(x, y), 0, 1)
    return (m * m * (3 - 2 * m))[..., None].astype(np.float32)


x0, y0, x1, y1 = R['plants']
pm = feather(y1 - y0, x1 - x0, 40)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r2 = ((xx - W / 2) / (W / 2)) ** 2 * 0.7 + ((yy - H / 2) / (H / 2)) ** 2 * 0.3
vmask = (1 - vig * r2 ** 1.1)[..., None]
keep = [int(v) for v in sys.argv[sys.argv.index('--keep') + 1].split(',')] if '--keep' in sys.argv else None
if keep:
    kx0, ky0, kx1, ky1 = keep
    km = feather(ky1 - ky0, kx1 - kx0, 6)
tmp = tempfile.mkdtemp()
rng = np.random.default_rng(3)
for f in range(N):
    img = base.copy()
    p = np.load(f'{d}/p-{f:03d}.npy').astype(np.float32)[..., :3]
    ph, pw = min(p.shape[0], y1 - y0), min(p.shape[1], x1 - x0)          # (as rendered: a pixel's rounding either way)
    p = p[:ph, :pw] + haze[y0:y0 + ph, x0:x0 + pw]
    img[y0:y0 + ph, x0:x0 + pw] = img[y0:y0 + ph, x0:x0 + pw] * (1 - pm[:ph, :pw]) + p * pm[:ph, :pw]
    if keep:                                    # (a still picture the plants' old frames never saw: the base's own)
        img[ky0:ky1, kx0:kx1] = img[ky0:ky1, kx0:kx1] * (1 - km) + base[ky0:ky1, kx0:kx1] * km
    if R['steam'] and os.path.exists(f'{d}/s-{f:03d}.npy'):
        sx0, sy0, sx1, sy1 = R['steam']
        s = np.load(f'{d}/s-{f:03d}.npy').astype(np.float32)[..., :3]
        sh_, sw_ = min(s.shape[0], sy1 - sy0), min(s.shape[1], sx1 - sx0)
        s = s[:sh_, :sw_] + haze[sy0:sy0 + sh_, sx0:sx0 + sw_]
        sm = feather(sh_, sw_, 12)
        img[sy0:sy0 + sh_, sx0:sx0 + sw_] = img[sy0:sy0 + sh_, sx0:sx0 + sw_] * (1 - sm) + s * sm
    if card_map is not None:
        img = C.apply(img, card_map, pics)
    if os.path.exists(f'{d}/d-{f:03d}.npy'):
        img += np.load(f'{d}/d-{f:03d}.npy').astype(np.float32)[..., :3] * dust_gain
    img = np.nan_to_num(img) * exposure
    if bloom > 0:
        bright = np.maximum(img - 0.9, 0)
        k = W / 1920
        img = img + sum(cv2.GaussianBlur(bright, (0, 0), s * k) * wgt for s, wgt in ((4, 0.5), (16, 0.3), (48, 0.2))) * bloom
    img = img * vmask
    o = neutral(img)
    if split > 0:
        lum = (o @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
        shade = np.clip(1 - lum / 0.35, 0, 1) ** 2
        o = o * (1 + split * shade * np.array([-0.35, -0.05, 0.45], np.float32))
    res = srgb8(o)
    if grain > 0:
        res = np.clip(res.astype(np.float32) + rng.normal(0, grain * 255, (H, W, 1)), 0, 255).astype(np.uint8)
    cv2.imwrite(f'{tmp}/{f:03d}.png', res)
    if f == 0:
        cv2.imwrite(out.rsplit('.', 1)[0] + '-poster.jpg', res, [cv2.IMWRITE_JPEG_QUALITY, 92])
if '--pingpong' in sys.argv:                                       # back again: N-2 .. 1 after the N frames
    import shutil
    for i, f in enumerate(range(N - 2, 0, -1)):
        shutil.copy(f'{tmp}/{f:03d}.png', f'{tmp}/{N + i:03d}.png')
# H.264 at crf 18 (--crf), optionally scaled to --width (the phone's loop at 900 is 1.5 MB, not 10).
# At the wrap the one keyframe differs from the frames before it by under one level over flat areas
# (the mean step looks 1.6-2.7x a normal one) but its strongest local change (99.5th percentile)
# is no bigger than any other step's: it cannot be seen, and -tune grain only tripled the size
width = int(arg('--width', 0))
enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', str(int(arg('--crf', 18))), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an']
if width:
    enc = ['-vf', f'scale={width}:-2:flags=lanczos'] + enc
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', f'{tmp}/%03d.png', *enc, out], check=True)
print('wrote', out, N, 'frames at', fps, 'fps')
