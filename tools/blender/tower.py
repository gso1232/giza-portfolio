"""
The site as a building: what rises off his sheet where the reference's building rises (their building.glb:
the same place, the same size, the same nine levels), every floor a section of his site.

  floor 0     the lobby: the Hero, his name over the door
  floors 1-2  About
  floors 3-7  Work: one project a floor behind the windows; floor 6 is the gallery the roof lifts off
              (Duriza, Synergy, Sondos, Adham, Ganeeh, each on a stand with its name), re-laid in two
              columns after the red pen
  floor 8     the roof: Contact, a sign and an antenna

Each floor's front band is a browser window's chrome (three dots); the lift core is a scroll bar.

It moves as theirs does, frame for frame: each of our floors carries the motion of their floor of the
same level (their building_animation, read from their file, which the user downloaded; only its motion is
used: none of their meshes are in the export): their floor's place at each frame, relative to where it
ends, applied to ours. The gallery grows and re-lays on their office layout's clock (its scale, then its
'down' and 'up' blends); the fins grow out on their facade blend's clock; the trees rise with theirs.

  blender -b --factory-startup -P tools/blender/tower.py -- [--out public/inside/tower.glb]
          [--info public/inside/tower-info.json] [--theirs blender/illoca/building.glb] [--preview <prefix>]

Everything is placed in the site's axes (metres, y up) and turned into Blender's (x, -z, y) as it is made.
Ours is drawn as it stands at the end of their clip (after their quarter turn).
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, d=None, cast=str):
    return cast(argv[argv.index(k) + 1]) if k in argv else d

OUT = os.path.abspath(arg('--out', 'public/inside/tower.glb'))
INFO = os.path.abspath(arg('--info', 'public/inside/tower-info.json'))
THEIRS = os.path.abspath(arg('--theirs', 'blender/illoca/building.glb'))
PREVIEW = arg('--preview')

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
coll = scn.collection

CB = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
def B(x, y, z):
    return Vector((x, -z, y))

# ---- tints (the site makes each its two tones) -------------------------------------------------------
TINTS = {
    'wall': (1, 1, 1), 'slab': (0.93, 0.93, 0.93), 'fascia': (0.97, 0.97, 0.97), 'mull': (0.9, 0.9, 0.9),
    'core': (0.84, 0.84, 0.84), 'thumb': (0.55, 0.55, 0.55), 'rail': (0.95, 0.95, 0.95), 'fin': (1, 1, 1),
    'dot_r': (0.88, 0.38, 0.31), 'dot_y': (0.91, 0.71, 0.29), 'dot_g': (0.43, 0.68, 0.35),
    'plinth': (0.96, 0.96, 0.96), 'bezel': (0.3, 0.3, 0.3), 'leaf': (0.86, 0.88, 0.8), 'trunk': (0.7, 0.6, 0.5),
    'roof': (0.9, 0.9, 0.9), 'mast': (0.7, 0.7, 0.7), 'tex': (1, 1, 1), 'glass': (1, 1, 1),
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

class Parts:
    """faces gathered in the site's axes, one material each, made into one mesh"""
    def __init__(self):
        self.v, self.f, self.m, self.uv = [], [], [], []
    def quad(self, pts, mat, uvs=None):
        i = len(self.v)
        self.v += [B(*p) for p in pts]
        self.f.append(tuple(range(i, i + len(pts))))
        self.m.append(mat)
        self.uv.append(uvs or ([(0, 0), (1, 0), (1, 1), (0, 1)] if len(pts) == 4 else [(0.5, 0.5)] * len(pts)))
    def box(self, x0, x1, y0, y1, z0, z1, mat, skip=()):
        P = lambda a, b, c: (x1 if a else x0, y1 if b else y0, z1 if c else z0)
        faces = {'-x': (P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)), '+x': (P(1, 0, 1), P(1, 0, 0), P(1, 1, 0), P(1, 1, 1)),
                 '-y': (P(0, 0, 1), P(0, 0, 0), P(1, 0, 0), P(1, 0, 1)), '+y': (P(0, 1, 0), P(0, 1, 1), P(1, 1, 1), P(1, 1, 0)),
                 '-z': (P(1, 0, 0), P(0, 0, 0), P(0, 1, 0), P(1, 1, 0)), '+z': (P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1))}
        for k, q in faces.items():
            if k not in skip:
                self.quad(q, mat)
    def cyl(self, cx, cz, r, y0, y1, mat, n=12, axis='y'):
        for j in range(n):
            a0, a1 = 2 * math.pi * j / n, 2 * math.pi * (j + 1) / n
            c0, s0, c1, s1 = math.cos(a0) * r, math.sin(a0) * r, math.cos(a1) * r, math.sin(a1) * r
            self.quad([(cx + c0, y0, cz + s0), (cx + c0, y1, cz + s0), (cx + c1, y1, cz + s1), (cx + c1, y0, cz + s1)], mat)
        self.quad([(cx + math.cos(2 * math.pi * j / n) * r, y1, cz - math.sin(2 * math.pi * j / n) * r) for j in range(n)], mat)
    def obox(self, c, U, V, hu, hv, hw, mat):
        """a box turned to the axes U (across), V (up), W = U x V (out), half sizes hu, hv, hw"""
        c, U, V = Vector(c), Vector(U).normalized(), Vector(V).normalized()
        W = U.cross(V)
        for N, A, Bv, h, ha, hb in ((W, U, V, hw, hu, hv), (-W, -U, V, hw, hu, hv), (U, -W, V, hu, hw, hv), (-U, W, V, hu, hw, hv),
                                     (V, U, -W, hv, hu, hw), (-V, U, W, hv, hu, hw)):
            m = c + N * h
            self.quad([tuple(m - A * ha - Bv * hb), tuple(m + A * ha - Bv * hb), tuple(m + A * ha + Bv * hb), tuple(m - A * ha + Bv * hb)], mat)
    def make(self, name, parent=None, origin=(0, 0, 0)):
        o_ = B(*origin)
        me = bpy.data.meshes.new(name)
        me.from_pydata([v - o_ for v in self.v], [], self.f)
        me.update()
        uv = me.uv_layers.new(name='UVMap')
        li = 0
        for p, uvs in zip(me.polygons, self.uv):
            for k, lp in enumerate(p.loop_indices):
                uv.data[lp].uv = uvs[k]
        names = sorted(set(self.m))
        for n_ in names:
            me.materials.append(M(n_))
        for p, mname in zip(me.polygons, self.m):
            p.material_index = names.index(mname)
        me.validate()
        o = obj(name, me, parent, origin)
        return o

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
    o = theirs[name]
    kb = o.data.shape_keys.key_blocks[block]
    out = []
    for f in range(NF):
        scn.frame_set(f)
        out.append(kb.value)
    return out
