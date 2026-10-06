"""
The camera of the desk photo (src/desk/ref/desk2-ref.webp, 500 x 750), found
from the laptop in it: a 16" laptop, 35.79 x 24.59 x 1.62 cm, its lid the same
size as its base. Pixels were read off magnified crops of the photo.

Then the desk (the plane the laptop stands on), its front edge and the wall
(the lines where the photo shows them, cast onto that plane), and a world
squared to them: centimetres, desk top y = 0, the wall z = 0 with the room at
+z, x along the wall to the right, x = 0 under the laptop's left side.

  python tools/desk2-fit.py [overlay.jpg]   -> src/desk/fit2.json
"""
import json, sys
import numpy as np
import cv2
from scipy.optimize import least_squares

W, H = 500, 750
cx, cy = W / 2, H / 2
LW, LD, LT = 35.79, 24.59, 1.62          # the base: width, depth, thickness
LH = 23.9                                # the lid, hinge to top edge (fitted; the base is 24.59 deep)

# ---- what the photo shows --------------------------------------------------------
BASE_FL, BASE_FR = np.array([40, 497.0]), np.array([273, 536.0])      # base, bottom front corners
LID_TL, LID_TR = np.array([149, 283.0]), np.array([372, 307.0])       # lid, outer top corners
LID_BL, LID_BR = np.array([130, 444.0]), np.array([352, 477.0])       # lid meets the base
DESK_FRONT = np.array([[260, 548.0], [500, 577.0]])                   # the desk top's front edge, right of the laptop
DESK_D = 68.0                                                          # the desk's depth: the pots and books at the back stand against the wall
WALL = np.array([[20, 398.0], [470, 466.0]])                          # (loose: pot bottoms, the frame's foot)
FRAME_FOOT = np.array([[420, 466.0], [496, 470.0]])                   # the big black frame's foot on the desk, right


def rot(r):
    th = np.linalg.norm(r)
    if th < 1e-12:
        return np.eye(3)
    k = r / th
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(th) * K + (1 - np.cos(th)) * K @ K


def project(P, f, R, t):
    """laptop frame -> camera (OpenCV: x right, y down, z forward) -> pixels"""
    Pc = (np.atleast_2d(P) @ R.T) + t
    return np.stack([f * Pc[:, 0] / Pc[:, 2] + cx, f * Pc[:, 1] / Pc[:, 2] + cy], 1)


def model(p):
    f, r, t, phi = p[0], p[1:4], p[4:7], p[7]
    R = rot(r)
    # laptop frame: origin at the base's back-left corner on the desk, x along the hinge,
    # y up, z toward the user; the lid rises from the hinge leaning back by phi - 90 deg
    up = np.array([0, np.sin(phi), np.cos(phi)])      # phi = 90 deg: upright; more leans back, away from the user
    hinge_l, hinge_r = np.array([0, LT, 0.0]), np.array([LW, LT, 0.0])
    pts = {
        'FL': np.array([0, 0, LD]), 'FR': np.array([LW, 0, LD]),
        'TL': hinge_l + up * LH, 'TR': hinge_r + up * LH,
        'BL': hinge_l, 'BR': hinge_r,
    }
    return f, R, t, pts


OBS = {'FL': BASE_FL, 'FR': BASE_FR, 'TL': LID_TL, 'TR': LID_TR, 'BL': LID_BL, 'BR': LID_BR}


import os
LID_PRIOR = float(os.environ.get('LID', '0'))   # deg; 0 = free


def residuals(p):
    f, R, t, pts = model(p)
    # y is up in the laptop frame but down in the camera frame: R carries that
    r = [(project(pts[k], f, R, t)[0] - OBS[k]) for k in OBS]
    if LID_PRIOR:
        r.append([(np.degrees(p[7]) - LID_PRIOR) * 0.5])
    return np.concatenate(r)


best = None
for f0 in (900, 1400, 2000, 2600):
    for rx in (2.2, 2.5, 2.8):
        for ry in (-0.3, 0.0, 0.3):
            p0 = np.array([f0, rx, ry, 0.0, -18, 5, 90, np.radians(105)])
            try:
                s = least_squares(residuals, p0, x_scale='jac', max_nfev=4000)
            except Exception:
                continue
            f, R, t, pts = model(s.x)
            if np.any([(np.atleast_2d(v) @ R.T + t)[0, 2] <= 0 for v in pts.values()]):
                continue
            if best is None or s.cost < best.cost:
                best = s
p = best.x
f, R, t, pts = model(p)
res = residuals(p)
print('f %.0f px  vfov %.1f deg  lid %.0f deg  rms %.2f px  max %.1f' % (f, np.degrees(2 * np.arctan(H / 2 / f)), np.degrees(p[7]), np.sqrt(np.mean(res ** 2)), np.abs(res).max()))

