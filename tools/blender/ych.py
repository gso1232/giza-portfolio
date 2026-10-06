"""
The Yellow Crane Tower (黄鹤楼, Wuhan, rebuilt 1985), as what rises off his sheet where the reference's
building rises: he studies at the Egyptian Chinese University, and his site stands up as China's tower.

Built from its published numbers and photographs (51.4 m high; 30 m wide at the ground storey, 18 m at
the top; five storeys outside; a cross plan, each side's middle bay standing forward, so every storey has
twelve upturned corners, sixty in all; yellow glazed roofs, red columns, teal rafters; a cross-gabled
crown with a gourd finial and the 黄鹤楼 plaque) at 1:120, so it is as tall as theirs (0.43 m), on its
stone terrace, on their pivot (-0.051, 0.074).

It moves as theirs does, frame for frame (their building.glb, the user's download; only its motion is
used): each of its parts carries the motion of their floor at its height. The top storey and the crown
lift off as their top floors do, opening the fourth storey, where his work stands (five projects, three to
a row, then two after the red pen, on their office layout's clock); the panels between the columns take
his real pages on their facade blend's clock; the pines rise with their trees.

  blender -b --factory-startup -P tools/blender/ych.py -- [--out public/inside/ych.glb]
          [--info public/inside/ych-info.json] [--theirs blender/illoca/building.glb] [--preview <prefix>]
          [--frames 70,180,618] [--photo]   (--photo: one still from the front, as the reference photo)

Everything is placed in the site's axes (metres, y up) and turned into Blender's (x, -z, y) as it is made.
It is drawn as it stands at the end of their clip (after their quarter turn): its front (the door, the
plaque) faces +x, which the camera sees from the front before the turn.
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, d=None, cast=str):
    return cast(argv[argv.index(k) + 1]) if k in argv else d

OUT = os.path.abspath(arg('--out', 'public/inside/ych.glb'))
INFO = os.path.abspath(arg('--info', 'public/inside/ych-info.json'))
THEIRS = os.path.abspath(arg('--theirs', 'blender/illoca/building.glb'))
PREVIEW = arg('--preview')

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
coll = scn.collection

CB = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
def B(x, y, z):
    return Vector((x, -z, y))

# ---- tints (the site makes each its two tones; the preview shows the tower's own colours) -------------
TINTS = {
    'stone': (0.97, 0.96, 0.93), 'stone2': (0.86, 0.85, 0.82), 'baluster': (0.98, 0.97, 0.95),
    'tile': (0.93, 0.66, 0.24), 'ridge': (0.86, 0.55, 0.18), 'under': (0.17, 0.34, 0.31), 'fascia': (0.62, 0.22, 0.17),
    'column': (0.62, 0.24, 0.2), 'beam': (0.3, 0.5, 0.46), 'wall': (0.66, 0.3, 0.25), 'rail': (0.6, 0.26, 0.21),
    'floor': (0.8, 0.75, 0.7), 'gable': (0.6, 0.24, 0.19), 'gold': (0.88, 0.7, 0.3), 'lantern': (0.85, 0.2, 0.15),
    'plinth': (0.96, 0.96, 0.96), 'bezel': (0.3, 0.3, 0.3), 'core': (0.8, 0.78, 0.75),
    'pine': (0.42, 0.55, 0.36), 'trunk': (0.5, 0.38, 0.28), 'tex': (1, 1, 1), 'glass': (1, 1, 1),
}
MATS = {}
def M(name):
    if name not in MATS:
        m = bpy.data.materials.new('m_' + name)
        m.use_nodes = True
        c = TINTS[name]
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*c, 1)
        b.inputs['Roughness'].default_value = 1.0
        m.diffuse_color = (*c, 1)
        MATS[name] = m
    return MATS[name]

def obj(name, me=None, parent=None, at=(0, 0, 0)):
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.parent = parent
    o.matrix_basis = Matrix.Translation(B(*at))
    return o

def newell(pts):
    n = Vector((0, 0, 0))
    for i in range(len(pts)):
        a, b = Vector(pts[i]), Vector(pts[(i + 1) % len(pts)])
        n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y)
    return n

class Parts:
    """faces gathered in the site's axes, one material each, made into one mesh"""
    def __init__(self):
        self.v, self.f, self.m, self.uv = [], [], [], []
    def quad(self, pts, mat, uvs=None, out=None):
        """a face; with `out`, turned so its normal points along it"""
        pts = [tuple(p) for p in pts]
        if out is not None and newell(pts).dot(Vector(out)) < 0:
            pts = pts[::-1]
            if uvs:
                uvs = uvs[::-1]
        i = len(self.v)
        self.v += [B(*p) for p in pts]
        self.f.append(tuple(range(i, i + len(pts))))
        self.m.append(mat)
        self.uv.append(uvs or ([(0, 0), (1, 0), (1, 1), (0, 1)] if len(pts) == 4 else [(0.5, 0.5)] * len(pts)))
    def box(self, x0, x1, y0, y1, z0, z1, mat, skip=()):
        x0, x1 = min(x0, x1), max(x0, x1); z0, z1 = min(z0, z1), max(z0, z1)
        P = lambda a, b, c: (x1 if a else x0, y1 if b else y0, z1 if c else z0)
        faces = {'-x': ((P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)), (-1, 0, 0)), '+x': ((P(1, 0, 1), P(1, 0, 0), P(1, 1, 0), P(1, 1, 1)), (1, 0, 0)),
                 '-y': ((P(0, 0, 1), P(0, 0, 0), P(1, 0, 0), P(1, 0, 1)), (0, -1, 0)), '+y': ((P(0, 1, 0), P(0, 1, 1), P(1, 1, 1), P(1, 1, 0)), (0, 1, 0)),
                 '-z': ((P(1, 0, 0), P(0, 0, 0), P(0, 1, 0), P(1, 1, 0)), (0, 0, -1)), '+z': ((P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)), (0, 0, 1))}
        for k, (q, o) in faces.items():
            if k not in skip:
                self.quad(q, mat, out=o)
    def cyl(self, cx, cz, r, y0, y1, mat, n=10, cap=True):
        for j in range(n):
            a0, a1 = 2 * math.pi * j / n, 2 * math.pi * (j + 1) / n
            am = (a0 + a1) / 2
            self.quad([(cx + math.cos(a0) * r, y0, cz + math.sin(a0) * r), (cx + math.cos(a0) * r, y1, cz + math.sin(a0) * r),
                       (cx + math.cos(a1) * r, y1, cz + math.sin(a1) * r), (cx + math.cos(a1) * r, y0, cz + math.sin(a1) * r)], mat,
                      out=(math.cos(am), 0, math.sin(am)))
        if cap:
            self.quad([(cx + math.cos(2 * math.pi * j / n) * r, y1, cz + math.sin(2 * math.pi * j / n) * r) for j in range(n)], mat, out=(0, 1, 0))
    def ball(self, cx, cy, cz, r, mat, sy=1.0, nu=10, nv=6):
        ring = []
        for a in range(nv + 1):
            th = math.pi * a / nv - math.pi / 2
            ring.append([(cx + r * math.cos(th) * math.cos(2 * math.pi * b / nu), cy + r * sy * math.sin(th), cz + r * math.cos(th) * math.sin(2 * math.pi * b / nu)) for b in range(nu)])
        for a in range(nv):
            for b in range(nu):
                q = [ring[a][b], ring[a + 1][b], ring[a + 1][(b + 1) % nu], ring[a][(b + 1) % nu]]
                c = Vector(tuple(sum(p[i] for p in q) / 4 for i in range(3))) - Vector((cx, cy, cz))
                self.quad(q, mat, out=c)
    def cone(self, cx, cz, r, y0, y1, mat, n=10):
        for j in range(n):
            a0, a1 = 2 * math.pi * j / n, 2 * math.pi * (j + 1) / n
            am = (a0 + a1) / 2
            self.quad([(cx + math.cos(a0) * r, y0, cz + math.sin(a0) * r), (cx, y1, cz), (cx + math.cos(a1) * r, y0, cz + math.sin(a1) * r)], mat,
                      out=(math.cos(am), r / (y1 - y0), math.sin(am)))
        self.quad([(cx + math.cos(2 * math.pi * j / n) * r, y0, cz + math.sin(2 * math.pi * j / n) * r) for j in range(n)], mat, out=(0, -1, 0))
    def make(self, name, parent=None, origin=(0, 0, 0)):
        o_ = B(*origin)
        me = bpy.data.meshes.new(name)
        me.from_pydata([v - o_ for v in self.v], [], self.f)
        me.update()
        uv = me.uv_layers.new(name='UVMap')
        for p, uvs in zip(me.polygons, self.uv):
            for k, lp in enumerate(p.loop_indices):
                uv.data[lp].uv = uvs[k]
        names = sorted(set(self.m))
        for n_ in names:
            me.materials.append(M(n_))
        for p, mname in zip(me.polygons, self.m):
            p.material_index = names.index(mname)
        me.validate()
        return obj(name, me, parent, origin)