FLOOR_SRC = ['floor0', 'floor1', 'floor2', 'floor3', 'floor4', 'floor5', 'floor6', 'floor7', 'floor8_base']
D = {n: delta(n) for n in FLOOR_SRC + ['office_layout', 'trees']}
K_DOWN, K_UP = key_of('office_layout', 'down'), key_of('office_layout', 'up')
K_FAC = key_of('facade_morph_01_down', '03')
# the quarter turn, for the plan on the sheet: their floor 0 at frame 70 (risen, not yet turned)
d70 = D['floor0'][70]
yaw70 = d70.to_quaternion().to_euler().z
print('their floor 0 at frame 70: turned', round(math.degrees(yaw70), 2), 'deg, moved', [round(c, 4) for c in d70.translation])
for o in list(theirs.values()):
    bpy.data.objects.remove(o, do_unlink=True)
for me in [m for m in bpy.data.meshes if m.users == 0]:
    bpy.data.meshes.remove(me)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# ---- ours ---------------------------------------------------------------------------------------------
OX, OZ = -0.051, 0.074                              # their pivot: every floor turns and grows about it
L = [0.758, 0.817, 0.865, 0.910, 0.955, 0.999, 1.044, 1.088, 1.134]
TOP = 1.182
# the floors' blocks, (x0, x1, z0, z1) about the pivot, as it ends: laid on a 12-column grid (a column is
# 25 mm, the building 12 wide), as a page's blocks are; each floor a main block and one that steps out of it,
# so the stack reads as massing, as theirs does. Floor 0 (the lobby) and floor 6 (the gallery the roof lifts
# off) are one block each; floor 8 is the penthouse on the roof.
G_ = 0.025
def gr(x0, x1, z0, z1):
    return (x0 * G_, x1 * G_, z0 * G_, z1 * G_)
