"""
Grade a plate like the reference photograph.

The photo carries a colourist's grade: brown, warm shadows under nearly
neutral highlights, which no light in the scene produces. Fitting a free curve
per channel on paired pixels breaks down wherever our light and the photo's
differ in place (it turned our shadows green), so the grade is split in two:

  colour: for each brightness level, the photo's mean colour balance
          (r/l, g/l, b/l) against ours, from the whole frame's statistics
          rather than pixel pairs; applied as a hue shift that keeps brightness
  tone:   a gentle three-parameter curve, l' = a * l^g + b, least squares on
          pixel pairs (the geometry lines up, so brightness pairs are sound)

The screen, the name and the card's rounded corners are left out of both.

  python tools/grade.py fit <render-like-photo.png> <photo.png> <grade.json>
  python tools/grade.py apply <grade.json> <in.png> <out.png> [strength]
"""
import json, sys
import numpy as np
import cv2

LUMA = np.array([0.2126, 0.7152, 0.0722])
NB = 16

def read(p):
    a = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    a = a[..., :3][..., ::-1].astype(np.float64)
    return a / (65535.0 if a.dtype == np.uint16 or a.max() > 255 else 255.0)

def balance_by_level(img, keep):
    l = img @ LUMA
    ok = keep & (l > 0.02)
    idx = np.clip((l[ok] * NB).astype(int), 0, NB - 1)
    rat = img[ok] / l[ok][:, None]
    out = np.ones((NB, 3)); n = np.zeros(NB)
    for b in range(NB):
        m = idx == b
        n[b] = m.sum()
        if n[b] >= 30: out[b] = rat[m].mean(0)
    return out, n

def fit(render_p, photo_p, out_p):
    ours, photo = read(render_p), read(photo_p)
    H, W = 430, 573
    small = lambda a: cv2.GaussianBlur(cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA), (0, 0), 1.2)
    ours, photo = small(ours), small(photo)
    ys, xs = np.mgrid[0:H, 0:W]
    X, Y = xs / W * 1146, ys / H * 860
    keep = ~((X > 312) & (X < 836) & (Y > 170) & (Y < 586))
    keep &= ~((X > 470) & (X < 680) & (Y > 572) & (Y < 622))
    keep &= ~(((X < 40) | (X > 1106)) & ((Y < 40) | (Y > 820)))
    # split toning: out_c = in_c * (1 + s_c (1 - l)^2 + h_c l^2), six numbers in all,
    # least squares on the colour balance of pixel pairs (brightness left to the tone curve)
    lo = ours @ LUMA
    ok = keep & (lo > 0.04)
    bo = ours[ok] / lo[ok][:, None]
    bp = photo[ok] / np.maximum((photo @ LUMA)[ok], 1e-3)[:, None]
    l = lo[ok]
    A = np.stack([(1 - l) ** 2, l ** 2], 1)
    split = []
    for c in range(3):
        y = bp[:, c] / np.maximum(bo[:, c], 1e-3) - 1
        y = np.clip(y, -0.5, 0.5)
        (sc, hc), *_ = np.linalg.lstsq(A, y, rcond=None)
        split.append([float(sc), float(hc)])
    # tone: l_photo ~ a * l_ours^g + b
    lo2, lp = (ours @ LUMA)[keep], (photo @ LUMA)[keep]
    best = None
    for g in np.linspace(0.7, 1.4, 71):
        M = np.stack([lo2 ** g, np.ones_like(lo2)], 1)
        (a, b), *_ = np.linalg.lstsq(M, lp, rcond=None)
        err = np.mean((M @ [a, b] - lp) ** 2)
        if best is None or err < best[0]: best = (err, g, a, b)
    _, g, a, b = best
    json.dump({'split': split, 'tone': [float(a), float(g), float(b)]}, open(out_p, 'w'), indent=1)
    print(f"tone: l' = {a:.3f} * l^{g:.3f} + {b:.3f}")
    print('shadow tint rgb', [round(v[0], 3) for v in split], ' highlight tint rgb', [round(v[1], 3) for v in split])

def apply(grade_p, in_p, out_p, strength=1.0):
    G = json.load(open(grade_p))
    split, (a, g, b) = np.array(G['split']), G['tone']
    img = read(in_p)
    l = np.maximum(img @ LUMA, 1e-5)
    t = np.stack([1 + split[c, 0] * (1 - l) ** 2 + split[c, 1] * l ** 2 for c in range(3)], -1)
    tinted = img * t
    new_l = np.clip(a * l ** g + b, 0, 1)
    tinted *= (new_l / np.maximum(tinted @ LUMA, 1e-5))[..., None]
    out = np.clip(img + (tinted - img) * strength, 0, 1)
    cv2.imwrite(out_p, (out[..., ::-1] * 65535 + 0.5).astype(np.uint16))

if __name__ == '__main__':
    if sys.argv[1] == 'fit': fit(*sys.argv[2:5])
    else: apply(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else 1.0)
