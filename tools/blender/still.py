"""
A still of the room (the site's first picture), rendered in horizontal strips that overlap a little
and are blended, with the GPU resting between them (the user: not 100% for long), then its dust
pass and the map of the swappable pictures. tools/blender/finish.py puts it together.

  blender -b --factory-startup -P tools/blender/still.py -- --glb ... --info ... --out <base>
          [--view wide] [--w 3840] [--h 1800] [--samples 256] [--strips 6] [--rest 0.5]

Writes <base>-main.npy, <base>-dust.npy, <base>-cards.npy (restartable: strips already done stay).
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import scene_build

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, d=None, cast=str: cast(argv[argv.index(k) + 1]) if k in argv else d
OUT = arg('--out')
W, H = arg('--w', 3840, int), arg('--h', 1800, int)
N, OV = arg('--strips', 6, int), 32
S = scene_build.build(arg('--glb'), arg('--info'), view=arg('--view', 'wide'), w=W, h=H,
                      haze=arg('--haze', 0.00012, float), steam=arg('--steam', 3.5, float), fstop=arg('--fstop', 4.0, float),
                      dust=arg('--dust', 9000, int), samples=arg('--samples', 256, int))
S.rest = arg('--rest', 0.5, float)
t0 = time.time()
if not os.path.exists(OUT + '-main.npy'):
    img = np.zeros((H, W, 3), np.float32)
    wsum = np.zeros((H, 1, 1), np.float32)
    step = H // N
    for i in range(N):
        y0, y1 = max(0, i * step - OV), min(H, (i + 1) * step + OV) if i < N - 1 else H
        part = f'{OUT}-strip{i}'
        if not os.path.exists(part + '.npy'):
            S.render(part, border=(0, y0, W, y1), hide=(S.dust,))
            print(f'strip {i + 1}/{N} in {(time.time() - t0) / 60:.1f} min', flush=True)
        p = np.load(part + '.npy').astype(np.float32)[: y1 - y0, :W]
        # a ramp over the overlaps, so the strips' denoising meets without a seam
        r = np.ones(y1 - y0, np.float32)
        if i > 0: r[:2 * OV] = np.linspace(0, 1, 2 * OV)
        if i < N - 1: r[-2 * OV:] = np.minimum(r[-2 * OV:], np.linspace(1, 0, 2 * OV))
        img[y0:y1] += p * r[:, None, None]
        wsum[y0:y1] += r[:, None, None]
    np.save(OUT + '-main.npy', (img / np.maximum(wsum, 1e-6)).astype(np.float16))
    for i in range(N):
        os.remove(f'{OUT}-strip{i}.npy')
if S.dust and not os.path.exists(OUT + '-dust.npy'):
    S.render(OUT + '-dust', samples=arg('--dust-samples', 160, int), denoise=False, only=S.dust, hide=(S.haze, S.steam))
if S.posters and not os.path.exists(OUT + '-cards.npy'):
    S.render_cards(OUT + '-cards')
    import json
    json.dump([o.name.split('.')[0] for o in S.posters], open(OUT + '-cards.json', 'w'))       # their numbers' order
print(f'STILL DONE in {(time.time() - t0) / 60:.1f} min', flush=True)