BLOCKS = [
    [gr(-6.6, 6.0, -6.0, 6.0)],
    [gr(-6.0, 3.0, -5.0, 5.0), gr(2.0, 6.2, -3.0, 4.0)],
    [gr(-5.0, 5.0, -5.6, 4.0), gr(-6.2, -1.0, 2.0, 6.0)],
    [gr(-5.6, 4.0, -5.0, 5.0), gr(0.0, 6.0, -6.2, -1.0)],
    [gr(-4.4, 5.6, -4.0, 5.6), gr(-6.0, -2.0, -5.6, 1.0)],
    [gr(-5.4, 4.6, -5.2, 4.4), gr(2.0, 6.0, 1.0, 6.0)],
    [gr(-5.2, 5.2, -5.0, 5.0)],
    [gr(-5.0, 5.6, -4.8, 5.2), gr(-6.0, -2.4, 0.4, 6.0)],
    [gr(-4.0, 3.0, -3.8, 4.4)],
]
FP = [b[0] for b in BLOCKS]                          # (each floor's main block)
T, TW, BAY = 0.004, 0.0028, 0.042
SP = [0.004, 0.008, 0.008, 0.008, 0.008, 0.008, 0.008, 0.008, 0.008]
FA = [0.013, 0.007, 0.007, 0.007, 0.007, 0.007, 0.007, 0.007, 0.007]
CELL_COLS, CELL_ROWS = 32, 16
cells = []                                          # the windows' pictures: [floor, face, bay, bays]
def cell_uv(i):
    c, r = i % CELL_COLS, i // CELL_COLS
    u0, u1 = c / CELL_COLS, (c + 1) / CELL_COLS
    v1, v0 = 1 - r / CELL_ROWS, 1 - (r + 1) / CELL_ROWS
    inset = 0.0015
    return [(u0 + inset, v0 + inset), (u1 - inset, v0 + inset), (u1 - inset, v1 - inset), (u0 + inset, v1 - inset)]

