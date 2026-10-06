"""
The room's live loop, rendered frame by frame in Cycles (the user's "live animation"): the
plants in a breeze from the window, dust drifting through the sun, steam off the tea. The camera
doesn't move, so only what moves is rendered each frame:

  base     the whole frame once, still (no steam, no dust)            base.npy
  plants   the part of the frame the plants and their shadows cover    p-NNN.npy
  steam    the steam alone over the rest held out (with its alpha)     s-NNN.npy
  dust     the motes alone, not denoised (tiny bright specks)          d-NNN.npy

tools/blender/loop_finish.py puts them together. Every motion runs whole cycles over the loop,
so the frame after the last is the first. Restartable: a frame whose three files exist is skipped.

  blender -b --factory-startup -P tools/blender/loop.py -- --glb ... --info ... --out <dir>
          [--view wide] [--w 1920] [--h 900] [--frames 120] [--samples 128] [--base-samples 384]
"""
import json, os, sys, time
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene_build

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, d=None, cast=str: cast(argv[argv.index(k) + 1]) if k in argv else d
OUT = arg('--out'); os.makedirs(OUT, exist_ok=True)
FRAMES = arg('--frames', 120, int)
W, H = arg('--w', 1920, int), arg('--h', 900, int)
S = scene_build.build(arg('--glb'), arg('--info'), view=arg('--view', 'wide'), w=W, h=H,
                      haze=arg('--haze', 0.00012, float), steam=arg('--steam', 3.5, float), fstop=arg('--fstop', 4.0, float),
                      dust=arg('--dust', 9000, int))
SAMPLES = arg('--samples', 128, int)
S.rest = arg('--rest', 0.5, float)                          # the GPU rests this much of each render's time

# where things move, in this view's pixels
plants = [p[0] for p in S.plants]
# measured where the breeze changes this view (desk.html's raster frames across the loop, diffed:
# blender/motion-regions.json), else worked out from the plants' boxes and shadows (far larger)
RJ = arg('--regions')
if RJ:
    rj, v = json.load(open(RJ)), arg('--view', 'wide')
    sw, sh = rj['size'][v]
    x0, y0, x1, y1 = rj[v]
    P = (int(x0 * W / sw) // 2 * 2, int(y0 * H / sh) // 2 * 2, min(W, int(x1 * W / sw + 1) // 2 * 2), min(H, int(y1 * H / sh + 1) // 2 * 2))
else:
    P = S.region(plants, pad=40, along_sun=160)
# and the candle's corner: its flame and the glow it throws round it, which flicker every frame
candle = next((o for o in bpy.data.objects if o.name.split('.')[0] == 'candle' and o.type == 'EMPTY'), None)
ST = S.region([S.steam], pad=16) if S.steam else None
if candle:
    # (it stands by the tea: its corner joins the steam's)
    cx0, cy0, cx1, cy1 = S.region([candle], pad=int(90 * W / 1920))
    ST = (min(ST[0], cx0), min(ST[1], cy0), max(ST[2], cx1), max(ST[3], cy1)) if ST else (cx0, cy0, cx1, cy1)
json.dump({'w': W, 'h': H, 'frames': FRAMES, 'plants': P, 'steam': ST}, open(f'{OUT}/regions.json', 'w'))
print('regions', P, ST, flush=True)

t0 = time.time()
# the base twice, with the room's haze and without: their difference is the haze's own light,
# rendered once and laid over every frame's parts (so the parts are rendered clear, faster, and
# the air doesn't shimmer frame to frame where they are re-rendered)
if not os.path.exists(f'{OUT}/base.npy'):
    S.sway(0)
    S.render(f'{OUT}/base', samples=arg('--base-samples', 384, int), hide=(S.steam, S.dust))
    print(f'base in {time.time() - t0:.0f} s', flush=True)
if S.haze and not os.path.exists(f'{OUT}/base-clear.npy'):
    S.sway(0)
    S.render(f'{OUT}/base-clear', samples=arg('--base-samples', 384, int), hide=(S.steam, S.dust, S.haze))
    print(f'clear base in {time.time() - t0:.0f} s', flush=True)

# where the swappable pictures lie (the camera doesn't move: once)
if S.posters and not os.path.exists(f'{OUT}/cards.npy'):
    S.render_cards(f'{OUT}/cards')
    json.dump([o.name.split('.')[0] for o in S.posters], open(f'{OUT}/cards.json', 'w'))
for f in range(arg('--limit', FRAMES, int)):                 # (--limit: render only the first few, to try it)
    names = [f'{OUT}/{k}-{f:03d}.npy' for k in 'psd']
    if all(os.path.exists(n) for n in names):
        continue
    t = time.time()
    phase = f / FRAMES
    S.sway(phase)
    S.flicker(phase)
    S.set_steam(phase)
    if S.dust:
        scene_build.air.move_dust(S.dust, S.cam, phase)
    S.render(f'{OUT}/p-{f:03d}', border=P, samples=SAMPLES, hide=(S.steam, S.dust, S.haze))
    if S.steam:
        # the steam's corner of the frame, rendered whole (clear of the haze, like the plants')
        S.render(f'{OUT}/s-{f:03d}', border=ST, samples=SAMPLES, hide=(S.dust, S.haze))
    if S.dust:
        S.render(f'{OUT}/d-{f:03d}', samples=96, denoise=False, only=S.dust, hide=(S.haze, S.steam))
    print(f'frame {f} in {time.time() - t:.0f} s ({(time.time() - t0) / 60:.0f} min)', flush=True)
print('LOOP DONE', flush=True)