# ---- the desk plane is the laptop frame's y = 0: cast the photo's lines onto it --------
C = -R.T @ t                                   # the camera in the laptop frame


def on_desk(px, h=0.0):
    d = R.T @ np.array([(px[0] - cx) / f, (px[1] - cy) / f, 1.0])
    s = (h - C[1]) / d[1]
    return C + d * s


front = [on_desk(q) for q in DESK_FRONT]
wall = [on_desk(q) for q in WALL]
wdir = wall[1] - wall[0]; wdir /= np.linalg.norm(wdir)
fdir = front[1] - front[0]; fdir /= np.linalg.norm(fdir)
print('wall vs desk front: %.1f deg apart' % np.degrees(np.arccos(abs(wdir @ fdir))))
lap_x = np.array([1.0, 0, 0])
print('laptop vs desk front: %.1f deg' % np.degrees(np.arccos(abs(lap_x @ fdir))))
ff = [on_desk(q) for q in FRAME_FOOT]
print('frame foot from the desk front edge: %.1f cm' % abs(np.cross(fdir, ff[0] - front[0])[1]))
print('laptop front-left from the desk front edge: %.1f cm' % abs(np.cross(fdir, np.array([0, 0, LD]) - front[0])[1]))

# world: x along the desk's front edge (the wall is parallel to it, DESK_D behind),
# z toward the camera, y up; x = 0 under the laptop's back-left corner
xw = fdir if fdir[0] > 0 else -fdir
zw = np.cross(xw, [0, 1.0, 0])
if zw @ (C - front[0]) < 0:
    zw = -zw
wall0 = front[0] - zw * DESK_D
o = wall0 + xw * ((np.zeros(3) - wall0) @ xw)
M = np.stack([xw, [0, 1.0, 0], zw])


def world(P):
    return M @ (np.asarray(P) - o)


cam = world(C)
fwd = M @ (R.T @ np.array([0, 0, 1.0]))
upv = M @ (R.T @ np.array([0, -1.0, 0]))
depth = np.mean([world(q)[2] for q in front])
print('camera (world cm)', cam.round(1), 'height above desk %.1f' % cam[1])
print('desk front edge at z = %.1f cm from the wall' % depth)
print('laptop back-left corner (world)', world(np.zeros(3)).round(1), ' hinge dir', (M @ np.array([1, 0, 0.0])).round(3))

out = {
    'image': [W, H], 'f': f, 'vfov': float(np.degrees(2 * np.arctan(H / 2 / f))),
    'camera': cam.tolist(), 'forward': fwd.tolist(), 'up': upv.tolist(),
    'laptop': {'backLeft': world(np.zeros(3)).tolist(), 'hingeDir': (M @ np.array([1, 0, 0.0])).tolist(), 'lidAngle': float(np.degrees(p[7])),
               'size': [LW, LD, LT], 'lid': LH},
    'deskDepth': depth,
}


def desk_px(px, h=0.0):
    return world(on_desk(np.asarray(px, float), h)).round(2).tolist()


out['px'] = desk_px
json.dump({k: v for k, v in out.items() if k != 'px'}, open('src/desk/fit2.json', 'w'), indent=1)

if len(sys.argv) > 1:
    img = cv2.imread('src/desk/ref/desk2-ref.webp')
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    def draw(Pw, col, closed=True):
        P = np.array([M.T @ q + o for q in Pw])   # world -> laptop frame
        q = (project(P, f, R, t) * 2).round().astype(int)
        cv2.polylines(img, [q.reshape(-1, 1, 2)], closed, col, 2, cv2.LINE_AA)
    wp = lambda P: world(P)
    draw([wp(pts[k]) for k in ('FL', 'FR')], (0, 255, 255), False)
    draw([wp(pts[k]) for k in ('BL', 'BR', 'TR', 'TL')], (0, 200, 255))
    draw([wp(np.array([0, 0, LD])), wp(np.array([LW, 0, LD])), wp(np.array([LW, 0, 0])), wp(np.array([0, 0, 0]))], (0, 128, 255))
    for x in range(-120, 121, 10):
        draw([[x, 0, 0], [x, 0, depth]], (80, 200, 80), False)
    for z in range(0, int(depth) + 1, 10):
        draw([[-120, 0, z], [120, 0, z]], (80, 200, 80), False)
    for x in range(-120, 121, 20):
        draw([[x, 0, 0], [x, 150, 0]], (200, 120, 80), False)
    for k, v in OBS.items():
        cv2.circle(img, tuple((v * 2).round().astype(int)), 4, (0, 0, 255), -1)
    cv2.imwrite(sys.argv[1], img)
    print('overlay ->', sys.argv[1])