def walls(P, G, k, fp, y0, y1, sp, fa, fins, others=(), dots=False, tag=0):
    """four walls round fp: spandrel, the window band (mullions, recessed glass), the fascia; fins out of
    the mullions (one object a face, grown out along its face's normal). A face wholly inside another of
    the floor's blocks is left out"""
    x0, x1, z0, z1 = fp
    def inside(fname):
        for o in others:
            if fname in ('+x', '-x'):
                c = x1 if fname == '+x' else x0
                if o[0] < c < o[1] and o[2] <= z0 and z1 <= o[3]:
                    return True
            else:
                c = z1 if fname == '+z' else z0
                if o[2] < c < o[3] and o[0] <= x0 and x1 <= o[1]:
                    return True
        return False
    yb, yt = y0 + T + sp, y1 - fa
    # faces as (name, start, along, outward, length); 'along' runs left to right seen from outside
    faces = [('+x', Vector((x1, 0, z1)), Vector((0, 0, -1)), Vector((1, 0, 0)), z1 - z0),
             ('-z', Vector((x1, 0, z0)), Vector((-1, 0, 0)), Vector((0, 0, -1)), x1 - x0),
             ('-x', Vector((x0, 0, z0)), Vector((0, 0, 1)), Vector((-1, 0, 0)), z1 - z0),
             ('+z', Vector((x0, 0, z1)), Vector((1, 0, 0)), Vector((0, 0, 1)), x1 - x0)]
    for fname, s0, al, nrm, ln in faces:
        if inside(fname):
            continue
        inn = -nrm * TW
        def pt(a, y, d=0.0):                         # a point a along the face, at height y, d out of it
            p = s0 + al * a + nrm * d
            return (p.x, y, p.z)
        def slabq(a0, a1, ya, yb_, d_out, d_in, mat):  # a box on the face: a0..a1 along, ya..yb up, d_in..d_out
            pts = [pt(a0, ya, d_in), pt(a1, ya, d_in), pt(a1, ya, d_out), pt(a0, ya, d_out)]
            xs = [p[0] for p in pts]; zs = [p[2] for p in pts]
            P.box(min(xs), max(xs), ya, yb_, min(zs), max(zs), mat)
        slabq(0, ln, y0 + T, yb, 0, -TW, 'wall')                       # spandrel
        slabq(0, ln, yt, y1, 0.0006, -TW, 'fascia')                    # fascia, a hair proud
        n = max(1, round((ln - 0.008) / BAY))
        w = (ln - 0.008) / n
        mull = 0.0024
        fin = Parts()
        for j in range(n + 1):
            a = 0.004 + j * w
            wid = 0.008 if j in (0, n) else mull
            aa = min(max(a - wid / 2, 0), ln - wid)
            slabq(aa, aa + wid, yb, yt, 0, -TW, 'mull')
            if fins is not None and 0 < j < n:
                c = s0 + al * a
                fin.box(*sorted((c.x - al.x * 0.0008 - 0.0, c.x + al.x * 0.0008 + nrm.x * 0.0075)), yb - 0.001, yt + 0.001,
                        *sorted((c.z - al.z * 0.0008, c.z + al.z * 0.0008 + nrm.z * 0.0075)), 'fin')
        for j in range(n):
            a0, a1 = 0.004 + j * w + mull / 2, 0.004 + (j + 1) * w - mull / 2
            if j == 0: a0 = 0.008
            if j == n - 1: a1 = ln - 0.008
            i = len(cells)
            cells.append([k, fname, j, n])
            G.quad([pt(a0, yb, -0.0012), pt(a1, yb, -0.0012), pt(a1, yt, -0.0012), pt(a0, yt, -0.0012)], 'glass', cell_uv(i))
        # browser chrome on the two faces that face the camera: three dots at the fascia's left end
        if dots and fname in ('+x', '+z'):
            for d, col in enumerate(('dot_r', 'dot_y', 'dot_g')):
                a = 0.012 + d * 0.0062
                c = s0 + al * a + nrm * 0.0006
                yc = (yt + y1) / 2
                r = min(0.0019, fa * 0.28)
                pts = [pt(a + math.cos(2 * math.pi * q / 10) * r, yc + math.sin(2 * math.pi * q / 10) * r, 0.0011) for q in range(10)]
                P.quad(pts, col)
        if fins is not None and fin.v:
            # the face's fins, about the face's middle on the wall, so their scale grows them out of it
            mid = s0 + al * (ln / 2)
            fo = fin.make(f'fin_{k}_{tag}_{fname}', origin=(mid.x, 0, mid.z))
            fo['axis'] = 'x' if fname in ('+x', '-x') else 'z'
            fins.append(fo)