# ---- their motion -------------------------------------------------------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=THEIRS)
theirs = {o.name: o for o in bpy.data.objects if o not in before}
NF = 619                                            # frames 0..618 at 24 fps (their 25.75 s)
scn.render.fps = 24
def mats_of(o):
    out = []
    for f in range(NF):
        scn.frame_set(f)
        t, q, s = o.matrix_world.decompose()
        s = Vector([max(c, 1e-6) for c in s])
        out.append(Matrix.Translation(t) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((*s, 1)))
    return out
def delta(name):
    """their object's motion: at each frame, the transform from where it ends to where it is"""
    ms = mats_of(theirs[name])
    inv = ms[-1].inverted()
    return [m @ inv for m in ms]
def key_of(name, block):
    kb = theirs[name].data.shape_keys.key_blocks[block]
    out = []
    for f in range(NF):
        scn.frame_set(f)
        out.append(kb.value)
    return out
SRC = ['floor0', 'floor1', 'floor2', 'floor3', 'floor4', 'floor5', 'floor6', 'floor7', 'floor8_base']
D = {n: delta(n) for n in SRC + ['office_layout', 'trees']}
K_DOWN, K_UP = key_of('office_layout', 'down'), key_of('office_layout', 'up')
K_FAC = key_of('facade_morph_01_down', '03')
for o in list(theirs.values()):
    bpy.data.objects.remove(o, do_unlink=True)
for me in [m for m in bpy.data.meshes if m.users == 0]:
    bpy.data.meshes.remove(me)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# ---- the tower ----------------------------------------------------------------------------------------
OX, OZ = -0.051, 0.074                              # their pivot
K = 1 / 120                                         # the scale: 51.4 m -> 0.43 m
Y0 = 0.758                                          # their floors' foot
TER_H = 3.0 * K                                     # the stone terrace
# storeys (real metres): body width, height of the storey to the top of its eave, overhang, eave drop
ST = [   # (w: the whole width across the bays, as published: 30 m at the ground, 18 m at the top)
    dict(w=30.0, h=12.6, over=4.6, drop=2.6, lift=3.2, bal=False),   # ground storey, the widest eave
    dict(w=26.5, h=9.2, over=3.9, drop=2.1, lift=2.8, bal=True),
    dict(w=23.5, h=8.5, over=3.7, drop=2.0, lift=2.7, bal=True),
    dict(w=21.0, h=7.8, over=3.5, drop=1.9, lift=2.6, bal=True),     # the fourth: his work inside
    dict(w=18.0, h=6.7, over=3.3, drop=1.8, lift=2.5, bal=True),     # the top storey, under the crown
]
CROWN_H = 7.4
BAY_W, BAY_P, BAL_D = 0.52, 2.6, 2.4                # middle bay: its share of the side, how far it stands out; the gallery's depth
COL_R = 0.32
levels = [Y0 + TER_H]
for s_ in ST:
    levels.append(levels[-1] + s_['h'] * K)
