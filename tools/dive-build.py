"""
The dive's videos, from tools/dive-queue.mjs's frames: each frame's two light layers
added in linear with the same balance as the stills (tools/desk-layers.py: the room's
shade cool and dim, the sun warm), tone mapped, then H.264 forward and reversed
(going back plays the reversed file forward; browsers can't play backwards smoothly).

  python tools/dive-build.py <shots dir> [public/desk] [--fps 30]
"""
import glob, json, os, re, subprocess, sys, tempfile
import numpy as np
import cv2

shots = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else 'public/desk'
fps = int(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else 30

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


frames = sorted(int(re.search(r'dv-base-(\d+)-linear', p).group(1)) for p in glob.glob(f'{shots}/dv-base-*-linear.npy'))
assert frames and frames == list(range(len(frames))), f'missing frames: have {len(frames)}'
exposure = json.load(open(f'{shots}/dv-base-00.json'))['exposure'] * 0.9
tmp = tempfile.mkdtemp()
for f in frames:
    b = np.nan_to_num(np.load(f'{shots}/dv-base-{f:02d}-linear.npy').astype(np.float32))
    s = np.nan_to_num(np.load(f'{shots}/dv-sun-{f:02d}-linear.npy').astype(np.float32))
    img = srgb8(neutral(b * cool + s * warm, exposure))
    dead = img.sum(axis=2) == 0
    if dead.any():
        img[dead] = cv2.medianBlur(img, 5)[dead]
    cv2.imwrite(f'{tmp}/{f:03d}.png', img)
print('frames', len(frames), img.shape)
enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', '10', '-movflags', '+faststart', '-an']
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', f'{tmp}/%03d.png', *enc, f'{out}/dive-fwd.mp4'], check=True)
n = len(frames)
for f in frames:
    os.replace(f'{tmp}/{f:03d}.png', f'{tmp}/r{n - 1 - f:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', f'{tmp}/r%03d.png', *enc, f'{out}/dive-rev.mp4'], check=True)
print('wrote', f'{out}/dive-fwd.mp4', f'{out}/dive-rev.mp4', 'at', fps, 'fps')