def floor(k):
    fp = [c for c in FP[k]]
    y0, y1 = L[k], (L[k + 1] if k < 8 else TOP)
    P, G = Parts(), Parts()
    fins = []
    if k < 8:
        for bi, b in enumerate(BLOCKS[k]):
            others = [o for oi, o in enumerate(BLOCKS[k]) if oi != bi]
            P.box(b[0] - 0.002, b[1] + 0.002, y0, y0 + T + (0.002 if k == 0 else 0), b[2] - 0.002, b[3] + 0.002, 'slab')
            walls(P, G, k, b, y0, y1, SP[k], FA[k], fins if 1 <= k <= 7 else None, others, dots=(bi == 0), tag=bi)
            if k != 6:                               # a lid (the gallery's is the floor above's ceiling)
                P.box(b[0] + 0.0005, b[1] - 0.0005, y1 - 0.0012 - 0.0004 * bi, y1 - 0.0004 * bi, b[2] + 0.0005, b[3] - 0.0005, 'roof')
        if k == 7:                                   # the gallery's ceiling, lifted with this floor
            q = FP[6]
            P.box(q[0] - 0.002, q[1] + 0.002, y0, y0 + T, q[2] - 0.002, q[3] + 0.002, 'slab')
    else:
        # the roof: a penthouse (Contact), a parapet round the slab, the antenna, the sign
        q = FP[7]
        P.box(q[0] - 0.002, q[1] + 0.002, y0, y0 + T, q[2] - 0.002, q[3] + 0.002, 'slab')
        walls(P, G, k, fp, y0, y1 - 0.004, 0.006, 0.007, None, dots=True)
        P.box(fp[0] - 0.002, fp[1] + 0.002, y1 - 0.004, y1, fp[2] - 0.002, fp[3] + 0.002, 'roof')
        ex0, ex1, ez0, ez1 = q[0] - 0.002, q[1] + 0.002, q[2] - 0.002, q[3] + 0.002
        h = 0.009
        P.box(ex0, ex1, y0 + T, y0 + T + h, ez0, ez0 + 0.002, 'rail'); P.box(ex0, ex1, y0 + T, y0 + T + h, ez1 - 0.002, ez1, 'rail')
        P.box(ex0, ex0 + 0.002, y0 + T, y0 + T + h, ez0, ez1, 'rail'); P.box(ex1 - 0.002, ex1, y0 + T, y0 + T + h, ez0, ez1, 'rail')
        P.cyl(-0.075, 0.08, 0.0022, y1, y1 + 0.075, 'mast', 8)
        P.cyl(-0.075, 0.08, 0.0045, y1 + 0.03, y1 + 0.033, 'mast', 10)
        P.box(-0.09, -0.06, y1, y1 + 0.006, 0.065, 0.095, 'core')
        # the sign's posts and board, on the terrace, facing +x
        sx, sz = 0.11, 0.0
        P.box(sx - 0.0015, sx + 0.0015, y0 + T, y0 + T + 0.045, sz - 0.05, sz - 0.047, 'mast')
        P.box(sx - 0.0015, sx + 0.0015, y0 + T, y0 + T + 0.045, sz + 0.047, sz + 0.05, 'mast')
        P.box(sx - 0.002, sx + 0.0005, y0 + T + 0.018, y0 + T + 0.046, sz - 0.052, sz + 0.052, 'bezel')
        S = Parts()
        S.quad([(sx + 0.0006, y0 + T + 0.019, sz + 0.051), (sx + 0.0006, y0 + T + 0.019, sz - 0.051),
                (sx + 0.0006, y0 + T + 0.045, sz - 0.051), (sx + 0.0006, y0 + T + 0.045, sz + 0.051)], 'tex')
        shift(S).make('sign_hello', origin=(OX, 0, OZ))
    # balconies on some floors, on alternating faces
    BAL = {2: ('+x', 0.3), 3: ('-x', 0.6), 4: ('+z', 0.62), 5: ('+x', 0.7), 7: ('+z', 0.6)}
    if k in BAL:
        side, at_ = BAL[k]
        x0, x1, z0, z1 = fp
        bw, bd, rh = 0.085, 0.022, 0.009
        if side in ('+z', '-z'):
            cx = x0 + (x1 - x0) * at_
            zz = (z1, z1 + bd) if side == '+z' else (z0 - bd, z0)
            P.box(cx - bw / 2, cx + bw / 2, y0, y0 + T, *zz, 'slab')
            ze = zz[1] if side == '+z' else zz[0]
            P.box(cx - bw / 2, cx + bw / 2, y0 + T, y0 + T + rh, ze - 0.0015, ze + 0.0015, 'rail')
            P.box(cx - bw / 2, cx - bw / 2 + 0.0015, y0 + T, y0 + T + rh, *zz, 'rail'); P.box(cx + bw / 2 - 0.0015, cx + bw / 2, y0 + T, y0 + T + rh, *zz, 'rail')
        else:
            cz = z0 + (z1 - z0) * at_
            xx = (x1, x1 + bd) if side == '+x' else (x0 - bd, x0)
            P.box(*xx, y0, y0 + T, cz - bw / 2, cz + bw / 2, 'slab')
            xe = xx[1] if side == '+x' else xx[0]
            P.box(xe - 0.0015, xe + 0.0015, y0 + T, y0 + T + rh, cz - bw / 2, cz + bw / 2, 'rail')
            P.box(*xx, y0 + T, y0 + T + rh, cz - bw / 2, cz - bw / 2 + 0.0015, 'rail'); P.box(*xx, y0 + T, y0 + T + rh, cz + bw / 2 - 0.0015, cz + bw / 2, 'rail')
    # the scroll bar: the lift core up the +z face's right end, its thumb on floors 3-4
    if 1 <= k <= 7:
        x0, x1, z0, z1 = fp
        hid = any(o[0] < x1 - 0.031 < o[1] and o[2] < z1 + 0.005 < o[3] for o in BLOCKS[k][1:])
        if not hid:
            P.box(x1 - 0.04, x1 - 0.022, y0, y1, z1, z1 + 0.011, 'thumb' if k in (3, 4) else 'core')
    # the lobby: a canopy over the door on +x, his name on the +x fascia, the site's name on +z
    if k == 0:
        x0, x1, z0, z1 = fp
        P.box(x1, x1 + 0.026, y1 - FA[0] - 0.004, y1 - FA[0] - 0.0015, -0.04, 0.04, 'slab')
        S = Parts()
        yA, yB = y1 - FA[0] + 0.0015, y1 - 0.0015
        S.quad([(x1 + 0.0009, yA, 0.07), (x1 + 0.0009, yA, -0.07), (x1 + 0.0009, yB, -0.07), (x1 + 0.0009, yB, 0.07)], 'tex')
        shift(S).make('sign_name', origin=(OX, 0, OZ))
        S = Parts()
        S.quad([(-0.06, yA, z1 + 0.0009), (0.06, yA, z1 + 0.0009), (0.06, yB, z1 + 0.0009), (-0.06, yB, z1 + 0.0009)], 'tex')
        shift(S).make('sign_site', origin=(OX, 0, OZ))
    return P, G, fins