TOP = levels[-1] + CROWN_H * K
# which of their floors each part moves with (by height; the top storey and the crown lift as their 7 and 8)
GROUP = {'terrace': 0, 0: 1, 1: 3, 2: 6, 3: 7, 4: 8, 'crown': 8}   # (the fourth, the fifth and the crown lift: the third, wider, is his gallery)

CELL_COLS, CELL_ROWS = 32, 16
cells = []
def cell_uv(i):
    c, r = i % CELL_COLS, i // CELL_COLS
    u0, u1 = c / CELL_COLS, (c + 1) / CELL_COLS
    v1, v0 = 1 - r / CELL_ROWS, 1 - (r + 1) / CELL_ROWS
    e = 0.0015
    return [(u0 + e, v0 + e), (u1 - e, v0 + e), (u1 - e, v1 - e), (u0 + e, v1 - e)]

def cross(w, bw, bp):
    """the cross plan: the square of side w, a middle bay bw wide standing bp out on each side; its outline
    (counter-clockwise seen from above, from the +x side's right end) and its rectangles"""
    h, b = w / 2, bw / 2
    pts = []
    for ang in (0, 90, 180, 270):
        c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        R = lambda x, z: (x * c - z * s, x * s + z * c)
        pts += [R(h, -h), R(h, -b), R(h + bp, -b), R(h + bp, b), R(h, b)]
    rects = [(-h, h, -h, h), (h, h + bp, -b, b), (-h - bp, -h, -b, b), (-b, b, h, h + bp), (-b, b, -h - bp, -h)]
    return pts, rects

def skirt(P, rect, y_top, over, drop, lift, ext, n_side=14, n_t=5, sides=(0, 1, 2, 3)):
    """an eave round a rectangle: a concave sweep from the wall line out and down, its corners turned up and
    out (the 'flying' corners); tiles above, painted rafters under, a fascia along its edge. `sides` picks
    which of its four sides are built (a bay's eave meets the body's on its inner side)"""
    x0, x1, z0, z1 = rect
    cxm, czm = (x0 + x1) / 2, (z0 + z1) / 2
    C = [(x1, z1), (x1, z0), (x0, z0), (x0, z1)]
    Co = [(x1 + over, z1 + over), (x1 + over, z0 - over), (x0 - over, z0 - over), (x0 - over, z1 + over)]
    def pt(side, u, t, under=False):
        a, b = C[side], C[(side + 1) % 4]
        ao, bo = Co[side], Co[(side + 1) % 4]
        pi = (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)
        po = (ao[0] + (bo[0] - ao[0]) * u, ao[1] + (bo[1] - ao[1]) * u)
        d = min(u, 1 - u) * (abs(b[0] - a[0]) + abs(b[1] - a[1]))       # distance to the nearer corner
        wc = max(0.0, 1 - d / (0.3 * min(x1 - x0, z1 - z0) + 1e-9)) ** 2
        corner = a if u < 0.5 else b
        dx, dz = corner[0] - cxm, corner[1] - czm
        L_ = math.hypot(dx, dz) or 1
        x = pi[0] + (po[0] - pi[0]) * t + dx / L_ * ext * wc * t * t
        z = pi[1] + (po[1] - pi[1]) * t + dz / L_ * ext * wc * t * t
        y = y_top - drop * (1 - (1 - t) ** 2) + lift * wc * t ** 3
        if under:
            y -= 0.0009 + 0.0011 * t
        return (x, y, z)
    for side in sides:
        a, b = C[side], C[(side + 1) % 4]
        outv = Vector((b[1] - a[1], 0, -(b[0] - a[0]))).normalized()   # (the side's outward direction)
        if Vector((cxm - a[0], 0, czm - a[1])).dot(outv) > 0:
            outv = -outv
        for j in range(n_side):
            u0, u1 = j / n_side, (j + 1) / n_side
            for k in range(n_t):
                t0, t1 = k / n_t, (k + 1) / n_t
                q = [pt(side, u0, t0), pt(side, u1, t0), pt(side, u1, t1), pt(side, u0, t1)]
                P.quad(q, 'tile', out=(0, 1, 0))
                qu = [pt(side, u0, t0, True), pt(side, u1, t0, True), pt(side, u1, t1, True), pt(side, u0, t1, True)]
                P.quad(qu, 'under', out=(0, -1, 0))
            # the fascia along the edge
            P.quad([pt(side, u0, 1), pt(side, u1, 1), pt(side, u1, 1, True), pt(side, u0, 1, True)], 'fascia', out=tuple(outv))
        # the ridge of tiles along the corner hips (a raised rib from the wall's corner to the tip)
        for u in (0.0,):
            for k in range(n_t):
                t0, t1 = k / n_t, (k + 1) / n_t
                p0, p1 = Vector(pt(side, u, t0)), Vector(pt(side, u, t1))
                P.quad([tuple(p0 + Vector((0, 0.0016, 0)) + Vector((0.0009, 0, 0))), tuple(p1 + Vector((0, 0.0016, 0)) + Vector((0.0009, 0, 0))),
                        tuple(p1 + Vector((0, 0.0016, 0)) - Vector((0.0009, 0, 0))), tuple(p0 + Vector((0, 0.0016, 0)) - Vector((0.0009, 0, 0)))], 'ridge', out=(0, 1, 0))

