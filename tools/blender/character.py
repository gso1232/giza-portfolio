"""
Him, for the site inside the laptop: an MPFB human (MakeHuman's base mesh, CC0), a young man,
on MPFB's game-engine skeleton, sat on the office chair at the desk of src/inside/room.js and
posed by IK: the feet on the floor, the right hand at the pencil on the sheet he draws on, the
left hand holding the sheet, the head bowed to it. Exported for the web as public/inside/him.glb.

Everything here is placed in the web scene's own metres, turned to Blender's axes:
three (x, y, z) = Blender (x, -y, z) swapped, i.e. Blender (x, y, z) = three (x, -z, y).

  blender -b -P tools/blender/character.py -- [--out public/inside/him.glb] [--pose draw]
(no --factory-startup: MPFB is a user extension and has to load)
"""
import importlib
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, v: argv[argv.index(k) + 1] if k in argv else v
OUT = os.path.abspath(arg('--out', 'public/inside/him.glb'))

MP = 'bl_ext.user_default.mpfb'
HumanService = importlib.import_module(MP + '.services.humanservice').HumanService


def T(x, y, z):
    """a point in the web scene's metres, in Blender's axes"""
    return Vector((x, -z, y))


# ---- an empty file ------------------------------------------------------------------------------------
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# ---- the body: a young man (21), a little taller than the middle, lean, of the Nile ------------------------
# from his photos and his word: 180 cm, 62 kg (lean: long arms, a long neck); height 0.637 measured
# to stand 1.80 m (0.6 -> 1.750, 0.7 -> 1.886)
macro = {
    'gender': 1.0,
    'age': 0.41,                 # MakeHuman: 0.1875 is 11 years, 0.5 is 25
    'muscle': float(arg('--muscle', 0.58)),     # fitter than the photos, as he asked: "my body nice"
    'weight': float(arg('--weight', 0.4)),
    'proportions': 0.78,                          # MakeHuman's "ideal" proportions: longer legs, broader shoulders
    'height': 0.637,
    'cupsize': 0.5,
    'firmness': 0.5,
    'race': {'caucasian': 0.55, 'african': 0.3, 'asian': 0.15},
}
body = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
body.name = 'him'
# his face, from the photos: long and narrow, a strong nose with a slight hump, a narrow chin, a long neck
TargetService = importlib.import_module(MP + '.services.targetservice').TargetService
TargetService.bulk_load_targets(body, [{'target': t, 'value': v} for t, v in [
    ('head-oval', 0.5), ('head-scale-horiz-decr', 0.22), ('head-scale-vert-incr', 0.18),
    ('nose-scale-vert-incr', 0.35), ('nose-scale-depth-incr', 0.3), ('nose-hump-incr', 0.3), ('nose-point-width-decr', 0.15),
    ('chin-width-decr', 0.3), ('chin-height-incr', 0.15), ('chin-prominent-incr', 0.15),
    ('l-cheek-volume-decr', 0.3), ('r-cheek-volume-decr', 0.3),
    ('neck-scale-vert-incr', 0.3), ('measure-neck-circ-decr', 0.35),
]])
rig = HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)
rig.name = 'him_rig'
print('bones', len(rig.data.bones), 'verts', len(body.data.vertices))

# ---- what he wears: MakeHuman's system assets (CC0; the user downloaded the pack, installed in MPFB's
# data): eyes, brows, lashes, short dark hair, a white t-shirt and jeans, white sneakers
LocationService = importlib.import_module(MP + '.services.locationservice').LocationService
DATA = LocationService.get_user_data()
WEAR = [
    ('eyes/high-poly/high-poly.mhclo', 'Eyes'),
    ('eyebrows/eyebrow009/eyebrow009.mhclo', 'Eyebrows'),
    ('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes'),
    (arg('--hair', 'hair/afro01/afro01.mhclo'), 'Hair'),      # his hair is curly, full on top
    (arg('--outfit', 'clothes/male_casualsuit05/male_casualsuit05.mhclo'), 'Clothes'),   # his pick (C): an olive jacket, a striped shirt, jeans
    ('clothes/shoes05/shoes05.mhclo', 'Clothes'),
]
for rel, kind in WEAR:
    f = os.path.join(DATA, *rel.split('/'))
    HumanService.add_mhclo_asset(f, body, asset_type=kind, subdiv_levels=0, material_type='GAMEENGINE')
    print('wears', rel)
