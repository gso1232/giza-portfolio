"""
Finish render-queue items whose GPU part is done but whose denoise failed or
never ran (the queue does this itself; this is for the stragglers):
denoise, keep an 8-bit square <name>.png, drop the float buffers, mark .done.

  python tools/queue-finish.py <shots dir> [name ...]   (no names: every unfinished item)
"""
import glob, os, subprocess, sys
import cv2

d = sys.argv[1]
names = sys.argv[2:] or sorted({os.path.basename(p)[:-5] for p in glob.glob(f'{d}/*.json')
                                 if os.path.exists(p[:-5] + '-gbuf.bin') and not os.path.exists(p[:-5] + '.done')})
for name in names:
    r = subprocess.run([sys.executable, 'tools/denoise.py', d, name], capture_output=True, text=True)
    if r.returncode:
        print('denoise failed', name, r.stderr.strip().splitlines()[-1:])
        continue
    a = cv2.imread(f'{d}/{name}-denoised.png', -1)
    cv2.imwrite(f'{d}/{name}.png', (a / 257).round().astype('uint8'))
    for f in glob.glob(f'{d}/{name}-*'):
        if f.endswith('.bin') or f.endswith('-raw.png') or (f.endswith('-denoised.png') and not name.startswith('st-')):
            os.remove(f)
    open(f'{d}/{name}.done', 'w').write('finished by queue-finish.py')
    print('done', name, flush=True)