def wall_seg(P, G, k, a, b, outv, y0, y1, page):
    """a stretch of the inner wall from a to b (x, z), facing outv: a low sill, lattice panels between red
    posts (each a window cell: his pages later), a lintel"""
    a, b = Vector((a[0], 0, a[1])), Vector((b[0], 0, b[1]))
    L_ = (b - a).length
    al = (b - a).normalized()
    n = Vector(outv)
    th = 0.0024
    def box_on(s0, s1, ya, yb, d0, d1, mat):
        pts = [a + al * s0 + n * d0, a + al * s1 + n * d0, a + al * s1 + n * d1, a + al * s0 + n * d1]
        xs = [p.x for p in pts]; zs = [p.z for p in pts]
        P.box(min(xs), max(xs), ya, yb, min(zs), max(zs), mat)
    sill, lint = y0 + (y1 - y0) * 0.12, y1 - (y1 - y0) * 0.14
    box_on(0, L_, y0, sill, 0, -th, 'wall')
    box_on(0, L_, lint, y1, 0, -th, 'beam')
    nb = max(1, round(L_ / 0.03))
    w = L_ / nb
    for j in range(nb + 1):
        s = min(max(j * w - 0.0011, 0), L_ - 0.0022)
        box_on(s, s + 0.0022, sill, lint, 0.0003, -th, 'wall')
    for j in range(nb):
        s0, s1 = j * w + 0.0011, (j + 1) * w - 0.0011
        i = len(cells)
        cells.append([k, page, j, nb])
        p = lambda s, y: tuple(a + al * s + n * (-0.0008) + Vector((0, y, 0)))
        G.quad([p(s0, sill), p(s1, sill), p(s1, lint), p(s0, lint)], 'glass', cell_uv(i), out=tuple(n))

def storey(si):
    s_ = ST[si]
    y0, y1 = levels[si], levels[si + 1]
    W = (s_['w'] - 2 * BAY_P) * K                   # the square, inside the bays
    bw, bp, bd = W * BAY_W, BAY_P * K, BAL_D * K
    over, drop, lift = s_['over'] * K, s_['drop'] * K, s_['lift'] * K
    P, G = Parts(), Parts()
    eave_top = y1 - 0.2 * K                          # (the next storey's floor sits on the eave's crown)
    col_top = eave_top - drop * 0.25
    outline, rects = cross(W, bw, bp)
    # the floor (a gallery round the storey from the second up)
    for (x0, x1, z0, z1) in rects:
        P.box(x0, x1, y0, y0 + 0.0028, z0, z1, 'floor')
    # columns round the outline: at every corner and along the long runs
    cols = []
    for i in range(len(outline)):
        a, b = outline[i], outline[(i + 1) % len(outline)]
        L_ = math.hypot(b[0] - a[0], b[1] - a[1])
        nn = max(1, round(L_ / (4.2 * K)))
        for j in range(nn):
            cols.append((a[0] + (b[0] - a[0]) * j / nn, a[1] + (b[1] - a[1]) * j / nn))
    for (cx, cz) in cols:
        P.cyl(cx, cz, COL_R * K * (1.15 if si == 0 else 1), y0 + 0.0028, col_top, 'column', 8, cap=False)
    # the architrave: a painted beam on the columns, all round
    for i in range(len(outline)):
        a, b = Vector((outline[i][0], 0, outline[i][1])), Vector((outline[(i + 1) % len(outline)][0], 0, outline[(i + 1) % len(outline)][1]))
        al = (b - a).normalized(); n = Vector((al.z, 0, -al.x))
        if Vector((a.x, 0, a.z)).dot(n) < 0:
            n = -n
        pts = [a - n * 0.0012, b - n * 0.0012, b + n * 0.0012, a + n * 0.0012]
        xs = [p.x for p in pts]; zs = [p.z for p in pts]
        P.box(min(xs), max(xs), col_top - 0.0045, col_top, min(zs), max(zs), 'beam')
        # the gallery's railing between the columns (lattice: a low red screen and a top rail)
        if s_['bal']:
            P.box(min(xs), max(xs), y0 + 0.0028, y0 + 0.0028 + 1.15 * K, min(zs), max(zs), 'rail')
    # the inner wall: the cross pulled in by the gallery's depth (the ground storey's sits behind its colonnade)
    # (the fourth storey has no gallery walk: its wall stands on the column line, so the room his work
    # stands in is as big as the storey)
    inset = 0.0035 if si == 2 else bd
    inner, _ = cross(W - 2 * inset, max(bw - 2 * inset, bw * 0.6), bp)
    faces = ['+x', '+x', '+x', '+x', '+x', '-z', '-z', '-z', '-z', '-z', '-x', '-x', '-x', '-x', '-x', '+z', '+z', '+z', '+z', '+z']
    for i in range(len(inner)):
        a, b = inner[i], inner[(i + 1) % len(inner)]
        av, bv = Vector((a[0], 0, a[1])), Vector((b[0], 0, b[1]))
        al = (bv - av).normalized(); n = Vector((al.z, 0, -al.x))
        mid = (av + bv) / 2
        if mid.dot(n) < 0:
            n = -n
        wall_seg(P, G, GROUP[si], a, b, n, y0 + 0.0028, col_top - 0.0045, faces[i])
    # the ceiling over the inner rooms (not on the fourth: the gallery is seen from above when the top lifts)
    if si != 2:
        for (x0, x1, z0, z1) in cross(W - 2 * inset, max(bw - 2 * inset, bw * 0.6), bp)[1]:
            P.box(x0, x1, col_top - 0.0045, col_top - 0.0035, z0, z1, 'beam')
    # the eaves: the body's square and each bay's, the bays' a little lower, under the body's
    h = W / 2
    skirt(P, (-h, h, -h, h), eave_top, over, drop, lift, over * 0.45)
    for (x0, x1, z0, z1), sides in zip(rects[1:], ((0, 1, 3), (1, 2, 3), (0, 3, 2), (0, 1, 2))):
        skirt(P, (x0, x1, z0, z1), eave_top - 0.0022, over * 0.95, drop * 0.95, lift * 0.95, over * 0.4, n_side=10)
    # the roof's top inside the eave ring (under the next storey's floor), so nothing shows through
    if si < 4:
        P.box(-h, h, eave_top - 0.0006, eave_top, -h, h, 'tile') if si != 2 else None
    # red lanterns at the ground storey's door
    if si == 0:
        for z in (-bw * 0.32, -bw * 0.11, bw * 0.11, bw * 0.32):
            P.ball(h + bp - 0.002, col_top - 0.012, z, 0.0036, 'lantern', sy=0.8, nu=8, nv=5)
    return P, G

