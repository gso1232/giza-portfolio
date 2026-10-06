"""
Denoise a path-traced plate without softening its detail.

Inputs (all float32 RGBA, rows bottom-up, as the browser reads them back):
  <dir>/<name>-half.bin   the accumulation after the first half of the samples
  <dir>/<name>-full.bin   the accumulation after all of them
  <dir>/<name>-albedo.bin surface colour per pixel (raster pass, linear)
  <dir>/<name>-gbuf.bin   geometric normal (view space) in rgb, view depth in a
  <dir>/<name>.json       {"w", "h", "exposure", "halfSamples", "samples"}

The two halves are independent estimates (the second half is 2*full - half), so
their difference measures the noise at every pixel. Lighting is separated from
surface colour (radiance / albedo), filtered with an edge-aware a-trous wavelet
(SVGF's spatial filter: normals, depth, albedo and noise-scaled luminance stop
it at edges), then the surface colour goes back on untouched. Pinstripes, wood
grain and the printed name live in the albedo, so they come through sharp.

Finally the same tone mapping as the renderer's canvas (Khronos PBR Neutral
with exposure, then the sRGB curve) and a 16-bit PNG.

Large frames are done in overlapping tiles, read straight from the files
(memory-mapped), so a 4K square needs a few hundred MB, not 4 GB: the filter
reaches 62 px at its widest, and every tile carries a 96 px margin it drops.

  python tools/denoise.py <dir> <name> [levels]
"""
import json, math, sys, time
import numpy as np
import cv2

d, name = sys.argv[1], sys.argv[2]
LEVELS = int(sys.argv[3]) if len(sys.argv) > 3 else 5
meta = json.load(open(f'{d}/{name}.json'))
W, H = meta['w'], meta['h']
t0 = time.time()
n1, N = meta.get('halfSamples', 1), meta.get('samples', 2)
lumw = np.array([0.2126, 0.7152, 0.0722], np.float32)
K = np.array([1 / 16, 1 / 4, 3 / 8, 1 / 4, 1 / 16], np.float32)
SIG_L, SIG_N, SIG_Z, SIG_A = 4.0, 64.0, 1.0, 0.08

mem = {s: np.memmap(f'{d}/{name}-{s}.bin', dtype=np.float32, mode='r', shape=(H, W, 4)) for s in ('half', 'full', 'albedo', 'gbuf')}


def region(suffix, y0, y1, x0, x1):
    """Rows y0..y1 (top-down) and columns x0..x1 of a buffer, as a float32 copy."""
    a = np.array(mem[suffix][H - y1:H - y0, x0:x1][::-1], dtype=np.float32)
    # a path tracer now and then returns a NaN or an infinity for one pixel; left in,
    # the filter spreads it into a black square a hundred pixels wide. Take such a
    # pixel from its neighbours instead.
    bad = ~np.isfinite(a).all(axis=2)
    if bad.any():
        print(f'{suffix}: {int(bad.sum())} non-finite pixels, filled from their neighbours')
        a[bad] = 0
        filled = cv2.blur(a, (5, 5))
        w8 = cv2.blur((~bad).astype(np.float32), (5, 5))[..., None]
        a[bad] = (filled / np.maximum(w8, 1e-3))[bad]
    return a