def shift(parts):
    parts.v = [v + B(OX, 0, OZ) for v in parts.v]
    return parts

# the floors: an empty each at the world's origin carrying their floor's motion, ours under it
FLOORS, FINS = [], []
info_floor = []
for k in range(9):
    E = obj(f'floor_{k}')
    P, G, fins = floor(k)
    so = shift(P).make(f'floor{k}_solid', parent=E)
    go = shift(G).make(f'win_{k}', parent=E)
    for name in ('sign_name', 'sign_site', 'sign_hello'):
        o = bpy.data.objects.get(name)
        if o and o.parent is None and ((k == 0 and name != 'sign_hello') or (k == 8 and name == 'sign_hello')):
            o.parent = E
    for fo in fins:
        fo.matrix_basis = Matrix.Translation(fo.matrix_basis.translation + B(OX, 0, OZ))
        fo.parent = E
        FINS.append(fo)
    FLOORS.append(E)

# ---- the gallery on floor 6: his five projects, three to a row, then two -----------------------------
PROJ = ['duriza', 'synergy', 'sondos', 'adham', 'ganeeh']
GAL = obj('gallery')                                # carries their office layout's motion
y6 = L[6] + T
x0, x1, z0, z1 = FP[6]
CARDS = []
def card(name, cx, cz, w, d, sh):
    """a stand: a plinth, a screen tilted back toward +x (the camera's side before the turn), its name
    on the plinth in front of it, read from +x"""
    E = obj(name, None, GAL, (OX + cx, y6, OZ + cz))
    P = Parts()
    P.box(-w / 2, w / 2, 0, 0.004, -d / 2, d / 2, 'plinth')
    # the screen: a board leaning back 30 degrees from its foot just behind the name, its face to +x
    tilt = math.radians(30)
    ld = min(0.012, w * 0.22)
    sw = d * 0.92                                   # across the stand (z)
    xb = w / 2 - 0.008 - ld
    Vu = Vector((-math.sin(tilt), math.cos(tilt), 0)); Nn = Vector((math.cos(tilt), math.sin(tilt), 0))
    U = Vector((0, 0, -1))                          # across, left to right seen from +x
    th = 0.0018
    mid = Vector((xb, 0.004, 0)) + Vu * (sh / 2) - Nn * (th / 2)
    P.obox(mid, U, Vu, sw / 2, sh / 2, th / 2, 'bezel')
    # a strut behind it
    P.obox(Vector((xb - sh * 0.45 * math.sin(tilt) - 0.006, 0.004 + sh * 0.22, 0)), U, Vector((0.35, 1, 0)), 0.002, sh * 0.24, 0.0008, 'bezel')
    so = P.make(name + '_stand', parent=E)
    so.matrix_basis = Matrix.Identity(4)
    S = Parts()
    fc = Vector((xb, 0.004, 0)) + Vu * (sh / 2) + Nn * 0.0003
    hu, hv = sw / 2 - 0.0012, sh / 2 - 0.0012
    S.quad([tuple(fc - U * hu - Vu * hv), tuple(fc + U * hu - Vu * hv), tuple(fc + U * hu + Vu * hv), tuple(fc - U * hu + Vu * hv)], 'tex')
    sc = S.make('scr_' + name, parent=E); sc.matrix_basis = Matrix.Identity(4)
    # the name on the plinth, in front of the board, read from +x (its top toward -x)
    lw = d * 0.8
    lx = w / 2 - 0.003 - ld / 2
    N = Parts()
    N.quad([(lx + ld / 2, 0.0043, lw / 2), (lx + ld / 2, 0.0043, -lw / 2), (lx - ld / 2, 0.0043, -lw / 2), (lx - ld / 2, 0.0043, lw / 2)], 'tex')
    lb = N.make('lbl_' + name, parent=E); lb.matrix_basis = Matrix.Identity(4)
    CARDS.append(E)
    return E
