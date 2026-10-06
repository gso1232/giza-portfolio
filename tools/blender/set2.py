"""
The room inside the laptop, script 5, laid out as the reference's own room (their scene.glb: every
place and size), with only his things in it: his studio, with only what a software
engineer and UI designer has on his desk, built here, its sunlight baked into one lightmap as the
reference bakes its room (their scene.glb + lightMap.jpg: the static room is drawn in its shadow colour
where the baked light is under 0.5 and in its light colour above), and exported for the site.

  blender -b --factory-startup -P tools/blender/set.py -- [--out public/inside/set.glb]
          [--lm public/inside/set-light.png] [--info public/inside/set-info.json]
          [--size 4096] [--samples 64] [--device CUDA] [--preview <prefix>]

--preview renders the three reference angles in Workbench and stops (a quick look at the geometry).

Everything is placed in the site's axes (metres, y up; he sits at the origin facing -z, his right is
+x) and turned into Blender's (x, -z, y) as each mesh is made, so the numbers here are the site's.
"""
import bpy, bmesh, json, math, os, sys, time, zlib, struct
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, d=None, cast=str):
    return cast(argv[argv.index(k) + 1]) if k in argv else d

OUT = arg('--out', 'public/inside/set2.glb')
LM = arg('--lm', 'public/inside/set2-light.png')
INFO = arg('--info', 'public/inside/set2-info.json')
SIZE = arg('--size', 4096, int)
SAMPLES = arg('--samples', 64, int)
DEVICE = arg('--device', 'CUDA')
PREVIEW = arg('--preview')
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
coll = scn.collection

# ---- the site's axes -> Blender's ------------------------------------------------------------------
CB = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
def B(x, y, z):
    return Vector((x, -z, y))
def web_rot(rx=0.0, ry=0.0, rz=0.0):
    """a rotation in the site's axes (yaw about y, then pitch about x, then roll about z), in Blender's"""
    m = Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rx, 3, 'X') @ Matrix.Rotation(rz, 3, 'Z')
    return CB @ m @ CB.inverted()

# the sun: low, warm, through the window in the left wall, toward the back wall (the way it travels)
SUN = Vector((0.9 + 10.2, 0.1 - 8, -0.4 - 5.7)).normalized()   # theirs: from (-10.2, 8, 5.7) to (0.9, 0.1, -0.4)

# ---- materials: a tint each, read by the site (each becomes its two tones there) -------------------
TINTS = {
    'wall': (1, 1, 1), 'floor': (0.9, 0.9, 0.9), 'wood': (0.95, 0.95, 0.95), 'wood2': (0.86, 0.86, 0.86),
    'paper': (1, 1, 1), 'grey': (0.78, 0.78, 0.78), 'dark': (0.36, 0.36, 0.36), 'dark2': (0.5, 0.5, 0.5),
    'ink': (0.03, 0.03, 0.03), 'key': (0.97, 0.95, 0.9), 'cable': (0.95, 0.95, 0.95),
    'peach': (0.96, 0.69, 0.49), 'terra': (0.8, 0.45, 0.26), 'brown': (0.47, 0.29, 0.15), 'gold': (0.95, 0.78, 0.42),
    'sage': (0.62, 0.68, 0.5), 'skin': (0.98, 0.86, 0.74), 'glass': (1, 1, 1),
    'st_a': (0.98, 0.97, 0.93), 'st_b': (0.95, 0.78, 0.42), 'st_c': (0.8, 0.45, 0.26), 'st_d': (0.96, 0.62, 0.4),
    'st_e': (0.47, 0.29, 0.15), 'st_f': (0.62, 0.68, 0.5),
    'tex': (1, 1, 1), 'mat': (0.6, 0.62, 0.58), 'leaf': (0.55, 0.62, 0.45), 'pot': (0.8, 0.6, 0.45),
}
MATS = {}
def M(name):
    if name not in MATS:
        m = bpy.data.materials.new('m_' + name)
        try:
            m.use_nodes = True
        except Exception:
            pass
        c = TINTS[name]
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*c, 1)
        b.inputs['Roughness'].default_value = 1.0
        m.diffuse_color = (*c, 1)
        MATS[name] = m
    return MATS[name]

# ---- objects ---------------------------------------------------------------------------------------
def link(o, parent, at, rx, ry, rz, imp):
    coll.objects.link(o)
    o.parent = parent
    o.matrix_basis = Matrix.Translation(B(*at)) @ web_rot(rx, ry, rz).to_4x4()
    o['imp'] = imp
    return o

def empty(name, at=(0, 0, 0), ry=0.0, rx=0.0, rz=0.0, parent=None):
    return link(bpy.data.objects.new(name, None), parent, at, rx, ry, rz, 0)