def denoise(half, full, alb4, gb):
    h, w = half.shape[:2]
    # the second estimate is what the later samples added on their own
    A = half[..., :3]
    B = (N * full[..., :3] - n1 * A) / (N - n1)
    M = full[..., :3].copy()
    albedo = np.maximum(alb4[..., :3], 0.04)
    nrm = gb[..., :3] * 2 - 1
    nrm /= np.maximum(np.linalg.norm(nrm, axis=2, keepdims=True), 1e-6)
    depth = gb[..., 3]
    # fireflies: a pixel far brighter than its neighbourhood in both halves' mean is clamped
    lum = M @ lumw
    med = cv2.medianBlur(np.clip(lum, 0, 64).astype(np.float32), 5)
    cap = med * 4 + 0.5
    scale = np.minimum(1, cap / np.maximum(lum, 1e-6))[..., None]
    M *= scale; A = A * scale; B *= scale
    # lighting alone, and its noise
    irr = M / albedo
    var = (((A - B) / albedo) ** 2 * (n1 * (N - n1) / N ** 2)) @ lumw  # variance of the mean of all samples
    var = cv2.GaussianBlur(var.astype(np.float32), (5, 5), 1.2)
    del A, B
    gz = np.hypot(*np.gradient(depth))  # depth slope, for a depth test that scales with it
    for level in range(LEVELS):
        step = 1 << level
        pad = 2 * step
        P = lambda a: np.pad(a, ((pad, pad), (pad, pad)) + ((0, 0),) * (a.ndim - 2), mode='edge')
        irrP, varP, nP, zP, aP = P(irr), P(var), P(nrm), P(depth), P(albedo)
        l = irr @ lumw
        lP = P(l)
        std = np.sqrt(np.maximum(cv2.GaussianBlur(var, (3, 3), 0), 0)) + 1e-4
        acc = np.zeros_like(irr); wsum = np.zeros((h, w), np.float32); vacc = np.zeros((h, w), np.float32)
        for i, dy in enumerate(range(-2, 3)):
            for j, dx in enumerate(range(-2, 3)):
                ys, xs = pad + dy * step, pad + dx * step
                sl = (slice(ys, ys + h), slice(xs, xs + w))
                nq, zq, aq, lq = nP[sl], zP[sl], aP[sl], lP[sl]
                wn = np.clip(np.sum(nrm * nq, axis=2), 0, 1) ** SIG_N
                wz = np.exp(-np.abs(depth - zq) / (SIG_Z * gz * step * max(abs(dx), abs(dy), 1) + 1e-3))
                wa = np.exp(-np.sum((albedo - aq) ** 2, axis=2) / (2 * SIG_A ** 2))
                wl = np.exp(-np.abs(l - lq) / (SIG_L * std))
                wt = (K[i] * K[j]) * wn * wz * wa * wl
                acc += wt[..., None] * irrP[sl]
                wsum += wt
                vacc += wt * wt * varP[sl]
        irr = acc / wsum[..., None]
        var = vacc / (wsum * wsum)
        del irrP, varP, nP, zP, aP, lP, acc, vacc
    return irr * albedo, M


def neutral(c, exposure):
    c = c * exposure
    start, desat = 0.8 - 0.04, 0.15
    x = np.min(c, axis=2, keepdims=True)
    offset = np.where(x < 0.08, x - 6.25 * x * x, 0.04)
    c = c - offset
    peak = np.max(c, axis=2, keepdims=True)
    dd = 1 - start
    new_peak = 1 - dd * dd / (peak + dd - start)
    comp = c * (new_peak / np.maximum(peak, 1e-6))
    g = 1 - 1 / (desat * (peak - new_peak) + 1)
    comp = comp * (1 - g) + new_peak * g
    return np.where(peak < start, c, comp)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def to16(img):
    return (srgb(neutral(img, meta['exposure']))[..., ::-1] * 65535 + 0.5).astype(np.uint16)


# tiles of at most ~1100 px a side, each with a margin wider than the filter reaches
MARGIN = 96
TY, TX = math.ceil(H / 1100), math.ceil(W / 1100)
out = {'denoised': np.zeros((H, W, 3), np.uint16), 'raw': np.zeros((H, W, 3), np.uint16)}
# LINEAR=1: also keep the denoised radiance before tone mapping (float16), to add layers later
import os
linear = np.zeros((H, W, 3), np.float16) if os.environ.get('LINEAR') else None
for ty in range(TY):
    for tx in range(TX):
        y0, y1 = ty * H // TY, (ty + 1) * H // TY
        x0, x1 = tx * W // TX, (tx + 1) * W // TX
        Y0, Y1, X0, X1 = max(0, y0 - MARGIN), min(H, y1 + MARGIN), max(0, x0 - MARGIN), min(W, x1 + MARGIN)
        rad, M = denoise(region('half', Y0, Y1, X0, X1), region('full', Y0, Y1, X0, X1), region('albedo', Y0, Y1, X0, X1), region('gbuf', Y0, Y1, X0, X1))
        core = (slice(y0 - Y0, y1 - Y0), slice(x0 - X0, x1 - X0))
        out['denoised'][y0:y1, x0:x1] = to16(rad[core])
        if linear is not None:
            linear[y0:y1, x0:x1] = rad[core]
        out['raw'][y0:y1, x0:x1] = to16(M[core])
        del rad, M
    print(f'row {ty + 1}/{TY}: {time.time() - t0:.1f}s', flush=True)

for tag, img in out.items():
    cv2.imwrite(f'{d}/{name}-{tag}.png', img)
if linear is not None:
    np.save(f'{d}/{name}-linear.npy', linear)
print(f'done in {time.time() - t0:.1f}s')