def terrace():
    P = Parts()
    w = 38.0 * K / 2
    y0, y1 = Y0, levels[0]
    P.box(-w, w, y0, y1, -w, w, 'stone')
    # the balustrade: posts and a rail round the edge, the stairs' gap on the front (+x)
    bh = 1.1 * K
    n = 14
    for side in range(4):
        for j in range(n + 1):
            t = -w + 2 * w * j / n
            x, z = [(w - 0.002, t), (t, -w + 0.002), (-w + 0.002, t), (t, w - 0.002)][side]
            if side == 0 and abs(t) < 0.05:
                continue
            P.box(x - 0.0017, x + 0.0017, y1, y1 + bh, z - 0.0017, z + 0.0017, 'baluster')
        for (a0, a1) in ((-w, -0.05), (0.05, w)) if side == 0 else ((-w, w),):
            if side in (0, 2):
                x = w - 0.002 if side == 0 else -w + 0.002
                P.box(x - 0.0011, x + 0.0011, y1 + bh * 0.75, y1 + bh * 0.95, a0, a1, 'baluster')
            else:
                z = -w + 0.002 if side == 1 else w - 0.002
                P.box(a0, a1, y1 + bh * 0.75, y1 + bh * 0.95, z - 0.0011, z + 0.0011, 'baluster')
    # the stairs down from the front, in front of the door
    nsteps = 6
    for i in range(nsteps):
        hgt = (y1 - y0) * (nsteps - i) / nsteps
        P.box(w + i * 0.006, w + (i + 1) * 0.006, y0, y0 + hgt, -0.05, 0.05, 'stone2')
    return P

def crown():
    """the top: the cross-gabled roof (two gable roofs crossing), its gables to the four sides, the plaque on
    the front ones, the gourd finial at the crossing"""
    P = Parts()
    s_ = ST[4]
    W = (s_['w'] - 2 * BAY_P) * K
    bw, bp = W * BAY_W, BAY_P * K
    y0 = levels[5] - 0.2 * K
    yr = TOP - 1.3 * K                               # the ridges
    half = W / 2 + bp + 1.6 * K                      # each arm's reach
    hw = bw / 2 + 1.5 * K                            # each arm's half-width at its eaves
    for axis in ('x', 'z'):
        for sgn in (1, -1):                          # the two slopes of the arm
            n = 8
            for j in range(n):
                t0, t1 = j / n, (j + 1) / n
                def p(s, t):                         # s along the arm (-1..1), t from the ridge down
                    y = yr - (yr - y0) * (1 - (1 - t) ** 2)
                    across = sgn * hw * t
                    lift = 2.8 * K * (max(0, abs(s) - 0.78) / 0.22) ** 2 * t ** 3
                    along = s * half * (1 + 0.07 * t * max(0, abs(s) - 0.8) / 0.2)
                    return (along, y + lift, across) if axis == 'x' else (across, y + lift, along)
                for i in range(12):
                    s0, s1 = -1 + 2 * i / 12, -1 + 2 * (i + 1) / 12
                    q = [p(s0, t0), p(s1, t0), p(s1, t1), p(s0, t1)]
                    P.quad(q, 'tile', out=(0, 1, 0))
                    P.quad([tuple(Vector(v) - Vector((0, 0.0016, 0))) for v in q], 'under', out=(0, -1, 0))
        # the gable ends: triangles at both ends of the arm, set in a little under the roof
        for e in (1, -1):
            g = half - 0.8 * K
            tri = [(e * g, y0 + 0.003, -hw * 0.82), (e * g, y0 + 0.003, hw * 0.82), (e * g, yr - 0.001, 0)]
            if axis == 'z':
                tri = [(t[2], t[1], t[0]) for t in tri]
            P.quad(tri, 'gable', out=((e, 0, 0) if axis == 'x' else (0, 0, e)))
        # the ridge
        if axis == 'x':
            P.box(-half, half, yr - 0.0008, yr + 0.0022, -0.0016, 0.0016, 'ridge')
        else:
            P.box(-0.0016, 0.0016, yr - 0.0008, yr + 0.0022, -half, half, 'ridge')
    # the gourd finial
    P.cyl(0, 0, 0.0032, yr, yr + 0.004, 'gold', 8)
    P.ball(0, yr + 0.0075, 0, 0.0048, 'gold', sy=0.9, nu=10, nv=6)
    P.ball(0, yr + 0.0135, 0, 0.0031, 'gold', sy=0.9, nu=10, nv=6)
    P.cone(0, 0, 0.0012, yr + 0.0158, TOP, 'gold', 6)
    return P

def plaques():
    """the 黄鹤楼 plaques on the crown's front gables (+x, and +z, which the camera sees after the turn)"""
    out = []
    s_ = ST[4]
    W = (s_['w'] - 2 * BAY_P) * K
    bp = BAY_P * K
    y0 = levels[5] - 0.2 * K
    g = W / 2 + bp + 1.6 * K - 0.8 * K + 0.0009
    pw, ph, yc = 0.04, 0.014, y0 + 0.014
    for name, ax in (('plaque_x', 'x'), ('plaque_z', 'z')):
        S = Parts()
        if ax == 'x':
            S.quad([(g, yc - ph / 2, pw / 2), (g, yc - ph / 2, -pw / 2), (g, yc + ph / 2, -pw / 2), (g, yc + ph / 2, pw / 2)], 'tex', out=(1, 0, 0))
        else:
            S.quad([(-pw / 2, yc - ph / 2, g), (pw / 2, yc - ph / 2, g), (pw / 2, yc + ph / 2, g), (-pw / 2, yc + ph / 2, g)], 'tex', out=(0, 0, 1))
        out.append((name, S))
    return out