def mesh(name, verts, faces, mat='paper', uvs=None, parent=None, at=(0, 0, 0), rx=0.0, ry=0.0, rz=0.0,
         imp=1.0, bevel=0.0, seg=3, smooth=None):
    """a mesh from points in its own frame of the site's axes; `uvs` per vertex; `smooth` a set of faces"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(*v) for v in verts], [], faces)
    me.update()
    if uvs is not None:
        uv = me.uv_layers.new(name='UVMap')
        for li, lp in enumerate(me.loops):
            uv.data[li].uv = uvs[lp.vertex_index]
    if smooth:
        for i, p in enumerate(me.polygons):
            p.use_smooth = i in smooth
    me.materials.append(M(mat))
    o = bpy.data.objects.new(name, me)
    link(o, parent, at, rx, ry, rz, imp)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width, b.segments, b.limit_method, b.angle_limit = bevel, seg, 'ANGLE', math.radians(40)
    return o

def box(name, w, h, d, at=(0, 0, 0), mat='paper', center=False, **k):
    """a box w (x) by h (y) by d (z), standing on `at` (or centred on it)"""
    y0 = -h / 2 if center else 0.0
    v = [(x, y, z) for x in (-w / 2, w / 2) for y in (y0, y0 + h) for z in (-d / 2, d / 2)]
    i = lambda a, b, c: a * 4 + b * 2 + c
    f = [(i(0, 0, 0), i(0, 0, 1), i(0, 1, 1), i(0, 1, 0)), (i(1, 0, 0), i(1, 1, 0), i(1, 1, 1), i(1, 0, 1)),
         (i(0, 0, 0), i(1, 0, 0), i(1, 0, 1), i(0, 0, 1)), (i(0, 1, 0), i(0, 1, 1), i(1, 1, 1), i(1, 1, 0)),
         (i(0, 0, 0), i(0, 1, 0), i(1, 1, 0), i(1, 0, 0)), (i(0, 0, 1), i(1, 0, 1), i(1, 1, 1), i(0, 1, 1))]
    return mesh(name, v, f, mat, at=at, **k)

def cyl(name, r, h, at=(0, 0, 0), mat='paper', n=24, r2=None, center=False, **k):
    """a cylinder (or cone) up the y axis"""
    r2 = r if r2 is None else r2
    y0 = -h / 2 if center else 0.0
    v = [(r * math.cos(2 * math.pi * j / n), y0, r * math.sin(2 * math.pi * j / n)) for j in range(n)]
    v += [(r2 * math.cos(2 * math.pi * j / n), y0 + h, r2 * math.sin(2 * math.pi * j / n)) for j in range(n)]
    f = [(j, n + j, n + (j + 1) % n, (j + 1) % n) for j in range(n)]
    f += [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    return mesh(name, v, f, mat, at=at, smooth=set(range(n)), **k)

def sphere(name, r, at=(0, 0, 0), mat='paper', sy=1.0, nu=28, nv=16, **k):
    v = [(0, -r * sy, 0)]
    for a in range(1, nv):
        th = math.pi * a / nv - math.pi / 2
        for b in range(nu):
            ph = 2 * math.pi * b / nu
            v.append((r * math.cos(th) * math.cos(ph), r * sy * math.sin(th), r * math.cos(th) * math.sin(ph)))
    v.append((0, r * sy, 0))
    top = len(v) - 1
    ring = lambda a, b: 1 + (a - 1) * nu + b % nu
    f = [(0, ring(1, b), ring(1, b + 1)) for b in range(nu)]
    for a in range(1, nv - 1):
        f += [(ring(a, b), ring(a + 1, b), ring(a + 1, b + 1), ring(a, b + 1)) for b in range(nu)]
    f += [(ring(nv - 1, b), top, ring(nv - 1, b + 1)) for b in range(nu)]
    return mesh(name, v, f, mat, at=at, smooth=set(range(len(f))), **k)

def catmull(pts, n=8):
    P = [Vector(p) for p in pts]
    if len(P) < 3:
        return [tuple(p) for p in P]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(n):
            t = s / n
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(P[-2]))
    return out

def tube(name, pts, r, mat='cable', parent=None, at=(0, 0, 0), ry=0.0, imp=1.0, res=3, smooth=True):
    """a round tube along points of the site's axes (a cable, a headband), as a curve made a mesh later"""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = r, res, True
    P = catmull(pts) if smooth else pts
    sp = cu.splines.new('POLY')
    sp.points.add(len(P) - 1)
    for p, q in zip(sp.points, P):
        p.co = (*B(*q), 1)
    cu.materials.append(M(mat))
    o = bpy.data.objects.new(name, cu)
    return link(o, parent, at, 0, ry, 0, imp)

def rounded_outline(w, d, r, n=6):
    """a rounded rectangle in x-z, its points in the order whose face looks down (-y)"""
    out = []
    for cx, cz, a0 in ((w / 2 - r, -d / 2 + r, -math.pi / 2), (w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, math.pi / 2), (-w / 2 + r, -d / 2 + r, math.pi)):
        for j in range(n + 1):
            a = a0 + (math.pi / 2) * j / n
            out.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return out

def slab(name, w, t, d, r, at=(0, 0, 0), mat='paper', **k):
    """a flat slab with rounded corners (a phone), standing on `at`"""
    o = rounded_outline(w, d, r)
    n = len(o)
    v = [(x, 0, z) for x, z in o] + [(x, t, z) for x, z in o]
    f = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    f += [(j, n + j, n + (j + 1) % n, (j + 1) % n) for j in range(n)]
    return mesh(name, v, f, mat, at=at, **k)

def plane_h(name, w, d, at=(0, 0, 0), mat='tex', **k):
    """a picture lying face up; its top edge away from the viewer (-z)"""
    v = [(-w / 2, 0, d / 2), (w / 2, 0, d / 2), (w / 2, 0, -d / 2), (-w / 2, 0, -d / 2)]
    return mesh(name, v, [(0, 1, 2, 3)], mat, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)], at=at, **k)

def plane_v(name, w, h, at=(0, 0, 0), mat='tex', **k):
    """a picture standing, facing +z; centred on `at`"""
    v = [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)]
    return mesh(name, v, [(0, 1, 2, 3)], mat, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)], at=at, **k)

def grid(name, nx, nz, fn, mat='tex', uvfn=None, **k):
    """a curved sheet: fn(u, v) -> point; u across, v up the picture"""
    v, uv = [], []
    for j in range(nz + 1):
        for i in range(nx + 1):
            u, w = i / nx, j / nz
            v.append(fn(u, w))
            uv.append(uvfn(u, w) if uvfn else (u, w))
    f = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i) for j in range(nz) for i in range(nx)]
    return mesh(name, v, f, mat, uvs=uv, **k)


def monitor(name, at, ry, w, h, lift, screen):
    g = empty(name, at, ry)
    box(name + '_base', 0.24, 0.012, 0.19, (0, 0, -0.03), 'grey', parent=g, imp=ITEM)
    box(name + '_neck', 0.05, lift + h * 0.5, 0.022, (0, 0.012, -0.1), 'grey', parent=g, imp=ITEM)
    p = empty(name + '_panel', (0, DY * 0 + lift + h / 2 + 0.008, -0.055), rx=-0.05, parent=g)
    box(name + '_body', w + 0.016, h + 0.016, 0.018, (0, 0, 0), 'dark', parent=p, center=True, imp=ITEM)
    box(name + '_back', w * 0.62, h * 0.55, 0.03, (0, 0, -0.022), 'dark', parent=p, center=True, imp=ITEM * 0.5)
    plane_v(screen, w, h, (0, 0, 0.0092), parent=p, imp=ITEM)
    return g

