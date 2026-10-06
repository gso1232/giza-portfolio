# why the loop's steam pass comes out empty: the loop's own steps, one at a time, each followed by
# the steam pass, printing what it holds
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import scene_build
out = sys.argv[sys.argv.index('--') + 1]
S = scene_build.build('blender/desk-loop.glb', 'blender/desk-info.json', w=480, h=225, dust=2000)
ST = S.region([S.steam], pad=16)
def steam(tag):
    S.render(f'{out}/st-{tag}', border=ST, samples=16, only=S.steam, hide=(S.haze, S.dust), alpha=True)
    a = np.load(f'{out}/st-{tag}.npy').astype(np.float32)
    print(tag, 'rgb', a[..., :3].max(), 'alpha', a[..., 3].max(), flush=True)
steam('1-fresh')
S.render(f'{out}/st-p', samples=16, hide=(S.steam, S.dust))
steam('2-after-a-pass-that-hid-it')
S.set_steam(0.0)
steam('3-rebuilt')
S.sway(0.0)
steam('4-after-sway')