def shift(parts):
    parts.v = [v + B(OX, 0, OZ) for v in parts.v]
    return parts

GROUPS = {}
def group(k):
    if k not in GROUPS:
        GROUPS[k] = obj(f'floor_{k}')
    return GROUPS[k]
shift(terrace()).make('terrace', parent=group(0))
for si in range(5):
    P, G = storey(si)
    E = group(GROUP[si])
    shift(P).make(f'storey{si}_solid', parent=E)
    shift(G).make(f'win_{GROUP[si]}', parent=E)
shift(crown()).make('crown_solid', parent=group(8))
for name, S in plaques():
    shift(S).make(name, parent=group(8))

# ---- the gallery in the third storey: his five projects, three to a row, then two ---------------------
PROJ = ['duriza', 'synergy', 'sondos', 'adham', 'ganeeh']
GAL = obj('gallery')
y6 = levels[2] + 0.0028
Wi = (ST[2]['w'] - 2 * BAY_P) * K - 0.007        # the room: the whole third storey inside its wall
CARDS = []
def card(name, cx, cz, w, d, sh):
    E = obj(name, None, GAL, (OX + cx, y6, OZ + cz))
    P = Parts()
    P.box(-w / 2, w / 2, 0, 0.003, -d / 2, d / 2, 'plinth')
    tilt = math.radians(30)
    ld = min(0.009, w * 0.22)
    sw = d * 0.92
    xb = w / 2 - 0.006 - ld
    Vu = Vector((-math.sin(tilt), math.cos(tilt), 0)); Nn = Vector((math.cos(tilt), math.sin(tilt), 0))
    U = Vector((0, 0, -1))
    th = 0.0015
    mid = Vector((xb, 0.003, 0)) + Vu * (sh / 2) - Nn * (th / 2)
    W_ = U.cross(Vu)
    for N_, A_, Bv, hh, ha, hb in ((W_, U, Vu, th / 2, sw / 2, sh / 2), (-W_, -U, Vu, th / 2, sw / 2, sh / 2), (U, -W_, Vu, sw / 2, th / 2, sh / 2),
                                    (-U, W_, Vu, sw / 2, th / 2, sh / 2), (Vu, U, -W_, sh / 2, sw / 2, th / 2), (-Vu, U, W_, sh / 2, sw / 2, th / 2)):
        m = mid + N_ * hh
        P.quad([tuple(m - A_ * ha - Bv * hb), tuple(m + A_ * ha - Bv * hb), tuple(m + A_ * ha + Bv * hb), tuple(m - A_ * ha + Bv * hb)], 'bezel', out=tuple(N_))
    so = P.make(name + '_stand', parent=E); so.matrix_basis = Matrix.Identity(4)
    S = Parts()
    fc = Vector((xb, 0.003, 0)) + Vu * (sh / 2) + Nn * 0.0003
    hu, hv = sw / 2 - 0.001, sh / 2 - 0.001
    S.quad([tuple(fc - U * hu - Vu * hv), tuple(fc + U * hu - Vu * hv), tuple(fc + U * hu + Vu * hv), tuple(fc - U * hu + Vu * hv)], 'tex', out=tuple(Nn))
    sc = S.make('scr_' + name, parent=E); sc.matrix_basis = Matrix.Identity(4)
    lw = d * 0.8
    lx = w / 2 - 0.0025 - ld / 2
    N = Parts()
    N.quad([(lx + ld / 2, 0.0033, lw / 2), (lx + ld / 2, 0.0033, -lw / 2), (lx - ld / 2, 0.0033, -lw / 2), (lx - ld / 2, 0.0033, lw / 2)], 'tex', out=(0, 1, 0))
    lb = N.make('lbl_' + name, parent=E); lb.matrix_basis = Matrix.Identity(4)
    CARDS.append(E)
z0, z1 = -Wi / 2 + 0.004, Wi / 2 - 0.004
cw = (z1 - z0) / 3
for i, p in enumerate(PROJ):
    r, c = divmod(i, 3)
    cz = z0 + cw * (c + 0.5) if r == 0 else z0 + cw * (c + 1.0)
    card(f'cardA_{p}', 0.036 - r * 0.068, cz, 0.058, cw * 0.88, 0.042)
cw2 = (z1 - z0) / 2
for i, p in enumerate(PROJ):
    r, c = divmod(i, 2)
    cz = z0 + cw2 * (c + 0.5) if r < 2 else 0.0
    card(f'cardB_{p}', 0.048 - r * 0.048, cz, 0.044, cw2 * 0.86, 0.046)

# ---- pines round the terrace ---------------------------------------------------------------------------
TREES = obj('trees')
spots = [(0.225, -0.13, 1.25), (0.235, 0.12, 1.05), (0.06, 0.235, 1.2), (-0.14, 0.215, 1.35), (-0.235, -0.03, 1.1), (-0.09, -0.225, 1.3), (0.15, -0.235, 0.95)]
P = Parts()
for (tx, tz, s) in spots:
    P.cyl(tx, tz, 0.003 * s, Y0, Y0 + 0.03 * s, 'trunk', 7)
    for i, (r, y_a, y_b) in enumerate(((0.032, 0.022, 0.07), (0.026, 0.045, 0.09), (0.018, 0.068, 0.108))):
        P.cone(tx, tz, r * s, Y0 + y_a * s, Y0 + y_b * s, 'pine', 9)
shift(P).make('trees_mesh', parent=TREES)

# the facade clock, for the site: its x scale is their facade blend
FAC = obj('facade')

# ---- the motion, frame by frame -----------------------------------------------------------------------
def key(o, M_, f):
    o.matrix_basis = M_
    o.keyframe_insert('location', frame=f)
    o.keyframe_insert('rotation_quaternion', frame=f)
    o.keyframe_insert('scale', frame=f)