def macbook(at, ry):
    g = empty('mac', at, ry)
    tilt = 0.3                                    # the stand lifts the laptop's back
    for x in (-0.11, 0.11):                       # two side plates, a wedge each
        mesh('mac_stand_side', [(0, 0, 0.105), (0, 0, -0.105), (0, 0.16, -0.105), (0, 0.045, 0.105),
                                (0.008, 0, 0.105), (0.008, 0, -0.105), (0.008, 0.16, -0.105), (0.008, 0.045, 0.105)],
             [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 'grey', parent=g,
             at=(x - 0.004, 0, 0), imp=ITEM)
    plat = empty('mac_plat', (0, 0.1, 0), rx=tilt, parent=g)
    box('mac_platform', 0.26, 0.006, 0.23, (0, 0, 0), 'grey', parent=plat, imp=ITEM)
    box('mac_lip', 0.26, 0.016, 0.006, (0, 0, 0.115), 'grey', parent=plat, imp=ITEM)
    base = empty('mac_base', (0, 0.006, -0.004), parent=plat)
    box('mac_body', 0.304, 0.0155, 0.212, (0, 0, 0), 'grey', parent=base, imp=ITEM, bevel=0.003, seg=3)
    box('mac_keys', 0.27, 0.0008, 0.1, (0, 0.0155, -0.03), 'dark', parent=base, imp=ITEM)
    box('mac_pad', 0.12, 0.0006, 0.07, (0, 0.0155, 0.06), 'grey', parent=base, imp=ITEM)
    lid = empty('mac_lid', (0, 0.0155, -0.106), rx=-0.42, parent=base)
    box('mac_lidbody', 0.304, 0.212, 0.006, (0, 0, -0.003), 'grey', parent=lid, imp=ITEM)
    box('mac_bezel', 0.296, 0.204, 0.0006, (0, 0.004, 0.0003), 'dark', parent=lid, imp=ITEM)
    plane_v('scr_mac', 0.286, 0.179, (0, 0.0145 + 0.179 / 2, 0.0013), parent=lid, imp=ITEM)
    return g

STAG = (0.0, -0.004, -0.008, -0.004, 0.002, 0.004)
def kb_half(name, at, ry, side):
    g = empty(name, at, ry)
    box(name + '_case', 0.152, 0.013, 0.104, (0, 0, 0), 'dark', parent=g, imp=ITEM)
    for c in range(6):
        for r in range(3):
            x = side * (-0.0475 + c * 0.019)
            z = -0.026 + r * 0.019 + STAG[c]
            accent = (c == 0 and r == 0) or (c == 5 and r == 1)
            box(name + '_key', 0.0168, 0.008, 0.0168, (x, 0.013, z), 'terra' if accent and side < 0 else 'key', parent=g, imp=ITEM)
    for j in range(3):                            # the thumb keys, fanned
        box(name + '_thumb', 0.0168, 0.008, 0.024, (side * (0.012 + j * 0.02), 0.013, 0.036 + j * 0.004), 'key', parent=g,
            ry=-side * (0.12 + j * 0.1), imp=ITEM)
    return g

def iphone(at, ry):
    g = empty('iphone', at, ry)
    slab('iphone_body', 0.0716, 0.0078, 0.1466, 0.0105, (0, 0, 0), 'grey', parent=g, imp=ITEM * 1.4)
    slab('iphone_glass', 0.0696, 0.0006, 0.1446, 0.0098, (0, 0.0078, 0), 'ink', parent=g, imp=ITEM * 1.4)
    plane_h('scr_iphone', 0.0662, 0.1412, (0, 0.0086, 0), parent=g, imp=ITEM * 1.4)
    return g
def android(at, ry):
    g = empty('android', at, ry)
    slab('android_body', 0.0698, 0.0094, 0.1404, 0.0085, (0, 0, 0), 'paper', parent=g, imp=ITEM * 1.4)
    plane_h('scr_android', 0.0612, 0.1092, (0, 0.0095, -0.003), parent=g, imp=ITEM * 1.4)
    slab('android_home', 0.017, 0.0006, 0.005, 0.0024, (0, 0.0094, 0.0615), 'grey', parent=g, imp=ITEM)
    box('android_ear', 0.012, 0.0005, 0.0018, (0, 0.0094, -0.063), 'dark', parent=g, imp=ITEM)
    return g

def headphones(at, ry):
    g = empty('headphones', at, ry)
    cyl('hp_base', 0.058, 0.012, (0, 0, 0), 'grey', n=36, parent=g, imp=ITEM)
    cyl('hp_post', 0.008, 0.27, (0, 0.012, 0), 'grey', n=16, parent=g, imp=ITEM)
    tube('hp_saddle', [(-0.045, 0.27, 0), (-0.02, 0.284, 0), (0.0, 0.286, 0), (0.02, 0.284, 0), (0.045, 0.27, 0)], 0.008, 'grey', parent=g, imp=ITEM)
    R, top = 0.088, 0.303
    band = [(R * math.sin(math.radians(a)), top - R + R * math.cos(math.radians(a)), 0) for a in range(-100, 101, 10)]
    tube('hp_band', band, 0.009, 'dark', parent=g, imp=ITEM, smooth=False)
    for s in (-1, 1):
        cyl('hp_cup', 0.046, 0.03, (s * 0.088, 0.16, 0), 'dark', n=32, center=True, rz=math.pi / 2, parent=g, imp=ITEM)
        cyl('hp_cushion', 0.042, 0.022, (s * 0.063, 0.16, 0), 'dark2', n=32, center=True, rz=math.pi / 2, parent=g, imp=ITEM)
        tube('hp_yoke', [(s * 0.0895, 0.206, 0), (s * 0.104, 0.19, 0), (s * 0.104, 0.16, 0)], 0.004, 'grey', parent=g, imp=ITEM)
    return g

def figure(at, ry):
    g = empty('figure', at, ry)
    cyl('fig_base', 0.03, 0.006, (0, 0, 0), 'dark', n=32, parent=g, imp=ITEM)
    box('fig_legs', 0.03, 0.014, 0.022, (0, 0.006, 0), 'brown', parent=g, imp=ITEM, bevel=0.004)
    box('fig_body', 0.036, 0.03, 0.026, (0, 0.02, 0), 'terra', parent=g, imp=ITEM, bevel=0.007, seg=4)
    for s in (-1, 1):
        box('fig_arm', 0.009, 0.026, 0.012, (s * 0.022, 0.02, 0.002), 'terra', parent=g, rz=s * 0.15, imp=ITEM, bevel=0.003)
    box('fig_head', 0.062, 0.054, 0.054, (0, 0.047, 0), 'skin', parent=g, imp=ITEM * 1.5, bevel=0.016, seg=5)
    box('fig_hair', 0.066, 0.03, 0.06, (0, 0.077, -0.002), 'brown', parent=g, imp=ITEM, bevel=0.013, seg=5)
    box('fig_hairback', 0.065, 0.044, 0.016, (0, 0.052, -0.021), 'brown', parent=g, imp=ITEM, bevel=0.006, seg=4)
    for s in (-1, 1):
        cyl('fig_eye', 0.0058, 0.002, (s * 0.014, 0.07, 0.027), 'ink', n=20, rx=math.pi / 2, parent=g, imp=ITEM)
    return g

def rubik(at, ry):
    g = empty('rubik', at, ry)
    E, P, S = 0.057, 0.019, 0.0166
    box('rubik_core', E, E, E, (0, 0, 0), 'ink', parent=g, imp=ITEM)
    cols = ['st_a', 'st_b', 'st_c', 'st_d', 'st_e', 'st_f']
    k = 3
    for face in ('+y', '+x', '-x', '+z', '-z'):
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                k = (k * 7 + 3) % 6
                if face == '+y':
                    at_, kw = (a * P, E, b * P), {}
                    box('rubik_st', S, 0.001, S, at_, cols[k], parent=g, imp=ITEM)
                elif face in ('+x', '-x'):
                    sx = 1 if face == '+x' else -1
                    box('rubik_st', 0.001, S, S, (sx * (E / 2 + 0.0005), E / 2 + a * P - S / 2, b * P), cols[k], parent=g, imp=ITEM)
                else:
                    sz = 1 if face == '+z' else -1
                    box('rubik_st', S, S, 0.001, (b * P, E / 2 + a * P - S / 2, sz * (E / 2 + 0.0005)), cols[k], parent=g, imp=ITEM)
    return g

NOTES = []
def note(text, colour, x, y, rz, z, cell_hint=None, where='kanban'):
    """a sticky note, 76 mm, its bottom curling off the board; its face is a cell of the notes' atlas"""
    i = len(NOTES)
    col, row = i % 8, i // 8
    s = 0.076
    def fn(u, v):
        lx, ly = (u - 0.5) * s, (v - 0.5) * s
        c, sn = math.cos(rz), math.sin(rz)
        return (x + lx * c - ly * sn, y + lx * sn + ly * c, z + 0.0035 * (1 - v) ** 2)
    uvfn = lambda u, v: ((col + u) / 8, 1 - (row + 1 - v) / 4)
    grid('note_%02d' % i, 2, 6, fn, 'tex', uvfn=uvfn, imp=ITEM)
    NOTES.append({'cell': i, 'text': text, 'colour': colour, 'where': where})


# =====================================================================================================
# THE ROOM, AS THEIRS (their scene.glb, read in Blender: every number below is where theirs is)
# =====================================================================================================
DY = 0.762                                       # their desk's top
X0, X1 = -3.08, 6.92                             # the window wall, the far right wall
Z0, Z1 = -4.406, 14.446                          # the back wall, the wall behind the camera
HH = 4.0
WIN = dict(z0=-2.71, z1=6.04, y0=0.33, y1=3.29, n=6, w=1.26, gap=0.24)   # six tall windows in the left wall
SHELL, ITEM = 0.2, 12.0

# ---- the room ---------------------------------------------------------------------------------------
T = 0.15
box('floor', X1 - X0 + 2 * T, 0.05, Z1 - Z0 + 2 * T, ((X0 + X1) / 2, -0.05, (Z0 + Z1) / 2), 'floor', imp=SHELL * 0.6)
box('ceiling', X1 - X0 + 2 * T, 0.1, Z1 - Z0 + 2 * T, ((X0 + X1) / 2, HH, (Z0 + Z1) / 2), 'wall', imp=SHELL * 0.2)
box('wall_back', X1 - X0 + 2 * T, HH, T, ((X0 + X1) / 2, 0, Z0 - T / 2), 'wall', imp=1.2)
box('wall_right', T, HH, Z1 - Z0, (X1 + T / 2, 0, (Z0 + Z1) / 2), 'wall', imp=SHELL * 0.4)
box('wall_front', X1 - X0 + 2 * T, HH, T, ((X0 + X1) / 2, 0, Z1 + T / 2), 'wall', imp=SHELL * 0.1)
wx = X0 - T / 2
box('wall_l_low', T, WIN['y0'], Z1 - Z0, (wx, 0, (Z0 + Z1) / 2), 'wall', imp=SHELL)
box('wall_l_top', T, HH - WIN['y1'], Z1 - Z0, (wx, WIN['y1'], (Z0 + Z1) / 2), 'wall', imp=SHELL)
box('wall_l_back', T, WIN['y1'] - WIN['y0'], WIN['z0'] - Z0, (wx, WIN['y0'], (Z0 + WIN['z0']) / 2), 'wall', imp=SHELL * 2)
box('wall_l_front', T, WIN['y1'] - WIN['y0'], Z1 - WIN['z1'], (wx, WIN['y0'], (WIN['z1'] + Z1) / 2), 'wall', imp=SHELL)
for k in range(WIN['n'] - 1):                    # the piers between the windows
    z = WIN['z0'] + (k + 1) * WIN['w'] + k * WIN['gap'] + WIN['gap'] / 2
    box('pier', T, WIN['y1'] - WIN['y0'], WIN['gap'], (wx, WIN['y0'], z), 'wall', imp=SHELL * 2)
for k in range(WIN['n']):                        # each window's frame: a thin dark border, a transom
    z0 = WIN['z0'] + k * (WIN['w'] + WIN['gap'])
    zc = z0 + WIN['w'] / 2
    for (h, w, y, z) in ((0.05, WIN['w'], WIN['y0'], zc), (0.05, WIN['w'], WIN['y1'] - 0.05, zc), (0.05, WIN['w'], 2.35, zc)):
        box('win_frame', 0.06, h, w, (X0 - 0.03, y, z), 'dark2', imp=SHELL * 2)
    for z in (z0 + 0.025, z0 + WIN['w'] - 0.025):
        box('win_frame', 0.06, WIN['y1'] - WIN['y0'], 0.05, (X0 - 0.03, WIN['y0'], z), 'dark2', imp=SHELL * 2)
box('skirting', X1 - X0, 0.08, 0.016, ((X0 + X1) / 2, 0, Z0 + 0.008), 'wall', imp=SHELL)

# ---- the back wall: his board of work (where their wall of papers is), a print, a shelf, a sideboard ---
KB = dict(cx=-1.235, cy=1.66, w=1.67, h=1.5)
box('kanban_board', KB['w'], KB['h'], 0.014, (KB['cx'], KB['cy'] - KB['h'] / 2, Z0 + 0.007), 'paper', imp=3)
plane_v('board_kanban', KB['w'] - 0.03, KB['h'] - 0.03, (KB['cx'], KB['cy'], Z0 + 0.0142), imp=3)
for (w, h, dx, dy) in ((KB['w'], 0.016, 0, KB['h'] / 2 - 0.008), (KB['w'], 0.016, 0, -KB['h'] / 2 + 0.008),
                       (0.016, KB['h'], KB['w'] / 2 - 0.008, 0), (0.016, KB['h'], -KB['w'] / 2 + 0.008, 0)):
    box('kanban_frame', w, h, 0.02, (KB['cx'] + dx, KB['cy'] + dy, Z0 + 0.01), 'grey', center=True, imp=3)
COLS = {'TO DO': [('Checkout flow', 'peach'), ('Dark mode', 'yellow'), ('A11y audit', 'pink'), ('Image CDN', 'yellow'), ('Search', 'peach'), ('Wishlist', 'pink')],
        'IN PROGRESS': [('Product page', 'peach'), ('Cart API', 'pink'), ('Figma > code', 'yellow'), ('Order emails', 'peach')],
        'DONE': [('Sitemap', 'yellow'), ('Wireframes', 'peach'), ('Design tokens', 'pink'), ('Auth', 'yellow'), ('User flow', 'peach'), ('Logo', 'pink'), ('Hosting', 'yellow')]}
seed = 5
for ci, (head_, items) in enumerate(COLS.items()):
    cx = KB['cx'] + (ci - 1) * KB['w'] / 3
    for jn, (t_, c_) in enumerate(items):
        seed = (seed * 37 + 11) % 101
        note(t_, c_, cx + (-0.1 if jn % 2 == 0 else 0.1) * 1.0, KB['cy'] + 0.5 - (jn // 2) * 0.27, (seed / 101 - 0.5) * 0.12, Z0 + 0.0145, where='kanban')
# the user flow, on the board's foot, a row of notes
for jn, t_ in enumerate(('Splash', 'Home', 'Shop', 'Product', 'Cart', 'Checkout')):
    note(t_, ('yellow', 'peach', 'peach', 'peach', 'pink', 'pink')[jn], KB['cx'] - 0.6 + jn * 0.24, KB['cy'] - 0.58, (((jn * 53) % 7) / 7 - 0.5) * 0.08, Z0 + 0.0145, where='flow')
# a framed print: his design system on a sheet (where theirs hangs), and the shelf under it
box('poster_frame', 0.74, 1.03, 0.025, (0.774, 1.471, Z0 + 0.0125), 'dark', imp=3)
plane_v('poster', 0.66, 0.95, (0.774, 1.471 + 0.515, Z0 + 0.0255), imp=3)
box('shelf', 3.2, 0.03, 0.24, (1.3, 1.41, Z0 + 0.12), 'wood', imp=1)
for x in (0.05, 2.5):
    box('shelf_bracket', 0.02, 0.12, 0.2, (x, 1.29, Z0 + 0.1), 'dark', imp=0.5)
# books on it (his: UX, JavaScript, design)
bx = 1.45
for k, (w, h, c) in enumerate(((0.03, 0.24, 'terra'), (0.025, 0.21, 'paper'), (0.035, 0.26, 'brown'), (0.03, 0.22, 'peach'), (0.028, 0.25, 'dark'), (0.032, 0.2, 'paper'))):
    box('shelf_book', w, h, 0.17, (bx, 1.44, Z0 + 0.12), c, rz=0.0 if k != 5 else 0.25, imp=1)
    bx += w + 0.004
# the sideboard below (where theirs stands), books and boxes on it
box('sideboard', 2.23, 0.66, 0.39, (1.115, 0.08, -3.985), 'wood2', imp=1)
for x in (0.05, 2.18):
    for z in (-4.14, -3.83):
        box('sideboard_leg', 0.04, 0.08, 0.04, (x, 0, z), 'dark', imp=0.3)
for k in range(3):
    box('sideboard_door', 0.7, 0.58, 0.01, (0.4 + k * 0.72, 0.12, -3.79), 'wood2', imp=0.6)
box('box_store', 0.42, 0.3, 0.23, (0.22, 0.74, -3.98), 'paper', imp=1)
box('books_flat', 0.26, 0.08, 0.19, (0.25, 1.04, -3.98), 'terra', imp=1)
box('printer', 0.42, 0.22, 0.34, (1.6, 0.74, -3.99), 'grey', imp=1, bevel=0.01)

# ---- the desk, the chair, the stool, the bin, the plant ----------------------------------------------
DX0, DX1, DZ0, DZ1 = -1.014, 0.986, -0.83, 0.63
dcx, dcz = (DX0 + DX1) / 2, (DZ0 + DZ1) / 2
box('desk_top', DX1 - DX0, 0.035, DZ1 - DZ0, (dcx, DY - 0.035, dcz), 'wood', imp=16.0)
for x in (DX0 + 0.2, DX1 - 0.2):
    for s in (-1, 1):
        box('desk_leg', 0.05, DY - 0.035, 0.05, (x, 0, dcz + s * 0.52), 'wood', rx=-s * 0.12, imp=0.5)
    box('desk_rail', 0.06, 0.05, 1.0, (x, DY - 0.085, dcz), 'wood', imp=0.5)
    box('desk_foot', 0.06, 0.035, 1.12, (x, 0.24, dcz), 'wood', imp=0.5)
box('desk_stretcher', DX1 - DX0 - 0.4, 0.045, 0.04, (dcx, 0.24, dcz), 'wood', imp=0.5)

def office_chair(at, ry=0.0):
    g = empty('chair', at, ry)
    for k in range(5):                            # the star base and its wheels
        a = k * 2 * math.pi / 5
        box('chair_spoke', 0.035, 0.03, 0.3, (0.15 * math.sin(a), 0.06, 0.15 * math.cos(a)), 'dark', parent=g, ry=a, imp=1)
        sphere('chair_wheel', 0.028, (0.3 * math.sin(a), 0.028, 0.3 * math.cos(a)), 'dark', parent=g, imp=1, nu=12, nv=8)
    cyl('chair_column', 0.025, 0.38, (0, 0.06, 0), 'grey', n=16, parent=g, imp=1)
    box('chair_seat', 0.5, 0.07, 0.48, (0, 0.44, 0), 'dark2', parent=g, imp=3, bevel=0.025, seg=3)
    box('chair_back', 0.46, 0.5, 0.06, (0, 0.55, 0.26), 'dark2', parent=g, rx=-0.12, imp=3, bevel=0.02, seg=3)
    for s in (-1, 1):
        box('chair_arm', 0.05, 0.03, 0.3, (s * 0.27, 0.66, 0.02), 'dark', parent=g, imp=1)
        box('chair_armpost', 0.03, 0.17, 0.03, (s * 0.27, 0.49, 0.06), 'dark', parent=g, imp=1)
office_chair((-0.022, 0, 0.758))                  # (theirs: Chair_main at (-0.02, z 0.76))

def stool(at):
    g = empty('stool', at)
    cyl('stool_seat', 0.15, 0.04, (0, 0.45, 0), 'wood2', n=36, parent=g, imp=1)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        box('stool_leg', 0.03, 0.46, 0.03, (0.13 * math.cos(a), 0, 0.13 * math.sin(a)), 'wood2', parent=g, imp=0.6)
    cyl('stool_ring', 0.14, 0.02, (0, 0.18, 0), 'wood2', n=36, parent=g, imp=0.4)
stool((0.364, 0, -1.082))                         # his teammate's, across the desk (theirs)

def waste_bin(at):
    g = empty('bin', at)
    cyl('bin_body', 0.17, 0.42, (0, 0, 0), 'paper', n=32, r2=0.19, parent=g, imp=1)
    for k, (dx, dz) in enumerate(((0.05, 0.02), (-0.06, -0.04), (0.0, -0.07))):
        sphere('crumple', 0.06, (dx, 0.43, dz), 'paper', sy=0.85, parent=g, imp=1, nu=10, nv=7)
    for k, (dx, dz, a) in enumerate(((0.06, 0.06, 0.12), (-0.05, 0.05, -0.15))):   # two drawing tubes
        cyl('tube_roll', 0.035, 0.75, (dx, 0.05, dz), 'peach' if k else 'paper', n=16, parent=g, rz=a, imp=1)
waste_bin((-1.27, 0, -0.21))

def floor_plant(at):
    g = empty('plant', at)
    cyl('plant_pot', 0.24, 0.5, (0, 0, 0), 'pot', n=32, r2=0.28, parent=g, imp=1)
    for k in range(9):                            # a few long leaves, rising and bending out
        a = k * 2.4
        L = 0.9 + (k % 3) * 0.25
        pts = [(0.03 * math.cos(a), 0.48, 0.03 * math.sin(a)),
               (0.2 * math.cos(a), 0.48 + L * 0.55, 0.2 * math.sin(a)),
               (0.42 * math.cos(a), 0.48 + L * 0.85, 0.42 * math.sin(a)),
               (0.55 * math.cos(a), 0.48 + L * 0.8, 0.55 * math.sin(a))]
        tube('plant_leaf', pts, 0.028, 'leaf', parent=g, imp=0.6, res=1)
floor_plant((1.52, 0, -1.52))

# ---- on the desk (each where theirs is) ---------------------------------------------------------------
# the cutting mat (their paper_bottom) and the sheet of tracing paper on it (their paper_top): his whole flow
# in pencil; the printout under it (their paper) moves in the site, so it is the site's own
box('mat', 0.9, 0.0025, 0.7, (0.0, DY, 0.04), 'mat', imp=ITEM)
plane_h('sheet_flow', 1.07, 0.93, (-0.0005, DY + 0.006, 0.0395), imp=ITEM * 1.4)
# his headphones on their stand, where their lamp stands
headphones((-0.52, DY, -0.24), 0.6)
# the pen cup (theirs), pencils in it
cyl('pen_cup', 0.055, 0.12, (-0.462, DY, -0.59), 'terra', n=24, imp=ITEM)
for k in range(5):
    a = k * 1.3
    cyl('cup_pencil', 0.0042, 0.19, (-0.462 + 0.02 * math.cos(a), DY + 0.01, -0.59 + 0.02 * math.sin(a)), ('paper', 'dark', 'terra', 'grey', 'peach')[k], n=6, rx=0.12 * math.sin(a), rz=0.12 * math.cos(a), imp=ITEM)
# the monitors at the back left (the middle left clear: he looks at his teammate across it)
monitor('mon_main', (-0.42, DY, -0.66), 0.28, 0.597, 0.336, 0.12, 'scr_figma')
monitor('mon_vert', (-0.86, DY, -0.42), 0.75, 0.3, 0.53, 0.1, 'scr_code')
# the MacBook on its stand at his left (where their book stack is)
macbook((-0.74, DY, 0.16), 0.85)
box('hub', 0.11, 0.012, 0.034, (-0.62, DY, -0.12), 'grey', ry=0.5, imp=ITEM, bevel=0.004, seg=3)
cr = 0.0024
tube('cable_mac', [(-0.66, DY + cr, -0.1), (-0.72, DY + cr, -0.02), (-0.76, DY + cr, 0.06), (-0.76, DY + 0.03, 0.12)], cr, 'cable', imp=ITEM)
tube('cable_mon', [(-0.58, DY + cr, -0.14), (-0.5, DY + cr, -0.3), (-0.45, DY + cr, -0.5), (-0.43, DY + 0.02, -0.66)], cr, 'cable', imp=ITEM)
tube('cable_vert', [(-0.62, DY + cr, -0.14), (-0.72, DY + cr, -0.3), (-0.82, DY + 0.02, -0.42)], cr, 'cable', imp=ITEM)
# the split keyboard, pushed back to the right while he sketches (where their other books are)
kb_half('kb_left', (0.52, DY, -0.26), 0.05, -1)
kb_half('kb_right', (0.78, DY, -0.24), -0.35, 1)
tube('cable_trrs', [(0.59, DY + 0.006, -0.3), (0.63, DY + 0.0018, -0.33), (0.68, DY + 0.0018, -0.33), (0.71, DY + 0.006, -0.29)], 0.0018, 'dark', imp=ITEM)
# the fidget toys, where their block is
figure((0.86, DY, -0.62), -0.5)
rubik((0.66, DY, -0.55), 0.4)
sphere('stress_ball', 0.031, (0.78, DY + 0.0285, -0.45), 'peach', sy=0.92, imp=ITEM)
# the tablet in its folio (their sketchbook; its cover opens in the site), and the two test phones by it
slab('tablet_body', 0.282, 0.0064, 0.215, 0.012, (0.709, DY, 0.202), 'grey', ry=-0.1, imp=ITEM)
plane_h('scr_tablet', 0.262, 0.195, (0.709, DY + 0.0068, 0.202), ry=-0.1, imp=ITEM)
iphone((0.42, DY, 0.44), 0.35)
android((0.93, DY, 0.48), -0.25)
# the pencil he draws with lies on the sheet (their pen)
cyl('pencil_desk', 0.0042, 0.17, (0.43, DY + 0.0105, 0.08), 'paper', n=6, rx=math.pi / 2, ry=0.55, imp=ITEM)

# a calibration card in full sun outside, square to it: the lightmap is scaled so it reads 1
dvec = SUN
pc = Vector((X0 - 0.6, 1.6, 2.0)) - dvec * 1.5
a = dvec.cross(Vector((0, 1, 0))).normalized() * 0.15
bb = a.cross(dvec).normalized() * 0.15
cv = [tuple(pc - a - bb), tuple(pc - a + bb), tuple(pc + a + bb), tuple(pc + a - bb)]
calib = mesh('calib', cv, [(0, 1, 2, 3)], 'paper', imp=0.05)
nrm = (Vector(cv[1]) - Vector(cv[0])).cross(Vector(cv[2]) - Vector(cv[1]))
if nrm.dot(dvec) > 0:
    calib.data.polygons[0].flip()
print('built', len(bpy.data.objects), 'objects in %.1fs' % (time.time() - t0), flush=True)


TEXTURED = {'scr_figma', 'scr_code', 'scr_mac', 'scr_iphone', 'scr_android', 'scr_tablet', 'sheet_flow', 'board_kanban',
            'board_glass', 'poster', 'glass', 'calib'}

# =====================================================================================================
# PREVIEW: the three reference angles, in Workbench
# =====================================================================================================
VIEWS = {
    'hero': ((2.23, 1.13, 5.06), (-0.4, 1.0, -0.6), 25),
    'shoulder': ((1.04, 2.17, 1.88), (0.0, 0.76, 0.0), 25),
    'wide': ((1.6, 2.09, 1.94), (0.0, 0.8, -0.6), 25),
}
def camera(pos, tgt, fov):
    cam = bpy.data.objects.get('cam') or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in coll.objects:
        coll.objects.link(cam)
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle_y = math.radians(fov)
    cam.data.clip_start = 0.01
    cam.location = B(*pos)
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (B(*tgt) - B(*pos)).to_track_quat('-Z', 'Y')
    scn.camera = cam
    return cam

if PREVIEW:
    scn.render.engine = 'BLENDER_WORKBENCH'
    sh = scn.display.shading
    sh.light, sh.color_type, sh.show_shadows, sh.show_cavity = 'STUDIO', 'MATERIAL', True, True
    scn.display.light_direction = tuple(-B(*SUN))
    scn.display.shadow_shift = 0.05
    scn.render.resolution_x, scn.render.resolution_y = 1200, 750
    for k, (p, t_, f) in VIEWS.items():
        camera(p, t_, f)
        scn.render.filepath = f'{PREVIEW}-{k}.png'
        bpy.ops.render.render(write_still=True)
    print('preview written', flush=True)
    sys.exit(0)

# =====================================================================================================
# MAKE IT ONE: curves and modifiers made meshes, parents dissolved
# =====================================================================================================
dg = bpy.context.evaluated_depsgraph_get()
for o in list(bpy.data.objects):
    if o.type == 'CURVE' or (o.type == 'MESH' and o.modifiers):
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        if o.type == 'CURVE':
            n = bpy.data.objects.new(o.name + '_m', me)
            coll.objects.link(n)
            n.parent = o.parent
            n.matrix_basis = o.matrix_basis.copy()
            n['imp'] = o['imp']
            nm = o.name
            bpy.data.objects.remove(o, do_unlink=True)
            n.name = nm
        else:
            o.modifiers.clear()
            o.data = me
bpy.context.view_layer.update()                  # (the converted curves' places, through their parents)
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# the sticky notes are one mesh, their faces cells of one picture
notes = [o for o in meshes if o.name.startswith('note_')]
bpy.ops.object.select_all(action='DESELECT')
for o in notes:
    o.select_set(True)
bpy.context.view_layer.objects.active = notes[0]
bpy.ops.object.join()
notes[0].name = 'notes'
TEXTURED.add('notes')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# =====================================================================================================
# THE LIGHTMAP'S UVS: every surface unwrapped, a square metre of the desk worth more than of the walls
# =====================================================================================================
for o in meshes:
    me = o.data
    if 'UVMap' not in me.uv_layers:
        me.uv_layers.new(name='UVMap')
    while len(me.uv_layers) > 1 and me.uv_layers[0].name != 'UVMap':
        me.uv_layers.remove(me.uv_layers[0])
    lm = me.uv_layers.new(name='lm')
    me.uv_layers.active = lm
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.average_islands_scale()
bpy.ops.object.mode_set(mode='OBJECT')
for o in meshes:
    k = math.sqrt(max(o.get('imp', 1.0), 1e-3))      # (an area's worth: its side scales by the root)
    uv = o.data.uv_layers['lm'].data
    arr = np.empty(len(uv) * 2, dtype=np.float32)
    uv.foreach_get('uv', arr)
    uv.foreach_set('uv', arr * k)
    o.data.uv_layers['lm'].active = True

# everything that is only shape is one mesh ('set'); the pictures keep their own
plain = [o for o in meshes if o.name not in TEXTURED]
bpy.ops.object.select_all(action='DESELECT')
for o in plain:
    o.select_set(True)
bpy.context.view_layer.objects.active = plain[0]
bpy.ops.object.join()
plain[0].name = 'set'
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    o.data.uv_layers.active = o.data.uv_layers['lm']

bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects['set']
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, scale=True, margin=0.0016, shape_method='AABB')
bpy.ops.object.mode_set(mode='OBJECT')
print('unwrapped in %.1fs' % (time.time() - t0), flush=True)

# =====================================================================================================
# THE BAKE: the sun's direct light only (no sky, no bounce), as their lightmap is a light/shade mask
# =====================================================================================================
scn.world = bpy.data.worlds.new('w')
scn.world.color = (0, 0, 0)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
coll.objects.link(sun)
sun.data.energy = math.pi                         # (a white diffuse face square to it then reads ~1)
sun.data.angle = math.radians(0.8)
sun.rotation_mode = 'QUATERNION'
sun.rotation_quaternion = B(*SUN).to_track_quat('-Z', 'Y')
for n in ('sheet_flow',):
    bpy.data.objects[n].visible_shadow = False

img = bpy.data.images.new('lm', SIZE, SIZE, alpha=False, float_buffer=True)
img.colorspace_settings.name = 'Non-Color'
for m in bpy.data.materials:
    nt = m.node_tree
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = img
    nt.nodes.active = tn

scn.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for dt in (DEVICE, 'CUDA'):
    try:
        prefs.compute_device_type = dt
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == dt]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == dt
            scn.cycles.device = 'GPU'
            print('device', dt, [d.name for d in gpus], flush=True)
            break
    except TypeError:
        continue
cy = scn.cycles
cy.samples = SAMPLES
cy.use_denoising = False
cy.max_bounces = 1
cy.diffuse_bounces = 0
scn.render.bake.use_pass_direct = True
scn.render.bake.use_pass_indirect = False
scn.render.bake.use_pass_color = False
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects['set']
tb = time.time()
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT'}, margin=8, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
print('baked in %.1fs' % (time.time() - tb), flush=True)

px = np.empty(SIZE * SIZE * 4, dtype=np.float32)
img.pixels.foreach_get(px)
lum = px.reshape(SIZE, SIZE, 4)[:, :, 0]
# the calibration card's light: the middle of its island
cu = bpy.data.objects['calib'].data.uv_layers['lm'].data
carr = np.empty(len(cu) * 2, dtype=np.float32)
cu.foreach_get('uv', carr)
cuv = carr.reshape(-1, 2).mean(axis=0)
ref = float(lum[int(cuv[1] * SIZE), int(cuv[0] * SIZE)])
print('calibration card reads %.4f' % ref, flush=True)
ref = ref if ref > 1e-3 else 1.0
out = np.clip(lum / ref, 0, 1)
u8 = (out * 255 + 0.5).astype(np.uint8)[::-1]      # (the top row first: glTF's v runs down)

def write_png(path, a):
    h, w = a.shape
    raw = b''.join(b'\x00' + a[y].tobytes() for y in range(h))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
write_png(LM, u8)
lit = float((out > 0.5).mean())
print('lightmap', LM, 'lit share %.3f' % lit, flush=True)

# =====================================================================================================
# EXPORT
# =====================================================================================================
bpy.data.objects.remove(bpy.data.objects['calib'], do_unlink=True)
for m in bpy.data.materials:                      # (the bake's picture is not the site's)
    for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']:
        m.node_tree.nodes.remove(n)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=False,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_cameras=False, export_lights=False, export_yup=True)
json.dump({'sun': list(SUN), 'desk': DY, 'notes': NOTES,
           'window': {'x': X0, **WIN}, 'room': {'x0': X0, 'x1': X1, 'z0': Z0, 'z1': Z1, 'h': HH}},
          open(INFO, 'w'), indent=1)
print('exported', OUT, 'in %.1fs' % (time.time() - t0), flush=True)