# the t-shirt's print (MakeHuman's own logo) painted out, in a copy of its texture (tools/blender/assets)
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
shirt = os.path.join(ASSETS, f"male_casualsuit06_{arg('--shirt', 'black')}.png")    # black / plain (striped)
for img in bpy.data.images:
    if 'male_casualsuit06_diffuse' in img.filepath and os.path.exists(shirt):
        img.filepath = shirt
        img.reload()
        print('shirt', os.path.basename(shirt))
# the pictures at most 1024 across, for the web
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, max(1, round(img.size[1] * 1024 / img.size[0])))

# ---- his hair: the afro pulled in at the sides and the back (his curls are fuller on top), in the rest pose
for o in [o for o in bpy.data.objects if o.type == 'MESH' and 'afro' in o.name]:
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    hc = sum(vs, Vector()) / len(vs)
    inv = o.matrix_world.inverted()
    for v, w in zip(o.data.vertices, vs):
        d = w - hc
        t = min(1.0, max(0.0, (d.z + 0.01) / 0.08))     # 0 at the ears, 1 at the crown
        if arg('--taper', '0') == '1':
            k = 0.74 + 0.26 * t                        # short at the sides (a fade), full on top
        else:
            k = 1.0                                    # whole: any pulling in sinks it into the scalp at the back
        v.co = inv @ Vector((hc.x + d.x * k, hc.y + d.y * (k + 0.03), w.z + 0.008 * t))
    print('afro tapered')

# ---- his glasses: thick black rectangular frames (the photos), made here, held by the head bone ----------
import bmesh
import numpy as np
dg = bpy.context.evaluated_depsgraph_get()
eyes = next(o for o in bpy.data.objects if o.type == 'MESH' and 'high-poly' in o.name)
em = eyes.evaluated_get(dg).to_mesh()
ev = [eyes.matrix_world @ v.co for v in em.vertices]
eye_c = {}
for sd in (1, -1):
    pts = [v for v in ev if (v.x > 0) == (sd > 0)]
    eye_c[sd] = sum(pts, Vector()) / max(1, len(pts))
E = (eye_c[1] + eye_c[-1]) / 2                      # between the eyes (he faces -Y here, standing)
print('eyes at', [tuple(round(c, 3) for c in eye_c[sd]) for sd in (1, -1)])


def rounded_rect(w, h, r, n=5):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ring(bm, center, w, h, r, rim, depth):
    """a lens rim: the band between an outer and an inner rounded rectangle, extruded back"""
    outer, inner = rounded_rect(w, h, r), rounded_rect(w - 2 * rim, h - 2 * rim, max(0.001, r - rim * 0.6))
    rings = []
    for y in (0.0, depth):
        rings.append([bm.verts.new(center + Vector((x, y, z))) for x, z in outer])
        rings.append([bm.verts.new(center + Vector((x, y, z))) for x, z in inner])
    fo, fi, bo, bi = rings
    n = len(fo)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((fo[i], fo[j], fi[j], fi[i]))
        bm.faces.new((bo[i], bi[i], bi[j], bo[j]))
        bm.faces.new((fo[i], bo[i], bo[j], fo[j]))
        bm.faces.new((fi[i], fi[j], bi[j], bi[i]))


def bar(bm, a, b, t, h):
    """a bar from a to b, t thick sideways, h tall"""
    d = (b - a).normalized()
    side = d.cross(Vector((0, 0, 1))).normalized() * t / 2
    up = Vector((0, 0, h / 2))
    vs = [bm.verts.new(q) for q in (a - side - up, a + side - up, a + side + up, a - side + up, b - side - up, b + side - up, b + side + up, b - side + up)]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])


bmg = bmesh.new()
LW, LH, RIM, D = 0.058, 0.047, 0.0078, 0.0078       # a lens 58 x 47 mm, a 7.8 mm rim, 7.8 mm deep: heavy acetate
front = -0.02                                         # the frame 20 mm before the eyes
for sd in (1, -1):
    c = Vector((eye_c[sd].x + sd * 0.006, E.y + front, eye_c[sd].z + 0.004))
    ring(bmg, c, LW, LH, 0.007, RIM, D)
    bar(bmg, c + Vector((-LW / 2 + 0.004, D / 2, LH / 2 - 0.004)), c + Vector((LW / 2 - 0.004, D / 2, LH / 2 - 0.004)), D + 0.001, 0.009)   # the heavy top