for o in list(GROUPS.values()) + [GAL, TREES, FAC] + CARDS:
    o.rotation_mode = 'QUATERNION'
card_base = {c.name: c.matrix_basis.copy() for c in CARDS}
# the top lifted where the camera still sees it: theirs goes 57 cm straight up, out of the shot, and the tower was
# left without its top ("the tower is not whole"). His top storeys rise a little and are carried to the camera's
# left (its look at that beat, from (-0.56, 2.04, 0.84) onto the tower), hovering beside the opened storey, clear
# of his work in it, then come back when theirs comes down
LID_UP, LID_AWAY, LID_SIDE = float(arg('--lid-up', '0.05')), float(arg('--lid-away', '0.06')), float(arg('--lid-side', '0.27'))
AWAY = Vector((0.55, 0.83, 0.0)).normalized()          # (in Blender's axes: the site's +x, -z: away from the camera)
LEFT = Vector((-0.83, 0.55, 0.0)).normalized()         # (to the camera's left: beside the tower, clear of the gallery)
LIFT_MAX = max(D['floor8_base'][f].translation.z for f in range(NF)) or 1.0
def lid(k, f):
    M_ = D[SRC[k]][f]
    if k not in (7, 8) or not (100 < f < 560):
        return M_
    dz = D['floor8_base'][f].translation.z
    u = max(0.0, min(1.0, dz / LIFT_MAX))
    return Matrix.Translation(AWAY * (LID_AWAY * u) + LEFT * (LID_SIDE * u) + Vector((0, 0, LID_UP * u - dz))) @ M_
for f in range(NF):
    for k, E in GROUPS.items():
        key(E, lid(k, f), f)
    key(GAL, D['office_layout'][f], f)
    key(TREES, D['trees'][f], f)
    for c in CARDS:
        v = (1 - K_DOWN[f]) if c.name.startswith('cardA') else K_UP[f]
        v = max(1e-4, min(1, v))
        key(c, card_base[c.name] @ Matrix.Diagonal((0.6 + 0.4 * v, 0.6 + 0.4 * v, v, 1)), f)
    key(FAC, Matrix.Diagonal((max(1e-4, K_FAC[f]), 1, 1, 1)), f)
scn.frame_start, scn.frame_end = 0, NF - 1
scn.frame_set(NF - 1)

info = {'pivot': [OX, OZ], 'levels': levels + [TOP], 'scale': K, 'atlas': {'cols': CELL_COLS, 'rows': CELL_ROWS},
        'cells': cells, 'projects': PROJ, 'groups': sorted(GROUPS), 'clip': {'frames': NF, 'fps': 24},
        'plan': {'widths': [s_['w'] * K for s_ in ST], 'bay': BAY_W, 'bay_out': BAY_P * K, 'gallery': BAL_D * K}}
os.makedirs(os.path.dirname(INFO), exist_ok=True)
json.dump(info, open(INFO, 'w'), indent=0)
print('cells', len(cells), 'cards', len(CARDS), 'height', round(TOP - Y0, 3), 'levels', [round(l, 3) for l in levels])

