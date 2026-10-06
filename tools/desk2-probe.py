"""Where things in the desk photo are, in the fitted world (tools/desk2-fit.py)."""
import numpy as np, runpy, sys, io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    g = runpy.run_path('tools/desk2-fit.py')
f, R, t, C, M, o, cx, cy = g['f'], g['R'], g['t'], g['C'], g['M'], g['o'], g['cx'], g['cy']
world = g['world']


def ray(px):
    d = R.T @ np.array([(px[0] - cx) / f, (px[1] - cy) / f, 1.0])
    return M @ d                          # direction in world


camw = world(C)


def on_y(px, h):                          # ray hits the horizontal plane y = h
    d = ray(px); s = (h - camw[1]) / d[1]; return camw + d * s


def on_z(px, z):                          # ray hits the vertical plane z = z (the wall is z = 0)
    d = ray(px); s = (z - camw[2]) / d[2]; return camw + d * s


def height_at(base_px, top_py):           # a vertical thing standing at base_px: how tall to reach row top_py
    b = on_y(base_px, 0)
    lo, hi = 0.0, 300.0
    for _ in range(60):
        m = (lo + hi) / 2
        p = b + np.array([0, m, 0])
        pl = M.T @ p + o                  # world -> laptop frame
        pc = R @ pl + t
        y = f * pc[1] / pc[2] + cy
        if y > top_py: lo = m
        else: hi = m
    return b, lo


if __name__ == '__main__':
    print('camera', camw.round(1))
    wall = {'print': [(102, 15), (270, 162)], 'torn': [(285, 12), (342, 112)], 'flowers': [(350, 20), (435, 90)], 'portrait': [(357, 92), (425, 160)],
            'clipping': [(450, 20), (505, 145)], 'pink': [(285, 161), (334, 217)], 'blue': [(342, 167), (391, 222)], 'orange': [(398, 171), (450, 227)]}
    for k, (a, b) in wall.items():
        p, q = on_z(a, 0), on_z(b, 0)
        print(f'wall {k:9s} x {p[0]:6.1f}..{q[0]:6.1f}  y {q[1]:6.1f}..{p[1]:6.1f}   ({q[0]-p[0]:.1f} x {p[1]-q[1]:.1f})')
    for k, (bp, top) in {'zz pot': ((65, 402), 328), 'left pot': ((15, 395), 318), 'basket': ((126, 372), 285), 'books L': ((112, 400), 365),
                         'books R': ((375, 447), 360), 'jar': ((405, 445), 395), 'small frame': ((450, 468), 408), 'mug': ((402, 512), 440),
                         'big frame': ((460, 470), 228), 'white print': ((362, 400), 235), 'zz leaves': ((65, 402), 150), 'jar leaves': ((405, 445), 230)}.items():
        b, h = height_at(bp, top)
        print(f'{k:12s} base {b.round(1)}  height {h:.1f}')
    for k, px in {'notebook FL': (0, 460), 'notebook BR': (105, 412), 'phone FL': (25, 455), 'phone BR': (100, 418), 'coaster L': (365, 520), 'coaster R': (445, 520),
                  'mug L': (365, 480), 'mug R': (440, 480), 'jar L': (385, 440), 'jar R': (425, 440), 'zz pot L': (29, 400), 'zz pot R': (107, 400),
                  'frame foot L': (420, 466), 'frame foot R': (500, 470), 'small frame L': (425, 465), 'small frame R': (475, 470)}.items():
        print(f'{k:14s}', on_y(px, 0).round(1))