bar(bmg, Vector((-0.012, E.y + front + D / 2, E.z + 0.016)), Vector((0.012, E.y + front + D / 2, E.z + 0.016)), D, 0.007)
for sd in (1, -1):
    hinge = Vector((eye_c[sd].x + sd * (0.006 + LW / 2), E.y + front + D, eye_c[sd].z + 0.016))
    ear = Vector((hinge.x + sd * 0.008, E.y + 0.088, E.z - 0.002))
    bar(bmg, hinge, ear, 0.0045, 0.009)
gm = bpy.data.meshes.new('glasses')
bmg.to_mesh(gm)
bmg.free()
gmat = bpy.data.materials.new('glasses')                 # black acetate (the glTF exporter reads the Principled node)
gmat.use_nodes = True
gp = gmat.node_tree.nodes.get('Principled BSDF')
gp.inputs['Base Color'].default_value = (0.012, 0.012, 0.014, 1)
gp.inputs['Roughness'].default_value = 0.35
gm.materials.append(gmat)
glasses = bpy.data.objects.new('glasses', gm)
bpy.context.collection.objects.link(glasses)
mw = glasses.matrix_world.copy()
glasses.parent = rig
glasses.parent_type = 'BONE'
glasses.parent_bone = 'head'
bpy.context.view_layer.update()
glasses.matrix_world = mw

# ---- his beard: short, along the jaw and the chin, a light moustache (the photos), painted into the skin
masks = [m for m in body.modifiers if m.type == 'MASK']   # the helpers' and the clothes' masks, off for this
for m in masks:
    m.show_viewport = False                          # (so the evaluated vertices line up with the mesh's)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
bme = body.evaluated_get(dg).to_mesh()
P = [body.matrix_world @ v.co for v in bme.vertices]
assert len(P) == len(body.data.vertices), (len(P), len(body.data.vertices))
for m in masks:
    m.show_viewport = True


def beard(q):
    x, y, z = abs(q.x - E.x), q.y - E.y, q.z - E.z
    if y > 0.075 or z > -0.012 or z < -0.135:          # before the ears, below the cheekbones, above the neck's middle
        return 0.0
    if x < 0.026 and -0.078 < z < -0.061:              # the lips
        return 0.0
    if x < 0.026 and -0.061 <= z < -0.050:             # the moustache, between the nose and the lip
        return 0.7
    edge = -0.061 + (x - 0.026) / (0.07 - 0.026) * (0.061 - 0.02)   # the cheek line: mouth corner to sideburn
    return 1.0 if z < min(-0.02, edge) else 0.0


W_ = 1024
img_px = np.full((W_, W_), 0.86, np.float32)       # skin


def scalp(q):
    """1 where his hair grows: above the hairline at the front, above the ears at the sides, down to the nape"""
    x, y, z = abs(q.x - E.x), q.y - E.y, q.z - E.z
    if y < 0.035:                                   # the front: a hairline ~6 cm above the eyes, lower at the temples
        return 1.0 if z > 0.062 - 0.25 * max(0.0, x - 0.03) else 0.0
    if y < 0.10:                                    # the sides: above and behind the ears
        return 1.0 if z > 0.035 - 0.5 * (y - 0.035) else 0.0
    return 1.0 if z > -0.07 else 0.0                # the back, down to the nape


n_scalp = 0
if arg('--scalp', '1') == '1':
    uvd0 = body.data.uv_layers.active.data
    for poly in body.data.polygons:
        if min(scalp(P[vi]) for vi in poly.vertices) <= 0:
            continue
        n_scalp += 1
        us = [uvd0[li].uv for li in poly.loop_indices]
        xs = [u.x * (W_ - 1) for u in us]
        ys = [u.y * (W_ - 1) for u in us]
        img_px[max(0, int(min(ys))):int(max(ys)) + 2, max(0, int(min(xs))):int(max(xs)) + 2] = 0.06
    print('scalp faces', n_scalp)
print('uv layers', [(l.name, l.active, l.active_render) for l in body.data.uv_layers])
uvl = body.data.uv_layers.active
for l in body.data.uv_layers:                        # paint and export on the same map
    l.active_render = (l.name == uvl.name)