DRAW = arg('--draw')
if DRAW:
    # the drawings for his sheet, from this model: its ground plan (cut at the ground storey's middle, seen from
    # above), its front elevation, and a three-quarter view (the sheet that unrolls), each in pencil (sketchy
    # Freestyle strokes on nothing), drawn clean, and in its colours with clean lines
    os.makedirs(DRAW, exist_ok=True)
    for o in (FAC,):
        pass
    scn.frame_set(NF - 1)
    scn.render.engine = 'BLENDER_EEVEE'
    scn.render.film_transparent = True
    scn.view_settings.view_transform = 'Standard'
    scn.render.use_freestyle = True
    scn.render.line_thickness_mode = 'ABSOLUTE'
    vl = scn.view_layers[0]
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(140)
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('lines')
    ls.select_by_visibility = True; ls.visibility = 'VISIBLE'
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new('pencil')
    lst = ls.linestyle
    # surfaces: nothing (pencil, clean) or flat colour (real)
    hold = bpy.data.materials.new('hold'); hold.use_nodes = True
    nt = hold.node_tree; nt.nodes.clear()
    o_ = nt.nodes.new('ShaderNodeOutputMaterial'); h_ = nt.nodes.new('ShaderNodeHoldout'); nt.links.new(h_.outputs[0], o_.inputs['Surface'])
    flat = {}
    for nme, c in TINTS.items():
        m = bpy.data.materials.new('flat_' + nme); m.use_nodes = True
        t = m.node_tree; t.nodes.clear()
        out = t.nodes.new('ShaderNodeOutputMaterial'); em = t.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (*[min(1, x * 1.05) for x in c], 1); em.inputs['Strength'].default_value = 1.0
        t.links.new(em.outputs[0], out.inputs['Surface'])
        flat['m_' + nme] = m
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    orig = {o.name: [s_.material for s_ in o.material_slots] for o in meshes}
    def surfaces(mode):
        for o in meshes:
            for i, s_ in enumerate(o.material_slots):
                s_.material = hold if mode != 'real' else flat.get(orig[o.name][i].name, hold)
    def style(mode, px, vname=''):
        lst.color = (0.24, 0.21, 0.19) if mode == 'pencil' else (0.2, 0.18, 0.17)
        lst.alpha = 0.92
        lst.thickness = (3.6 if mode == 'pencil' else 2.2) * px / 2048 * (1.9 if vname == 'elev' else 1.35 if vname == 'axo' else 1)
        for gm in list(lst.geometry_modifiers):
            if gm.type != 'SAMPLING':
                lst.geometry_modifiers.remove(gm)
        if mode == 'pencil':
            n1 = lst.geometry_modifiers.new('wobble', 'PERLIN_NOISE_1D'); n1.frequency = 9; n1.amplitude = 1.6 * px / 2048; n1.octaves = 2
            bs = lst.geometry_modifiers.new('reach', 'BACKBONE_STRETCHER'); bs.backbone_length = 4 * px / 2048
            lst.chaining = 'SKETCHY'; lst.rounds = 2
        else:
            lst.chaining = 'PLAIN'
    grey = bpy.data.materials.new('grey'); grey.use_nodes = True
    gb = grey.node_tree.nodes.get('Principled BSDF'); gb.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); gb.inputs['Roughness'].default_value = 1
    sunl = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sunl.data.energy = 3.5
    sunl.rotation_euler = (math.radians(50), math.radians(-35), math.radians(-40))
    scn.world = scn.world or bpy.data.worlds.new('w')
    scn.world.use_nodes = True
    bg = scn.world.node_tree.nodes.get('Background')
    if bg: bg.inputs['Strength'].default_value = 0.35
    cam = bpy.data.objects.new('dcam', bpy.data.cameras.new('dcam')); coll.objects.link(cam); scn.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.clip_start = 0.001; cam.data.clip_end = 10
    cam.rotation_mode = 'QUATERNION'
    piv = B(OX, 0, OZ)
    views = {
        # the plan: from above, cut at the ground storey's middle; the image's top is -z, its right +x
        'plan': dict(px=(2048, 2048), at=piv + Vector((0, 0, (levels[0] + levels[1]) / 2 - 0.01)), look=Vector((0, 0, -1)), up=B(0, 0, -1), scale=0.36),
        # the front: from +x, the whole tower
        'elev': dict(px=(1024, 2048), at=piv + B(2.0, (Y0 + TOP) / 2, 0), look=B(-1, 0, 0), up=Vector((0, 0, 1)), scale=0.52),
        # three-quarter: from the front left, above, in perspective
        'axo': dict(px=(2048, 2048), at=piv + B(0.55, 1.33, 0.62), target=piv + B(0, 0.97, 0), persp=24, scale=0.0),
    }
    for vname, v in views.items():
        W_, H_ = v['px']
        scn.render.resolution_x, scn.render.resolution_y = W_, H_
        if v.get('persp'):
            cam.data.type = 'PERSP'; cam.data.lens = 50
            cam.location = v['at']
            cam.rotation_quaternion = (v['target'] - v['at']).to_track_quat('-Z', 'Y')
        else:
            cam.data.type = 'ORTHO'; cam.data.ortho_scale = v['scale']
            cam.location = v['at']
            q = v['look'].to_track_quat('-Z', 'Y')
            # turn about the view so the image's up is v['up']
            cur_up = q @ Vector((0, 1, 0))
            q = cur_up.rotation_difference(v['up'] - v['look'] * v['up'].dot(v['look'])) @ q if cur_up.dot(v['up']) < 0.999 else q
            cam.rotation_quaternion = q
        for mode in ('pencil', 'clean', 'real', 'shade'):
            if vname == 'axo' and mode not in ('pencil', 'shade'):
                continue
            if mode == 'shade' and vname != 'axo':
                continue
            if mode == 'shade':
                # a tone under the strokes, as a pencil sketch's hatching: the model in grey, lit from the left, no lines
                scn.render.use_freestyle = False
                for o in meshes:
                    for i, s_ in enumerate(o.material_slots):
                        s_.material = grey
                if not sunl.users_collection:
                    coll.objects.link(sunl)
            else:
                scn.render.use_freestyle = True
                surfaces(mode); style(mode, W_, vname)
            scn.render.filepath = os.path.join(DRAW, f'ych-{vname}-{mode}.png')
            bpy.ops.render.render(write_still=True)
            print('drew', vname, mode)
    sys.exit(0)

if PREVIEW:
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.show_cavity = True
    scn.display.shading.color_type = 'MATERIAL'
    scn.render.resolution_x, scn.render.resolution_y = 700, 700
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); coll.objects.link(cam)
    cam.data.lens = 50; scn.camera = cam
    if '--photo' in argv:
        # as the reference photo: from the front (+x), a little below the crown's height, at the end of the clip
        scn.frame_set(NF - 1)
        foot = B(OX, 0.99, OZ)
        if '--only' in argv:
            keep = arg('--only')
            for o in bpy.data.objects:
                if o.type == 'MESH' and o.name != keep:
                    o.hide_render = True
        if '--close' in argv:
            scn.display.shading.show_backface_culling = '--cull' in argv
            foot = B(OX, 1.06, OZ)
        for j, (az, el, d) in enumerate([(90, 6, 1.05), (90 + 35, 16, 1.1)] if '--close' not in argv else [(90, -14, 0.55), (130, 22, 0.6)]):
            a, e = math.radians(az), math.radians(el)
            cam.location = foot + d * Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
            cam.rotation_mode = 'QUATERNION'
            cam.rotation_quaternion = (foot - cam.location).to_track_quat('-Z', 'Y')
            scn.render.filepath = f'{PREVIEW}-photo-{j}.png'
            bpy.ops.render.render(write_still=True)
        sys.exit(0)
    foot = B(OX, 0.98, OZ)
    for f in [int(x) for x in arg('--frames', '70,180,618').split(',')]:
        scn.frame_set(f)
        for j, (az, el, d) in enumerate([(-125, 32, 1.2), (55, 50, 1.1)]):
            a, e = math.radians(az), math.radians(el)
            cam.location = foot + d * Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
            cam.rotation_mode = 'QUATERNION'
            cam.rotation_quaternion = (foot - cam.location).to_track_quat('-Z', 'Y')
            scn.render.filepath = f'{PREVIEW}-{f:03d}-{j}.png'
            bpy.ops.render.render(write_still=True)
    sys.exit(0)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_materials='EXPORT',
                          export_yup=True, export_animations=True, export_animation_mode='SCENE', export_force_sampling=True,
                          export_optimize_animation_size=True, export_frame_range=True, export_texcoords=True, export_normals=True)
print('wrote', OUT)
