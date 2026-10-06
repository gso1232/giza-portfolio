"""
The desk site's pictures, from the render's two layers (src/desk-render.js,
traceShot layer 'base' and 'sun', denoised with LINEAR=1):

  unlit: the room in its daylight          tonemap(base)
  lit:   the same with the sun's patch     tonemap(base + sun)

Light adds in linear, so the sum is made before tone mapping; the site then
blends the two finished pictures with a moving leaf-shadow mask, which is exact
where the mask is 0 or 1 and close in between. Also the leaves mask (blurred, so
a breeze can move the leaves a few pixels) and where the laptop's display is.

  python tools/desk-layers.py <shots dir> [public/desk]
"""
import json, os, sys
import numpy as np
import cv2

shots = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'public/desk'
os.makedirs(out, exist_ok=True)
meta = json.load(open(f'{shots}/L-base.json'))
exposure = meta['exposure']


def neutral(c):
    c = c * exposure
    start, desat = 0.8 - 0.04, 0.15
    x = np.min(c, axis=2, keepdims=True)
    offset = np.where(x < 0.08, x - 6.25 * x * x, 0.04)
    c = c - offset
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


def fill_bad(img):
    bad = ~np.isfinite(img).all(axis=2)
    if bad.any():
        img[bad] = 0
        img[bad] = cv2.medianBlur(img.astype(np.float32), 5)[bad]
    return img


base = fill_bad(np.load(f'{shots}/L-base-linear.npy').astype(np.float32))
sun = fill_bad(np.load(f'{shots}/L-sun-linear.npy').astype(np.float32))
H, W = base.shape[:2]
# the balance the user chose ("C"): the room's shade a little cool and dim, the sun warm
cool = np.array([0.85, 0.95, 1.15], np.float32) * 0.4
warm = np.array([1.0, 0.9, 0.78], np.float32) * 1.0
exposure *= 0.9
pics = {'unlit': srgb8(neutral(base * cool)), 'lit': srgb8(neutral(base * cool + sun * warm))}
sizes = [3840, 2560, 1920, 1280]   # widths; the master is 3840 x 1800
for name, img in pics.items():
    # a few stray pixels can come out black (a NaN in the tracer): take them from their neighbours
    dead = img.sum(axis=2) == 0
    if dead.any():
        img[dead] = cv2.medianBlur(img, 5)[dead]
    for w in sizes:
        h = round(w * H / W)
        im = img if w == W else cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
        cv2.imwrite(f'{out}/{name}-{w}.webp', im, [cv2.IMWRITE_WEBP_QUALITY, 92])
    print(name, 'mean', img.mean().round(1))
cv2.imwrite(f'{shots}/../desk-lit-4k.png', pics['lit'])

# the light shafts: where the sun falls, smeared back along the way its light travels
# on screen (toward the upper left), fading with distance: the air lit on its way in.
# The site adds it faintly and lets dust glint in it (tools: the direction came from
# projecting the sun's direction through the 'wide' camera: right 0.943, down 0.332)
lum = lambda im: im[..., ::-1].astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32) / 255
sw, sh = 960, round(960 * H / W)
lo = lambda im: cv2.resize(im, (sw, sh), interpolation=cv2.INTER_AREA)
m = np.clip((lum(lo(pics['lit'])) - lum(lo(pics['unlit']))) * 3.0, 0, 1)
d = np.array([0.943, 0.332]); acc = np.zeros_like(m); wsum = 0
for k in range(1, 90):
    s = k * 3.0
    M = np.float32([[1, 0, -d[0] * s], [0, 1, -d[1] * s]])      # sample upstream: shift the mask downstream
    M[:, 2] *= -1
    wgt = np.exp(-k / 35)
    acc += cv2.warpAffine(m, M, (sw, sh), borderMode=cv2.BORDER_CONSTANT) * wgt
    wsum += wgt
shafts = cv2.GaussianBlur(acc / wsum, (0, 0), 4)
shafts = np.clip(shafts / max(shafts.max(), 1e-6), 0, 1)
cv2.imwrite(f'{out}/shafts-960.png', (shafts * 255).astype(np.uint8))

# the leaves: blurred wider than the leaves, so the wall right round them moves with them
m = cv2.imread(f'{shots}/M-leaves.png', cv2.IMREAD_GRAYSCALE)
m = cv2.dilate(m, np.ones((9, 9), np.uint8))
m = cv2.GaussianBlur(m, (0, 0), 10)
cv2.imwrite(f'{out}/leaves-1920.png', cv2.resize(m, (1920, round(1920 * H / W)), interpolation=cv2.INTER_AREA))

# the display's corners, as fractions of the frame (TL, TR, BR, BL)
raw = open(f'{shots}/screen-corners.json').read().strip().strip('"').replace('\\"', '"')
corners = json.loads(raw)
json.dump({'image': [W, H], 'screen': [[x / W, y / H] for x, y in corners]}, open(f'{out}/scene.json', 'w'), indent=1)
print('screen', corners)
