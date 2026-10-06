"""
A finished still's main pass with only some rectangles rendered again (a picture moved on the wall: where it was and
where it is now), each laid back in with a soft edge, in linear light, before finish.py tones it. Its dust and its
pictures' map are cleared so still.py renders them again whole (they are quick).

  blender -b --factory-startup -P tools/blender/patch_still.py -- --glb ... --info ... --view wide --w 3840 --h 1800
          --samples 256 --out <base> --rect x0,y0,x1,y1 [--rect ...]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import scene_build

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, d=None, cast=str: cast(argv[argv.index(k) + 1]) if k in argv else d
OUT = arg('--out')
W, H = arg('--w', 3840, int), arg('--h', 1800, int)
rects = [tuple(int(v) for v in argv[i + 1].split(',')) for i, a in enumerate(argv) if a == '--rect']
S = scene_build.build(arg('--glb'), arg('--info'), view=arg('--view', 'wide'), w=W, h=H,
                      haze=arg('--haze', 0.00012, float), steam=arg('--steam', 3.5, float), fstop=arg('--fstop', 4.0, float),
                      dust=arg('--dust', 9000, int), samples=arg('--samples', 256, int))
S.rest = arg('--rest', 0.5, float)
main = np.load(OUT + '-main.npy').astype(np.float32)
FE = 48
for k, (x0, y0, x1, y1) in enumerate(rects):
    part = f'{OUT}-patch{k}'
    S.render(part, border=(x0, y0, x1, y1), hide=(S.dust,))
    p = np.load(part + '.npy').astype(np.float32)[: y1 - y0, : x1 - x0, :3]
    h, w = p.shape[:2]
    # soft only where the rectangle meets the old picture, not along the frame's own edges
    ys, xs = np.arange(h)[:, None].astype(np.float32), np.arange(w)[None, :].astype(np.float32)
    m = np.ones((h, w), np.float32)
    if y0 > 0: m = np.minimum(m, ys / FE)
    if y0 + h < H: m = np.minimum(m, (h - 1 - ys) / FE)
    if x0 > 0: m = np.minimum(m, xs / FE)
    if x0 + w < W: m = np.minimum(m, (w - 1 - xs) / FE)
    m = np.clip(m, 0, 1); m = (m * m * (3 - 2 * m))[..., None]
    main[y0:y0 + h, x0:x0 + w] = main[y0:y0 + h, x0:x0 + w] * (1 - m) + p * m
    for ext in ('.npy', '.exr'):
        if os.path.exists(part + ext): os.remove(part + ext)
    print(f'patch {k + 1}/{len(rects)} done', flush=True)
np.save(OUT + '-main.npy', main.astype(np.float16))
for n in ('-dust.npy', '-cards.npy', '-cards.json'):
    if os.path.exists(OUT + n): os.remove(OUT + n)
print('PATCH DONE', flush=True)