# three to a row (as the printout has them): rows along x, columns along z (seen from +x, before the turn,
# a row runs left to right)
cw = (z1 - z0 - 0.03) / 3
for i, p in enumerate(PROJ):
    r, c = divmod(i, 3)
    cz = z0 + 0.015 + cw * (c + 0.5) if r == 0 else z0 + 0.015 + cw * (c + 1.0)
    cx = 0.045 - r * 0.085
    card(f'cardA_{p}', cx, cz, 0.06, cw * 0.84, 0.036)
# two to a row, bigger, after the red pen
cw2 = (z1 - z0 - 0.03) / 2
for i, p in enumerate(PROJ):
    r, c = divmod(i, 2)
    cz = z0 + 0.015 + cw2 * (c + 0.5) if r < 2 else OZ * 0 + (z0 + z1) / 2
    cx = 0.085 - r * 0.083
    card(f'cardB_{p}', cx, cz, 0.068, cw2 * 0.8, 0.05)
# the lift core and a reception desk, so the floor reads as a plan from above
P = Parts()
P.box(x0 + 0.004, x0 + 0.05, y6, L[7], z1 - 0.06, z1 - 0.004, 'core')
co = shift(P).make('gallery_core', parent=GAL)

# ---- trees round it ----------------------------------------------------------------------------------
TREES = obj('trees')
spots = [(0.225, -0.07, 1.6), (0.21, 0.12, 1.3), (0.05, 0.225, 1.45), (-0.14, 0.21, 1.7), (-0.225, -0.03, 1.35), (-0.08, -0.22, 1.55), (0.185, -0.205, 1.15)]
P = Parts()
for (tx, tz, s) in spots:
    P.cyl(tx, tz, 0.0028 * s, L[0], L[0] + 0.03 * s, 'trunk', 8)
    # the crown: a faceted ball
    cy = L[0] + 0.03 * s + 0.016 * s
    r = 0.022 * s
    nu, nv = 10, 6
    ring = []
    for a in range(nv + 1):
        th = math.pi * a / nv - math.pi / 2
        ring.append([(tx + r * math.cos(th) * math.cos(2 * math.pi * b / nu), cy + r * 0.9 * math.sin(th), tz + r * math.cos(th) * math.sin(2 * math.pi * b / nu)) for b in range(nu)])
    for a in range(nv):
        for b in range(nu):
            P.quad([ring[a][b], ring[a + 1][b], ring[a + 1][(b + 1) % nu], ring[a][(b + 1) % nu]], 'leaf')