uvd = uvl.data
n_beard = 0
for poly in (body.data.polygons if arg('--beard', '0') == '1' else []):
    ws = [beard(P[vi]) for vi in poly.vertices]
    if min(ws) <= 0:
        continue
    n_beard += 1
    w = sum(ws) / len(ws)
    us = [uvd[li].uv for li in poly.loop_indices]
    xs = [u.x * (W_ - 1) for u in us]
    ys = [u.y * (W_ - 1) for u in us]
    x0, x1, y0, y1 = int(min(xs)), int(max(xs)) + 1, int(min(ys)), int(max(ys)) + 1
    blk = img_px[max(0, y0):y1 + 1, max(0, x0):x1 + 1]
    img_px[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = np.minimum(blk, 0.86 - 0.52 * w)
rng = np.random.default_rng(5)
stubble = rng.random((W_, W_)).astype(np.float32)
img_px = np.where(img_px < 0.8, img_px + (stubble - 0.5) * 0.22, img_px)          # a beard is hairs, not a patch
k5 = np.ones(5, np.float32) / 5                                                   # a soft edge
img_px = np.apply_along_axis(lambda r: np.convolve(r, k5, 'same'), 0, img_px)
img_px = np.apply_along_axis(lambda r: np.convolve(r, k5, 'same'), 1, img_px)
skin_img = bpy.data.images.new('skin', W_, W_)
rgba = np.stack([img_px, img_px * 0.97, img_px * 0.94, np.ones_like(img_px)], -1).clip(0, 1)
skin_img.pixels.foreach_set(rgba.ravel())
skin_img.pack()
if arg('--debug-skin', None):
    skin_img.filepath_raw = arg('--debug-skin', None); skin_img.file_format = 'PNG'; skin_img.save()
skin = bpy.data.materials.new('skin')
skin.use_nodes = True
bsdf = skin.node_tree.nodes.get('Principled BSDF')
tex = skin.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = skin_img
skin.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
body.data.materials.clear()
body.data.materials.append(skin)
print('beard faces painted', n_beard)

# ---- on the chair, facing the desk ---------------------------------------------------------------------
# the rest pose stands at the origin facing -Y; turn him to +Y (the desk is at the web's -z) and
# drop the hips to the seat: the seat's top is at 0.52 m, the hip joints sit ~9 cm above it
POSE = arg('--pose', 'sit')
bpy.context.view_layer.update()
pelvis_rest = rig.matrix_world @ rig.data.bones['pelvis'].head_local
hips = T(-0.02, 0.61, 0.25) if POSE == 'sit' else T(-0.02, pelvis_rest.z, 0.25)
rig.rotation_euler = (0, 0, math.pi)
bpy.context.view_layer.update()
pelvis_now = rig.matrix_world @ rig.data.bones['pelvis'].head_local
rig.location += hips - pelvis_now
bpy.context.view_layer.update()


def empty(name, at):
    e = bpy.data.objects.new(name, None)
    e.location = at
    bpy.context.collection.objects.link(e)
    return e


def ik(bone, target, pole, chain=2, pole_angle=-90):
    c = rig.pose.bones[bone].constraints.new('IK')
    c.target = target
    c.pole_target = pole
    c.pole_angle = math.radians(pole_angle)
    c.chain_count = chain
    return c


# the sheet he draws on (room: the paper group at (-0.16, 0.752, -0.33)); the pencil's point near its middle
# turned to face the desk (the web's -z), his right is the web's +x and his left its -x;
# a sitter's shins stand about upright, so each foot is under its knee, ~45 cm before the hip
if POSE == 'sit':
    feet = {'l': (-0.13, -0.19), 'r': (0.15, -0.23)}              # (x, z) on the floor (facing -z, his right is +x)
    for side, (fx, fz) in feet.items():
        ik(f'calf_{side}', empty(f'foot_{side}', T(fx, 0.09, fz)), empty(f'knee_{side}', T(fx * 1.2, 0.55, -0.8)))
    hand_r = empty('hand_r_at', T(0.1, 0.80, -0.22))
    hand_l = empty('hand_l_at', T(-0.2, 0.775, -0.13))         # his left hand rests on the desk at his left
    ik('lowerarm_r', hand_r, empty('elbow_r', T(0.45, 0.75, 0.4)), chain=3)    # the shoulder comes with the arm when he reaches
    ik('lowerarm_l', hand_l, empty('elbow_l', T(-0.7, 0.75, 0.3)))    # (his left is the web's -x)
    BEND = (('spine_01', 6), ('spine_02', 8), ('spine_03', 8), ('neck_01', 10), ('head', 14))
else:                                                             # standing in the rig's rest pose (a character sheet)
    BEND = ()

# the back leans in over the sheet, the head bows to it
for b, deg in BEND:
    pb = rig.pose.bones[b]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = (math.radians(deg), 0, 0)
bpy.context.view_layer.update()


# ---- his hand (--anim draw): one clip, scrubbed by the site's story -----------------------------------
# The site (src/inside/scene.js drawPath(), saved as tools/blender/assets/draw-path.json) says where things
# are. His script: his hand holds the pencil STILL on the sketch through its beats (frames 0..190, "I didn't
# say it moves"); then he lays the pencil down on the sheet, takes up the red pen lying by it and holds it
# over his city for the drop (190..320); then the red pen's note on the sketch, a loop and "DARK MODE?"
# (330..); then he rests, the pen in his hand. Every frame is planned as: which pen is in his hand, where
# its point is, which way it lies, how far up it he holds it, and whether its point is pinned (writing:
# the point exact, the pen through his grip) or carried (the pen goes where the grip takes it).
ANIM = arg('--anim', None)
if ANIM == 'draw' and POSE == 'sit':
    import json
    from mathutils import Matrix
    path = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'draw-path.json')))
    sheet = path['sheet']
    px, py, pz = sheet['position']
    th = sheet['rotationY']
    V3 = lambda x, y, z: T(x, y, z) - T(0, 0, 0)               # a direction, web to Blender

    def on_sheet(cx, cy, lift=0.0, y0=0.0015):                 # the sheet's canvas point (y down) to Blender
        x, z = (cx - 0.5) * sheet['width'], (cy - 0.5) * sheet['height']
        return T(px + x * math.cos(th) + z * math.sin(th), py + y0 + lift, pz - x * math.sin(th) + z * math.cos(th))

    def mk_pen(name, rgba, cap):
        bm_ = bmesh.new()
        if cap:   # the red marker: a round body, a short point, a cap on its back end
            bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.0048, radius2=0.0048, depth=0.118, matrix=Matrix.Translation((0, 0, 0.012 + 0.059)))
            bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.0011, radius2=0.0048, depth=0.012, matrix=Matrix.Translation((0, 0, 0.006)))
            bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.0058, radius2=0.0058, depth=0.034, matrix=Matrix.Translation((0, 0, 0.012 + 0.118 - 0.012)))
        else:     # the pencil: hexagonal, sharpened
            bmesh.ops.create_cone(bm_, cap_ends=True, segments=6, radius1=0.0042, radius2=0.0042, depth=0.15, matrix=Matrix.Translation((0, 0, 0.018 + 0.075)))
            bmesh.ops.create_cone(bm_, cap_ends=True, segments=6, radius1=0.0002, radius2=0.0042, depth=0.018, matrix=Matrix.Translation((0, 0, 0.009)))
        me = bpy.data.meshes.new(name); bm_.to_mesh(me); bm_.free()
        mt = bpy.data.materials.new(name); mt.use_nodes = True
        mt.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = rgba
        me.materials.append(mt)
        ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
        ob.rotation_mode = 'QUATERNION'
        return ob

    pencil = mk_pen('pencil', (0.012, 0.012, 0.014, 1), False)     # black: a light pencil vanished on the page
    redpen = mk_pen('redpen', (0.62, 0.07, 0.04, 1), True)
    lean = (T(0.26, 0.84, 0.47) - T(0, 0, 0)).normalized()         # a pen as a hand holds it to write: back up toward his right
    over = (T(0.1, 1, 0.22) - T(0, 0, 0)).normalized()            # held over the city: near upright, a little toward him
    wrist_off = T(0.04, 0.075, 0.075) - T(0, 0, 0)
    grip = empty('grip', Vector())
    hr = rig.pose.bones['hand_r']
    dt_ = hr.constraints.new('DAMPED_TRACK'); dt_.target = grip; dt_.track_axis = 'TRACK_Y'; dt_.influence = 0.8
    hd = rig.pose.bones['head']
    look = empty('look', Vector())
    ht = hd.constraints.new('DAMPED_TRACK'); ht.target = look; ht.track_axis = 'TRACK_Y'; ht.influence = 0.25
    # the fingers as a hand holds a pen (a tripod): the thumb and the index pinch near its point, the middle
    # finger under it, the ring and little fingers tucked; (deg about X, deg about Z) per bone
    GRIPS = {
        'tripod': {'index_01_r': (14, 0), 'index_02_r': (24, 0), 'index_03_r': (16, 0), 'middle_01_r': (32, 0), 'middle_02_r': (52, 0), 'middle_03_r': (34, 0),
                   'ring_01_r': (52, 0), 'ring_02_r': (70, 0), 'ring_03_r': (46, 0), 'pinky_01_r': (58, 0), 'pinky_02_r': (72, 0), 'pinky_03_r': (46, 0),
                   'thumb_01_r': (8, -14), 'thumb_02_r': (16, 0), 'thumb_03_r': (12, 0)},
        'fist': {'index_01_r': (28, 0), 'index_02_r': (30, 0), 'index_03_r': (20, 0), 'middle_01_r': (38, 0), 'middle_02_r': (45, 0), 'middle_03_r': (30, 0),
                 'ring_01_r': (55, 0), 'ring_02_r': (60, 0), 'ring_03_r': (40, 0), 'pinky_01_r': (60, 0), 'pinky_02_r': (60, 0), 'pinky_03_r': (40, 0),
                 'thumb_02_r': (20, 0), 'thumb_03_r': (15, 0)},
    }
    for fb, (dx, dz) in GRIPS[arg('--grip', 'tripod')].items():
        b = rig.pose.bones.get(fb)
        if b:
            b.rotation_mode = 'XYZ'
            b.rotation_euler = (math.radians(dx), 0, math.radians(dz))
    # where on the hand the pen is held: its line runs from its point through the web between the thumb
    # and the index finger (where a pen rests), the pinch of their tips near the point below it
    GRIP_AT = arg('--grip-at', 'web')

    def grip_bones():
        pbs = rig.pose.bones
        if GRIP_AT == 'web':
            return (pbs['index_01_r'].head + pbs['thumb_02_r'].head) / 2
        return (pbs['index_02_r'].head + pbs['thumb_03_r'].head) / 2
    GD = float(arg('--grip-d', 0.068))                       # the web's distance up the pen from its point
    Zax = Vector((0, 0, 1))
    ez = lambda x: x * x * (3 - 2 * x)

    def axis_mix(a, b, k):
        return (Zax.rotation_difference(a).slerp(Zax.rotation_difference(b), k) @ Zax).normalized()

    # where the pens lie (the web's [point, the way the pen lies]); where the drop is held; the note
    (rp, ra), (pp, pa) = path['pens']['red'], path['pens']['pencil']
    red_tip0, red_axis0 = T(*rp), V3(*ra).normalized()
    pen_tip1, pen_axis1 = T(*pp), V3(*pa).normalized()
    drop_tip = T(*path['drop'])
    note = path['note']
    ny = note['y']

    def note_tip(f):                                            # the red pen's point at frame f, as the site draws its ink
        for sg in note['segments']:
            if f <= sg['f1'] or sg is note['segments'][-1]:
                k = min(1.0, max(0.0, (f - sg['f0']) / max(1, sg['f1'] - sg['f0'])))
                pts = sg['pts']
                L = [math.hypot((pts[i + 1][0] - pts[i][0]) * sheet['width'], (pts[i + 1][1] - pts[i][1]) * sheet['height']) for i in range(len(pts) - 1)]
                run = k * sum(L)
                for i, l in enumerate(L):
                    if run <= l or i == len(L) - 1:
                        t = min(1.0, run / l) if l else 1.0
                        return on_sheet(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, 0 if sg['draw'] else 0.012 * math.sin(math.pi * k), ny + 0.0007)

    HOLD = on_sheet(0.86, 0.86)                                 # the pencil's point at rest on the sheet
    F_HOLD = 190                    # still to here
    F_DOWN = 212                    # the pencil laid on the sheet
    F_GRAB = 232                    # his fingers on the red pen
    F_UP = 252                      # lifted
    F_OVER = 280                    # over the city
    F_FLICK = (298, 306)            # the drop leaves it (the site: u 6.47)
    F_LEAVE = 320
    F_NOTE = note['start']
    F_END = note['end']
    NEND = F_END + 24
    plan = {}
    for f in range(NEND + 1):
        if f <= F_HOLD:
            plan[f] = ('pencil', HOLD, lean, GD, True)
        elif f <= F_DOWN:                                        # the pencil down: turned to lie, laid on the sheet
            k = ez((f - F_HOLD) / (F_DOWN - F_HOLD))
            plan[f] = ('pencil', HOLD.lerp(pen_tip1, k) + V3(0, 0.035 * math.sin(math.pi * k), 0), axis_mix(lean, pen_axis1, k), GD + (0.075 - GD) * k, False)
        elif f <= F_GRAB:                                        # (empty-handed) to the red pen, held at its middle
            k = ez((f - F_DOWN) / (F_GRAB - F_DOWN))
            g0 = pen_tip1 + pen_axis1 * 0.075
            g1 = red_tip0 + red_axis0 * 0.06
            plan[f] = (None, g0.lerp(g1, k) + V3(0, 0.03 * math.sin(math.pi * k), 0), red_axis0, 0.0, False)
        elif f <= F_UP:                                          # up, turning point down
            k = ez((f - F_GRAB) / (F_UP - F_GRAB))
            plan[f] = ('redpen', red_tip0 + V3(0, 0.06 * k, 0), axis_mix(red_axis0, over, k), 0.06, False)
        elif f <= F_OVER:                                        # over the city's middle
            k = ez((f - F_UP) / (F_OVER - F_UP))
            plan[f] = ('redpen', (red_tip0 + V3(0, 0.06, 0)).lerp(drop_tip, k), over, 0.06, False)
        elif f <= F_LEAVE:                                       # held there; a small flick lets the drop go
            fk = 0.0
            if F_FLICK[0] <= f <= F_FLICK[1]:
                fk = math.sin(math.pi * (f - F_FLICK[0]) / (F_FLICK[1] - F_FLICK[0]))
            plan[f] = ('redpen', drop_tip + V3(0, -0.012 * fk, 0), over, 0.06, False)
        elif f < F_NOTE:                                         # to the sketch, turning to write
            k = ez((f - F_LEAVE) / (F_NOTE - F_LEAVE))
            plan[f] = ('redpen', drop_tip.lerp(note_tip(F_NOTE), k) + V3(0, 0.05 * math.sin(math.pi * k), 0), axis_mix(over, lean, k), 0.06 + (GD - 0.06) * k, False)
        elif f <= F_END:                                         # the loop and the words
            plan[f] = ('redpen', note_tip(f), lean, GD, True)
        else:                                                    # lifted off, his hand to rest by the sheet, the pen in it
            k = ez((f - F_END) / (NEND - F_END))
            plan[f] = ('redpen', note_tip(F_END).lerp(on_sheet(0.9, 0.9, 0.02), k) + V3(0, 0.03 * math.sin(math.pi * k), 0), lean, GD, False)

    # his hand through it all: the grip where the plan holds the pen, the wrist solved to put it there
    scn = bpy.context.scene
    scn.frame_start, scn.frame_end = 0, NEND
    scn.render.fps = 24
    worst = 0.0
    wrist = None
    prev_want = None
    for f in range(NEND + 1):
        pen, tip, axis, gd, pinned = plan[f]
        want = tip + axis * gd
        wrist = (want + wrist_off) if wrist is None else wrist + (want - prev_want)
        prev_want = want
        grip.location = want
        look.location = want + V3(0, 0.04, 0)
        if f == 0 or f > F_HOLD or f == F_HOLD:
            for it in range(6):
                hand_r.location = wrist
                bpy.context.view_layer.update()
                g = rig.matrix_world @ grip_bones()
                err = want - g
                if err.length < 0.003:
                    break
                wrist = wrist + err
            worst = max(worst, err.length)
        if f in (0, F_HOLD) or f > F_HOLD:
            for o, kk in ((hand_r, 'location'), (grip, 'location'), (look, 'location')):
                o.keyframe_insert(kk, frame=f)
    print('hand: frames 0 ..', NEND, 'grip error at most', round(worst, 3), 'm')

    # the pose, frame by frame, baked into the bones (the constraints then go)
    from bpy_extras import anim_utils
    opts = anim_utils.BakeOptions(only_selected=False, do_pose=True, do_object=True, do_visual_keying=True, do_constraint_clear=True,
                                  do_parents_clear=False, do_clean=False, do_location=True, do_rotation=True, do_scale=False,
                                  do_bbone=False, do_custom_props=False)
    act = anim_utils.bake_action(rig, action=None, frames=range(0, NEND + 1), bake_options=opts)
    act.name = 'draw'
    # each pen in his hand on every frame it is held, through the grip between his thumb and index finger
    # as the baked hand has it: pinned (writing), its point on the path and the pen through the grip;
    # carried, the pen where the grip takes it. The two blend over a few frames where one turns to the other
    pins = {f: (1.0 if plan[f][4] else 0.0) for f in plan}
    soft = {f: sum(pins.get(min(NEND, max(0, f + d)), 0.0) for d in range(-4, 5)) / 9 for f in plan}
    grips = {}
    for f in range(NEND + 1):
        scn.frame_set(f)
        grips[f] = rig.matrix_world @ grip_bones()

    def key(ob, f, tip, axis):
        ob.location = tip
        ob.rotation_quaternion = Zax.rotation_difference(axis)
        ob.keyframe_insert('location', frame=f)
        ob.keyframe_insert('rotation_quaternion', frame=f)

    for f in range(NEND + 1):
        pen, tip, axis, gd, pinned = plan[f]
        if pen is None:
            continue
        ob = pencil if pen == 'pencil' else redpen
        gw = grips[f]
        same = pen == plan.get(max(0, f - 4))[0] == plan.get(min(NEND, f + 4))[0]
        w = soft[f] if same else (1.0 if pinned else 0.0)
        a_pin = (gw - tip).normalized()
        t_carry = gw - axis * gd
        k_axis = (Zax.rotation_difference(axis).slerp(Zax.rotation_difference(a_pin), w) @ Zax).normalized()
        key(ob, f, t_carry.lerp(tip, w), k_axis)
        if f in (0, F_HOLD, F_OVER, (F_NOTE + F_END) // 2):
            print('grip', f, pen, 'point to grip', round((gw - tip).length, 3), 'm')
    # the pencil once laid down stays; the red pen lies by the sheet till taken
    for f in (F_DOWN + 1, NEND):
        key(pencil, f, pen_tip1, pen_axis1)
    for f in (0, F_GRAB):
        key(redpen, f, red_tip0, red_axis0)
    PREVIEW = arg('--preview', None)
    if PREVIEW:
        scn.render.engine = 'BLENDER_WORKBENCH'
        scn.display.shading.light = 'STUDIO'
        scn.display.shading.color_type = 'MATERIAL'
        scn.display.shading.show_shadows = True
        scn.render.resolution_x, scn.render.resolution_y = 640, 480
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam)
        cam.data.lens = 50
        scn.camera = cam
        for f, off in ((100, (0.16, 0.07, 0.1)), (100, (-0.02, 0.12, -0.2)), (300, (0.18, 0.04, 0.08)), (420, (0.16, 0.08, 0.1)), (420, (0.0, 0.12, -0.2))):
            scn.frame_set(f)
            gw = grips[f]
            cam.location = gw + V3(*off)
            d = (gw - cam.location).normalized()
            cam.rotation_mode = 'QUATERNION'
            cam.rotation_quaternion = d.to_track_quat('-Z', 'Z')
            scn.render.filepath = f'{PREVIEW}-{f}-{int(off[2] * 100)}.png'
            bpy.ops.render.render(write_still=True)
        print('preview written')
        sys.exit(0)
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o, do_unlink=True)
    # skinned, for the web: the body's shape keys applied into its mesh; the rest stays live
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys]:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_materials='EXPORT',
                              export_yup=True, export_skins=True, export_animations=True, export_animation_mode='SCENE',
                              export_force_sampling=True, export_morph=False)
    print('wrote', OUT, 'animated', NEND, 'frames')
    sys.exit(0)