tr = shift(P).make('trees_mesh', parent=TREES)

# ---- the motion, frame by frame -----------------------------------------------------------------------
def key(o, M_, f):
    o.matrix_basis = M_
    o.keyframe_insert('location', frame=f)
    o.rotation_mode = 'QUATERNION'
    o.keyframe_insert('rotation_quaternion', frame=f)
    o.keyframe_insert('scale', frame=f)
for o in FLOORS + [GAL, TREES] + CARDS + FINS:
    o.rotation_mode = 'QUATERNION'
fin_base = {fo.name: fo.matrix_basis.copy() for fo in FINS}
card_base = {c.name: c.matrix_basis.copy() for c in CARDS}
for f in range(NF):
    for k, E in enumerate(FLOORS):
        key(E, D[FLOOR_SRC[k]][f], f)
    key(GAL, D['office_layout'][f], f)
    key(TREES, D['trees'][f], f)
    # the stands: the first three-to-a-row sink as theirs sinks ('down'), the two-to-a-row rise ('up')
    for c in CARDS:
        v = (1 - K_DOWN[f]) if c.name.startswith('cardA') else K_UP[f]
        v = max(1e-4, min(1, v))
        s = Matrix.Diagonal((0.6 + 0.4 * v, 0.6 + 0.4 * v, v, 1))
        key(c, card_base[c.name] @ s, f)
    # the fins grow out of the walls on their facade blend's clock, floor by floor from the bottom
    for fo in FINS:
        k = int(fo.name.split('_')[1])
        v = min(1, max(1e-4, (K_FAC[f] * 1.25 - (k - 1) * 0.04)))
        ax = fo['axis']
        s = Matrix.Diagonal((v, 1, 1, 1)) if ax == 'x' else Matrix.Diagonal((1, v, 1, 1))
        key(fo, fin_base[fo.name] @ s, f)
scn.frame_start, scn.frame_end = 0, NF - 1
scn.frame_set(NF - 1)

info = {
    'pivot': [OX, OZ], 'levels': L + [TOP], 'footprints': FP, 'yaw_before_turn': yaw70,
    'atlas': {'cols': CELL_COLS, 'rows': CELL_ROWS}, 'cells': cells, 'projects': PROJ,
    'clip': {'frames': NF, 'fps': 24},
}
os.makedirs(os.path.dirname(INFO), exist_ok=True)
json.dump(info, open(INFO, 'w'), indent=0)
print('cells', len(cells), 'fins', len(FINS), 'cards', len(CARDS))

if PREVIEW:
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.show_cavity = True
    scn.display.shading.color_type = 'MATERIAL'
    scn.render.resolution_x, scn.render.resolution_y = 640, 640
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); coll.objects.link(cam)
    cam.data.lens = 50; scn.camera = cam
    foot = B(OX, 0.95, OZ)
    for f in [int(x) for x in arg('--frames', '45,70,180,300,440,500,618').split(',')]:
        scn.frame_set(f)
        for j, (az, el, d) in enumerate([(-125, 32, 1.1), (55, 50, 1.0)]):
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