# ---- baked as he sits, for the picture: the helpers masked off, the pose applied ------------------------
# (the body's shape comes from shape keys, which block applying modifiers: take each mesh as evaluated,
# the body and all he wears, posed, as plain meshes)
dg = bpy.context.evaluated_depsgraph_get()
originals = list(bpy.data.objects)
baked = []
for o in [o for o in originals if o.type == 'MESH']:
    m = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    n = bpy.data.objects.new('him_' + o.name, m)
    n.matrix_world = o.matrix_world.copy()
    baked.append(n)
for o in originals:                                     # (the new ones are in bpy.data too, unlinked)
    bpy.data.objects.remove(o, do_unlink=True)
for n in baked:
    bpy.context.collection.objects.link(n)
    print('part', n.name, len(n.data.vertices), [m.name for m in n.data.materials])
body = baked[0]
bpy.ops.object.select_all(action='DESELECT')
for n in baked:
    n.select_set(True)
bpy.context.view_layer.objects.active = body
lo = min((n.matrix_world @ v.co).z for n in baked for v in n.data.vertices)
hi = max((n.matrix_world @ v.co).z for n in baked for v in n.data.vertices)
print('him from', round(lo, 3), 'to', round(hi, 3), 'm')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_materials='EXPORT', export_yup=True)
print('wrote', OUT)
