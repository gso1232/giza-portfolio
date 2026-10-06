"""
The two people of script 5 (illoca's woman and her collaborator, here him and his teammate), as MPFB
humans (MakeHuman's base mesh, CC0) on MPFB's game-engine skeleton, sat at the desk of tools/blender/set.py
and posed by IK, each with one clip the site scrubs with its scroll:

  --who him   on his chair, his right hand on the notebook's right page holding the pencil, still; his
              head bowed to the page, lifted to the screen that rises from it (frames 0..120)
  --who mate  his teammate on the stool at the desk's front right corner, turned to him; the red pen in
              her right hand: a loop round the cards on the printout and "2 COLUMNS" under it (0..210)

  blender -b -P tools/blender/figure.py -- --who him|mate [--out public/inside/him5.glb|mate.glb]
(no --factory-startup: MPFB is a user extension and has to load)

Everything is placed in the site's metres: Blender (x, y, z) = site (x, -z, y).
"""
import importlib
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda k, v: argv[argv.index(k) + 1] if k in argv else v
WHO = arg('--who', 'him')
OUT = os.path.abspath(arg('--out', f"public/inside/{'him5' if WHO == 'him' else 'mate'}.glb"))
PREVIEW = arg('--preview', None)

MP = 'bl_ext.user_default.mpfb'
HumanService = importlib.import_module(MP + '.services.humanservice').HumanService
TargetService = importlib.import_module(MP + '.services.targetservice').TargetService
LocationService = importlib.import_module(MP + '.services.locationservice').LocationService

DY = 0.75                                   # the desk's top (set.py)
# where each sits: the seat's middle in the site (x, z), which way they face (a turn about y: facing
# -z turned by `ry`), and the hips' height (the seat's top + ~9 cm to the hip joints)
SEAT = {'him': ((-0.02, 0.25), 0.0, 0.475 + 0.09), 'mate': ((0.97, 0.22), 0.93, 0.48 + 0.085)}
LAYOUT = arg('--layout', 'mine')
if LAYOUT == 'illoca':                      # their room (set2.py): their woman's chair, their collaborator's stool
    DY = 0.762
    SEAT = {'him': ((0.0, 0.789), 0.0, 0.616), 'mate': ((0.294, -1.101), math.pi, 0.616)}
(OX, OZ), RY, HIPS = SEAT.get(WHO, SEAT['him'])


def T(x, y, z):
    """a point of the site, in Blender's axes"""
    return Vector((x, -z, y))


def L(x, y, z):
    """a point in the sitter's own frame (x to their right, z behind them, facing -z), in the site"""
    c, s = math.cos(RY), math.sin(RY)
    return (OX + x * c + z * s, y, OZ - x * s + z * c)


def TL(x, y, z):
    return T(*L(x, y, z))


def D(x, y, z):
    """a direction in the sitter's own frame, in Blender's axes"""
    return TL(x, y, z) - TL(0, 0, 0)


for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# ---- the body ----------------------------------------------------------------------------------------------
if WHO == 'lead':
    # the third, standing at the desk's end (their human_03): his team lead
    macro = {'gender': 1.0, 'age': 0.55, 'muscle': 0.5, 'weight': 0.5, 'proportions': 0.7, 'height': 0.6,
             'cupsize': 0.5, 'firmness': 0.5, 'race': {'caucasian': 0.4, 'african': 0.4, 'asian': 0.2}}
elif WHO == 'him':
    # his: 180 cm, 62 kg, lean, a long neck (his photos and his word)
    macro = {'gender': 1.0, 'age': 0.41, 'muscle': 0.58, 'weight': 0.4, 'proportions': 0.78, 'height': 0.637,
             'cupsize': 0.5, 'firmness': 0.5, 'race': {'caucasian': 0.55, 'african': 0.3, 'asian': 0.15}}
else:
    # his teammate: a young woman, a little shorter, slim
    macro = {'gender': 0.0, 'age': 0.44, 'muscle': 0.5, 'weight': 0.42, 'proportions': 0.7, 'height': 0.55,
             'cupsize': 0.45, 'firmness': 0.55, 'race': {'caucasian': 0.6, 'african': 0.2, 'asian': 0.2}}
body = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
body.name = WHO
if WHO == 'him':
    TargetService.bulk_load_targets(body, [{'target': t, 'value': v} for t, v in [
        ('head-oval', 0.5), ('head-scale-horiz-decr', 0.22), ('head-scale-vert-incr', 0.18),
        ('nose-scale-vert-incr', 0.35), ('nose-scale-depth-incr', 0.3), ('nose-hump-incr', 0.3), ('nose-point-width-decr', 0.15),
        ('chin-width-decr', 0.3), ('chin-height-incr', 0.15), ('chin-prominent-incr', 0.15),
        ('l-cheek-volume-decr', 0.3), ('r-cheek-volume-decr', 0.3),
        ('neck-scale-vert-incr', 0.3), ('measure-neck-circ-decr', 0.35),
    ]])
rig = HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)
rig.name = f'{WHO}_rig'

DATA = LocationService.get_user_data()
CAP = WHO == 'him' and arg('--cap', '1') != '0'      # (his cap: --cap 0 for his hair alone)
WEAR = [('eyes/high-poly/high-poly.mhclo', 'Eyes'), ('eyebrows/eyebrow009/eyebrow009.mhclo', 'Eyebrows'), ('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes')]
if WHO == 'him':
    # (a plain white tee and trousers, as basic as the reference's people dress; the olive jacket is --outfit's)
    HAIR_SOLID = arg('--hair', 'solid') == 'solid'
    WEAR += ([] if HAIR_SOLID else [('hair/afro01/afro01.mhclo', 'Hair')]) + [(arg('--outfit', 'clothes/male_casualsuit06/male_casualsuit06.mhclo'), 'Clothes'), ('clothes/shoes05/shoes05.mhclo', 'Clothes')]
elif WHO == 'lead':
    WEAR += [('hair/short02/short02.mhclo', 'Hair'), ('clothes/male_casualsuit04/male_casualsuit04.mhclo', 'Clothes'), ('clothes/shoes05/shoes05.mhclo', 'Clothes')]
else:
    WEAR += [('hair/ponytail01/ponytail01.mhclo', 'Hair'), (arg('--outfit', 'clothes/female_casualsuit01/female_casualsuit01.mhclo'), 'Clothes'), ('clothes/shoes02/shoes02.mhclo', 'Clothes')]
for rel, kind in WEAR:
    HumanService.add_mhclo_asset(os.path.join(DATA, *rel.split('/')), body, asset_type=kind, subdiv_levels=0, material_type='GAMEENGINE')
    print('wears', rel)
# his sleeves rolled up to the middle of the forearm, as one rolls them to draw (the reference's people have
# bare forearms; a sleeve down to the wrist left his drawing hand a stump in a cuff): the sleeve below 42% of
# the forearm is gathered into a roll there, all of it on the forearm bone; the skin the outfit hid under it
# (its mask) is shown again
ROLL = WHO in ('him', 'lead') and arg('--roll', '1') != '0'
if ROLL:
    bpy.context.view_layer.update()
    rw = rig.matrix_world
    T0 = 0.42
    for side in ('l', 'r'):
        e = rw @ rig.data.bones[f'lowerarm_{side}'].head_local
        wv = rw @ rig.data.bones[f'hand_{side}'].head_local
        ax = wv - e; Lf = ax.length; ax.normalize()
        is_arm = lambda n: n.endswith('_' + side) and (n.startswith('lowerarm') or n.startswith('hand') or n.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky'))
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and 'casualsuit' in o.name.lower()]:
            gi = {g.name: g.index for g in o.vertex_groups}
            arm_g = {i for n, i in gi.items() if is_arm(n)}
            g_lo = gi.get(f'lowerarm_{side}')
            mw = o.matrix_world; mwi = mw.inverted()
            moved = 0
            for v in o.data.vertices:
                if sum(g.weight for g in v.groups if g.group in arm_g) < 0.5:
                    continue
                q = mw @ v.co
                t = (q - e).dot(ax) / Lf
                if t <= T0:
                    continue
                radial = (q - e) - ax * (t * Lf)
                v.co = mwi @ (e + ax * ((T0 + (t - T0) * 0.12) * Lf) + radial * 1.12)
                for g in list(v.groups):
                    if g.group in arm_g and g.group != g_lo:
                        o.vertex_groups[g.group].remove([v.index])
                if g_lo is not None:
                    o.vertex_groups[g_lo].add([v.index], 1.0, 'REPLACE')
                moved += 1
            print('sleeve rolled', side, o.name, moved)
        bgi = {g.name: g.index for g in body.vertex_groups}
        arm_b = {i for n, i in bgi.items() if n.endswith('_' + side) and (n.startswith('lowerarm') or n.startswith('hand'))}
        fore = [v.index for v in body.data.vertices if sum(g.weight for g in v.groups if g.group in arm_b) >= 0.5 and ((body.matrix_world @ v.co) - e).dot(ax) / Lf > T0 - 0.05]
        for m in [m for m in body.modifiers if m.type == 'MASK']:
            vg = body.vertex_groups.get(m.vertex_group)
            if vg is None:
                continue
            if m.invert_vertex_group:
                vg.remove(fore)
            else:
                vg.add(fore, 1.0, 'REPLACE')
            print('mask', m.name, m.vertex_group, 'inverted' if m.invert_vertex_group else 'kept', 'forearm skin shown', len(fore))

# the skin the outfit covers hidden for good: MakeHuman's own mask leaves a margin shown under the shirt (at the
# armpits, where his arm's skin came through the back of his tee as a pale sliver). Every vertex of the trunk and
# the upper arms well below his neck goes into the mask too (the forearms the rolled sleeves bare stay shown)
if WHO == 'him' and arg('--hide-trunk', '1') != '0':
    bpy.context.view_layer.update()
    rwb = rig.matrix_world
    neck_z = (rwb @ rig.data.bones['neck_01'].head_local).z
    TRUNK = {'pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'thigh_l', 'thigh_r'}   # (not the upper arms: the rolled sleeve shows into)
    if not ROLL:
        TRUNK |= {'upperarm_l', 'upperarm_r'}          # (long sleeves: the whole upper arm is under cloth)
    bgi_ = {g.index: g.name for g in body.vertex_groups}
    hide = []
    for v in body.data.vertices:
        bw = [g for g in v.groups if bgi_.get(g.group) in rig.data.bones]
        if not bw:
            continue
        g_ = max(bw, key=lambda g: g.weight)
        if bgi_.get(g_.group) in TRUNK and g_.weight >= 0.5 and (body.matrix_world @ v.co).z < neck_z - 0.09:
            hide.append(v.index)
    for m in [m for m in body.modifiers if m.type == 'MASK']:
        vg = body.vertex_groups.get(m.vertex_group)
        if vg is None:
            continue
        if m.invert_vertex_group:
            vg.add(hide, 1.0, 'REPLACE')
        else:
            vg.remove(hide)
    print('trunk skin hidden under the outfit', len(hide))

# the outfit in two: the top and the trousers (below the belt), each its own material, so the site can tone
# them apart (a white tee over darker trousers, as plain as the reference's people)
bpy.context.view_layer.update()
belt = (rig.matrix_world @ rig.data.bones['pelvis'].head_local).z + 0.035
for o in [o for o in bpy.data.objects if o.type == 'MESH' and 'casualsuit' in o.name.lower()]:
    tee = bpy.data.materials.new('tee'); tee.use_nodes = True
    trousers = bpy.data.materials.new('trousers'); trousers.use_nodes = True
    o.data.materials.clear(); o.data.materials.append(tee); o.data.materials.append(trousers)
    mw = o.matrix_world
    n_low = 0
    for poly in o.data.polygons:
        zc = sum((mw @ o.data.vertices[i].co).z for i in poly.vertices) / len(poly.vertices)
        poly.material_index = 1 if zc < belt else 0
        n_low += zc < belt
    print('outfit split', o.name, 'top', len(o.data.polygons) - n_low, 'trousers', n_low)
    INFL = float(arg('--inflate', '0.003'))
    if INFL:
        top_v = {i for poly in o.data.polygons if poly.material_index == 0 for i in poly.vertices}
        o.data.update()
        sc_ = 1.0 / max(1e-6, o.matrix_world.to_scale()[0])
        keys_ = o.data.shape_keys.key_blocks if o.data.shape_keys else None
        for i in top_v:
            d_ = o.data.vertices[i].normal * (INFL * sc_)
            o.data.vertices[i].co += d_
            if keys_:
                for kb in keys_:
                    kb.data[i].co += d_
        print('tee inflated', INFL, 'm,', len(top_v), 'vertices')

# the shirt's print (MakeHuman's own logo) painted out, in a copy of its texture (tools/blender/assets)
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
for img in bpy.data.images:
    if 'male_casualsuit02_diffuse' in img.filepath and os.path.exists(os.path.join(ASSETS, 'male_casualsuit02_plain.png')):
        img.filepath = os.path.join(ASSETS, 'male_casualsuit02_plain.png')
        img.reload()
        print('shirt plain')
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, max(1, round(img.size[1] * 1024 / img.size[0])))

# ---- his glasses: thick black rectangular frames, held by the head bone ------------------------------------
dg = bpy.context.evaluated_depsgraph_get()
eyes = next(o for o in bpy.data.objects if o.type == 'MESH' and 'high-poly' in o.name)
em = eyes.evaluated_get(dg).to_mesh()
ev = [eyes.matrix_world @ v.co for v in em.vertices]
eye_c = {sd: sum([v for v in ev if (v.x > 0) == (sd > 0)], Vector()) / max(1, len([v for v in ev if (v.x > 0) == (sd > 0)])) for sd in (1, -1)}
E = (eye_c[1] + eye_c[-1]) / 2


def rounded_rect(w, h, r, n=5):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ring(bm, center, w, h, r, rim, depth):
    outer, inner = rounded_rect(w, h, r), rounded_rect(w - 2 * rim, h - 2 * rim, max(0.001, r - rim * 0.6))
    rings = []
    for y in (0.0, depth):
        rings.append([bm.verts.new(center + Vector((x, y, z))) for x, z in outer])
        rings.append([bm.verts.new(center + Vector((x, y, z))) for x, z in inner])
    fo, fi, bo, bi = rings
    n = len(fo)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((fo[i], fo[j], fi[j], fi[i])); bm.faces.new((bo[i], bi[i], bi[j], bo[j]))
        bm.faces.new((fo[i], bo[i], bo[j], fo[j])); bm.faces.new((fi[i], fi[j], bi[j], bi[i]))


def bar(bm, a, b, t, h):
    d = (b - a).normalized()
    side = d.cross(Vector((0, 0, 1))).normalized() * t / 2
    up = Vector((0, 0, h / 2))
    vs = [bm.verts.new(q) for q in (a - side - up, a + side - up, a + side + up, a - side + up, b - side - up, b + side - up, b + side + up, b - side + up)]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])


if WHO == 'him':
    bmg = bmesh.new()
    LW, LH, RIM, DP = 0.058, 0.047, 0.0078, 0.0078
    front = -0.02
    for sd in (1, -1):
        c = Vector((eye_c[sd].x + sd * 0.006, E.y + front, eye_c[sd].z + 0.004))
        ring(bmg, c, LW, LH, 0.007, RIM, DP)
        bar(bmg, c + Vector((-LW / 2 + 0.004, DP / 2, LH / 2 - 0.004)), c + Vector((LW / 2 - 0.004, DP / 2, LH / 2 - 0.004)), DP + 0.001, 0.009)
    bar(bmg, Vector((-0.012, E.y + front + DP / 2, E.z + 0.016)), Vector((0.012, E.y + front + DP / 2, E.z + 0.016)), DP, 0.007)
    for sd in (1, -1):
        hinge = Vector((eye_c[sd].x + sd * (0.006 + LW / 2), E.y + front + DP, eye_c[sd].z + 0.016))
        bar(bmg, hinge, Vector((hinge.x + sd * 0.008, E.y + 0.088, E.z - 0.002)), 0.0045, 0.009)
    gm = bpy.data.meshes.new('glasses'); bmg.to_mesh(gm); bmg.free()
    gmat = bpy.data.materials.new('glasses'); gmat.use_nodes = True
    gmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.012, 0.012, 0.014, 1)
    gm.materials.append(gmat)
    glasses = bpy.data.objects.new('glasses', gm); bpy.context.collection.objects.link(glasses)
    mw = glasses.matrix_world.copy()
    glasses.parent = rig; glasses.parent_type = 'BONE'; glasses.parent_bone = 'head'
    bpy.context.view_layer.update()
    glasses.matrix_world = mw

# ---- the skin: one plain colour; for him, the scalp under his curls dark (its gaps read as hair) ------------
masks = [m for m in body.modifiers if m.type == 'MASK']
# (MakeHuman's helpers, the tights and the helmet it fits hair to, are in the mesh too, hidden by 'Hide helpers':
# what is built on his head is built on his skin alone)
_bg = body.vertex_groups.get('body')
SKIN_V = {v.index for v in body.data.vertices if any(g.group == _bg.index and g.weight > 0.5 for g in v.groups)} if _bg else set(range(len(body.data.vertices)))
for m in masks:
    m.show_viewport = False
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
bme = body.evaluated_get(dg).to_mesh()
P = [body.matrix_world @ v.co for v in bme.vertices]
for m in masks:
    m.show_viewport = True
W_ = 1024
img_px = np.full((W_, W_), 0.86, np.float32)


def scalp(q):
    x, y, z = abs(q.x - E.x), q.y - E.y, q.z - E.z
    if y < 0.035:
        return 1.0 if z > 0.062 - 0.25 * max(0.0, x - 0.03) else 0.0
    if y < 0.10:
        return 1.0 if z > 0.035 - 0.5 * (y - 0.035) else 0.0
    return 1.0 if z > -0.07 else 0.0


uvl = body.data.uv_layers.active
for l in body.data.uv_layers:
    l.active_render = (l.name == uvl.name)
if WHO == 'him':
    for poly in body.data.polygons:
        if min(scalp(P[vi]) for vi in poly.vertices) <= 0:
            continue
        us = [uvl.data[li].uv for li in poly.loop_indices]
        xs, ys = [u.x * (W_ - 1) for u in us], [u.y * (W_ - 1) for u in us]
        img_px[max(0, int(min(ys))):int(max(ys)) + 2, max(0, int(min(xs))):int(max(xs)) + 2] = 0.06
skin_img = bpy.data.images.new('skin', W_, W_)
skin_img.pixels.foreach_set(np.stack([img_px, img_px * 0.97, img_px * 0.94, np.ones_like(img_px)], -1).clip(0, 1).ravel())
skin_img.pack()
skin = bpy.data.materials.new('skin'); skin.use_nodes = True
tex = skin.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = skin_img
skin.node_tree.links.new(tex.outputs['Color'], skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
body.data.materials.clear(); body.data.materials.append(skin)

# ---- his hair as the reference draws hair: one solid, smooth mass over the scalp (not cards of see-through
# strands, which drew as speckle), thicker on top for his curls, its surface lumped by noise so the site's
# lines along its creases read as curls; held by the head bone, like his glasses
if WHO == 'him' and HAIR_SOLID:
    import bmesh
    from mathutils import noise as mnoise
    for m in masks:
        m.show_viewport = False
    bpy.context.view_layer.update()
    dgh = bpy.context.evaluated_depsgraph_get()
    evb = body.evaluated_get(dgh); meb = evb.to_mesh()
    mwb = body.matrix_world; nrm3 = mwb.to_3x3().inverted().transposed()
    PW = [mwb @ v.co for v in meb.vertices]
    NW = [(nrm3 @ v.normal).normalized() for v in meb.vertices]
    hair_v = {i for i, q in enumerate(PW) if scalp(q) > 0 and i in SKIN_V}
    # a neat cut, as an engineer keeps it: the sides and the back short (a fade, a few millimetres, the dark scalp
    # under it), the curls on top; the hairline thinned to nothing over its last few rings, so the hair grows out
    # of the skin instead of sitting on it like a cap
    ring = {}
    nb = {}
    for e_ in meb.edges:
        a_, b_ = e_.vertices
        nb.setdefault(a_, []).append(b_); nb.setdefault(b_, []).append(a_)
    front_ = [i for i in hair_v if any(j not in hair_v for j in nb.get(i, ()))]
    for i in front_:
        ring[i] = 0
    k_ = 0
    while front_ and k_ < 5:
        k_ += 1
        nxt = []
        for i in front_:
            for j in nb.get(i, ()):
                if j in hair_v and j not in ring:
                    ring[j] = k_; nxt.append(j)
        front_ = nxt
    def topk(q):
        t_ = max(0.0, min(1.0, (q.z - E.z - 0.035) / 0.075))
        return t_ * t_ * (3 - 2 * t_)
    bmh = bmesh.new()
    vmap = {}
    def hv(i):
        if i not in vmap:
            q, n = PW[i], NW[i]
            fade = min(1.0, ring.get(i, 5) / 4.0)
            vmap[i] = bmh.verts.new(q + n * (0.0006 + (0.0024 + (0.003 if CAP else 0.019) * topk(q)) * fade))
        return vmap[i]
    for poly in meb.polygons:
        if all(i in hair_v for i in poly.vertices):
            try:
                bmh.faces.new([hv(i) for i in poly.vertices])
            except ValueError:
                pass
    evb.to_mesh_clear()
    for m in masks:
        m.show_viewport = True
    bmesh.ops.subdivide_edges(bmh, edges=bmh.edges[:], cuts=1, use_grid_fill=True, smooth=0.6)
    bmesh.ops.smooth_vert(bmh, verts=bmh.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # the curls: once more subdivided, then every vertex pushed out along its normal by round cells of
    # noise (a curl about every 1.4 cm, standing up to 8 mm), so its outline and its shading read as tight curls
    bmesh.ops.subdivide_edges(bmh, edges=bmh.edges[:], cuts=1, use_grid_fill=True, smooth=0.5)
    bmh.normal_update()
    for v in bmh.verts:
        k2 = 0.0 if CAP else topk(v.co)
        if k2 <= 0:
            continue
        cells = abs(mnoise.noise(v.co * 90.0)) * 0.6 + mnoise.cell(v.co * 90.0) * 0.4
        v.co += v.normal * (k2 * (0.0048 * cells + 0.0006 * mnoise.noise(v.co * 240.0)))
    bmesh.ops.smooth_vert(bmh, verts=bmh.verts[:], factor=0.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.recalc_face_normals(bmh, faces=bmh.faces)
    meh = bpy.data.meshes.new('hair_solid'); bmh.to_mesh(meh); bmh.free()
    for poly in meh.polygons:
        poly.use_smooth = True
    hmat = bpy.data.materials.new('hair_solid'); hmat.use_nodes = True
    hmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.03, 0.025, 0.02, 1)
    meh.materials.append(hmat)
    hair_o = bpy.data.objects.new('hair_solid', meh); bpy.context.collection.objects.link(hair_o)
    mwh = hair_o.matrix_world.copy()
    hair_o.parent = rig; hair_o.parent_type = 'BONE'; hair_o.parent_bone = 'head'
    bpy.context.view_layer.update()
    hair_o.matrix_world = mwh
    print('solid hair', len(meh.vertices), 'verts from', len(hair_v), 'scalp vertices')

# ---- his cap: a plain six-panel cap, as he wears one. Built as a cap is cut, on his own head: a grid round from the
# band up to the button, each point where a ray from the middle of his head meets his head (a few millimetres out,
# over his hair) near the band, and one smooth dome above it (an ellipsoid round the whole of his head and hair);
# the band low on the forehead and over the ears; an opening at the back over the strap; the peak in front, curved
# down at its sides; a button on top. Held by the head bone, like his glasses and his hair. (Nothing downloaded.)
if CAP:
    from mathutils.bvhtree import BVHTree
    for m in masks:
        m.show_viewport = False
    bpy.context.view_layer.update()
    dgc = bpy.context.evaluated_depsgraph_get()
    evc = body.evaluated_get(dgc); mec = evc.to_mesh()
    bmb = bmesh.new(); bmb.from_mesh(mec); bmb.transform(body.matrix_world)
    bmb.verts.ensure_lookup_table()
    bmesh.ops.delete(bmb, geom=[v for v in bmb.verts if v.index not in SKIN_V], context='VERTS')
    tree = BVHTree.FromBMesh(bmb)
    bmb.free(); evc.to_mesh_clear()
    for m in masks:
        m.show_viewport = True
    BAND_F, BAND_B = float(arg('--cap-front', '0.048')), float(arg('--cap-back', '-0.012'))
    OFF_H = float(arg('--cap-off', '0.0055'))
    def capline(y):                       # the band's height over his eyes, from his forehead round to the back
        t_ = max(0.0, min(1.0, (y - E.y) / 0.16))
        return BAND_F + (BAND_B - BAND_F) * (t_ * t_ * (3 - 2 * t_))
    # the middle of his head: halfway between its front and back, its two sides
    c0 = E + Vector((0, 0.08, 0.02))
    def far(o_, d_):
        r_ = tree.ray_cast(o_, d_)
        return r_[3] if r_[0] is not None else None
    fb = (far(c0, Vector((0, -1, 0))), far(c0, Vector((0, 1, 0))))
    lr = (far(c0, Vector((-1, 0, 0))), far(c0, Vector((1, 0, 0))))
    cc = c0 + Vector(((lr[1] - lr[0]) / 2, (fb[1] - fb[0]) / 2, 0))
    print('cap: head', round(1000 * (fb[0] + fb[1])), 'mm long,', round(1000 * (lr[0] + lr[1])), 'mm wide')
    NU, NV = 72, 18
    dirf = lambda ph, th: Vector((math.sin(th) * math.sin(ph), -math.sin(th) * math.cos(ph), math.cos(th)))
    def head_at(d_):
        h_ = far(cc, d_)
        return cc + d_ * (h_ if h_ else 0.09)
    # the band's line: for each way round, how far down from the top the band is
    thb = []
    for i in range(NU):
        ph = 2 * math.pi * i / NU
        prev = None
        for k in range(1, 160):
            th = math.radians(k)
            p_ = head_at(dirf(ph, th))
            f_ = p_.z - E.z - capline(p_.y)
            if f_ < 0:
                th0 = math.radians(k - 1)
                thb.append(th0 + (th - th0) * (prev / (prev - f_)) if prev else th)
                break
            prev = f_
        else:
            thb.append(math.radians(120))
    # the grid's points on his head (out over his hair), and the dome that holds them all
    S_ = [j / NV for j in range(NV)]                      # (0 the band .. toward the top; the button closes it)
    QH = [[head_at(dirf(2 * math.pi * i / NU, thb[i] * (1 - s))) + dirf(2 * math.pi * i / NU, thb[i] * (1 - s)) * OFF_H for s in S_] for i in range(NU)]
    rr = Vector((max(abs(q.x - cc.x) for r_ in QH for q in r_), max(abs(q.y - cc.y) for r_ in QH for q in r_), max(q.z - cc.z for r_ in QH for q in r_)))
    en = lambda d: math.sqrt((d.x / rr.x) ** 2 + (d.y / rr.y) ** 2 + (d.z / rr.z) ** 2)
    rr = rr * (max(en(q - cc) for r_ in QH for q in r_) * 1.01)
    bmc = bmesh.new()
    V = []
    for i in range(NU):
        ph = 2 * math.pi * i / NU
        col = []
        for j, s in enumerate(S_):
            d_ = dirf(ph, thb[i] * (1 - s))
            qe = cc + d_ / en(d_)
            w_ = max(0.0, min(1.0, s / float(arg('--cap-hug', '0.3')))); w_ = w_ * w_ * (3 - 2 * w_)
            col.append(bmc.verts.new(QH[i][j].lerp(qe, w_)))
        V.append(col)
    pole = bmc.verts.new(cc + Vector((0, 0, rr.z)))
    HOLE = arg('--cap-hole', '1') != '0'
    HW = math.radians(float(arg('--cap-hole-w', '20')))
    def in_hole(i, j):
        ph = 2 * math.pi * (i + 0.5) / NU
        u_ = abs(ph - math.pi) / HW
        s_ = (j + 0.5) / NV
        return HOLE and u_ < 1 and 0.1 < s_ < 0.17 + 0.17 * math.cos(u_ * math.pi / 2)
    nh = 0
    for i in range(NU):
        i2 = (i + 1) % NU
        for j in range(NV - 1):
            if in_hole(i, j):
                nh += 1
                continue
            bmc.faces.new((V[i][j], V[i2][j], V[i2][j + 1], V[i][j + 1]))
        bmc.faces.new((V[i][NV - 1], V[i2][NV - 1], pole))
    # the cloth's thickness turned in at the band
    lip = [bmc.verts.new(V[i][0].co + (cc - V[i][0].co).normalized() * 0.003 + Vector((0, 0, 0.003))) for i in range(NU)]
    for i in range(NU):
        i2 = (i + 1) % NU
        bmc.faces.new((V[i2][0], V[i][0], lip[i], lip[i2]))
    # the peak, on the band's front columns
    LP, SPAN = float(arg('--cap-peak', '0.07')), math.radians(float(arg('--cap-span', '80')))
    TILT, DROOP = math.radians(float(arg('--cap-tilt', '12'))), float(arg('--cap-droop', '0.018'))
    cols = [i for i in range(NU) if min(2 * math.pi * i / NU, 2 * math.pi - 2 * math.pi * i / NU) <= SPAN]
    cols.sort(key=lambda i: (2 * math.pi * i / NU + math.pi) % (2 * math.pi))
    top_, bot_ = [], []
    for i in cols:
        ph = 2 * math.pi * i / NU
        phs = ph if ph <= math.pi else ph - 2 * math.pi
        u_ = abs(phs) / SPAN
        L_ = LP * max(0.0, math.cos(u_ * math.pi / 2)) ** 0.7
        dh = Vector((math.sin(ph), -math.cos(ph), 0.0))
        dp = (dh * 0.55 + Vector((0, -1, 0)) * 0.45).normalized()
        b0 = V[i][0].co
        o_ = b0 + dp * L_ + Vector((0, 0, -L_ * math.tan(TILT) - DROOP * u_ * u_ * (L_ / LP)))
        top_.append(bmc.verts.new(o_))
        bot_.append((bmc.verts.new(b0 + Vector((0, 0, -0.003))), bmc.verts.new(o_ + Vector((0, 0, -0.003)))))
    for k in range(len(cols) - 1):
        a_, b_ = cols[k], cols[k + 1]
        bmc.faces.new((V[a_][0], V[b_][0], top_[k + 1], top_[k]))
        bmc.faces.new((bot_[k][0], bot_[k][1], bot_[k + 1][1], bot_[k + 1][0]))
        bmc.faces.new((top_[k], top_[k + 1], bot_[k + 1][1], bot_[k][1]))
        bmc.faces.new((V[b_][0], V[a_][0], bot_[k][0], bot_[k + 1][0]))
    # the button on top
    btn = bmesh.ops.create_uvsphere(bmc, u_segments=10, v_segments=6, radius=0.0055)
    for v in btn['verts']:
        v.co = Vector((v.co.x, v.co.y, v.co.z * 0.5)) + pole.co + Vector((0, 0, 0.0008))
    bmesh.ops.recalc_face_normals(bmc, faces=bmc.faces)
    bmc.normal_update()
    if pole.normal.z < 0:
        bmesh.ops.reverse_faces(bmc, faces=bmc.faces)
    band = V
    print('cap: the opening at the back,', nh, 'faces; peak over', len(cols), 'columns')
    mcap = bpy.data.meshes.new('cap'); bmc.to_mesh(mcap); bmc.free()
    for poly in mcap.polygons:
        poly.use_smooth = True
    cmat = bpy.data.materials.new('cap'); cmat.use_nodes = True
    cmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.05, 0.06, 0.09, 1)
    mcap.materials.append(cmat)
    cap_o = bpy.data.objects.new('cap', mcap); bpy.context.collection.objects.link(cap_o)
    mwcap = cap_o.matrix_world.copy()
    cap_o.parent = rig; cap_o.parent_type = 'BONE'; cap_o.parent_bone = 'head'
    bpy.context.view_layer.update()
    cap_o.matrix_world = mwcap
    print('cap', len(mcap.vertices), 'verts; band', len(band), 'round; peak over', len(top_))
    if arg('--cap-test', None):
        scn_ = bpy.context.scene
        scn_.render.engine = 'BLENDER_WORKBENCH'
        scn_.display.shading.light = 'STUDIO'
        scn_.display.shading.show_cavity = True
        scn_.display.shading.color_type = 'MATERIAL'
        scn_.render.resolution_x = scn_.render.resolution_y = 420
        cam_ = bpy.data.objects.new('ccam', bpy.data.cameras.new('ccam')); scn_.collection.objects.link(cam_)
        cam_.data.lens = 50; cam_.data.clip_start = 0.01; scn_.camera = cam_
        hc = E + Vector((0, 0.06, 0.06))
        for k_, off in {'back': Vector((0, 0.55, 0.12)), 'backleft': Vector((0.4, 0.4, 0.2)), 'side': Vector((0.55, 0, 0)), 'front': Vector((0.15, -0.55, 0.08)), 'top': Vector((0, 0.1, 0.6))}.items():
            cam_.location = hc + off
            cam_.rotation_mode = 'QUATERNION'
            cam_.rotation_quaternion = (hc - cam_.location).to_track_quat('-Z', 'Y')
            scn_.render.filepath = f"{arg('--cap-test', '')}-{k_}.png"
            bpy.ops.render.render(write_still=True)
        print('cap test written')
        sys.exit(0)

# ---- new hands, drawn as the reference draws its people's: a smooth mitten of a palm and plain round fingers,
# each joint a capsule on its own bone (so the fingers take their fingers' turns exactly), in the skin's
# material; MakeHuman's detailed hands hidden. (Built here, from his own bones; the reference's mesh is never used.)
NEWHANDS = arg('--newhands', '0') != '0'          # (MakeHuman's own hands read better, now their palms are fitted)
if NEWHANDS:
    import bmesh
    bpy.context.view_layer.update()
    rw = rig.matrix_world
    bones = rig.data.bones
    Hd = lambda n: rw @ bones[n].head_local
    Tl = lambda n: rw @ bones[n].tail_local
    for side in ('l', 'r'):
        bm_ = bmesh.new()
        dl = bm_.verts.layers.deform.verify()
        gnames = []
        def gi_(n):
            if n not in gnames:
                gnames.append(n)
            return gnames.index(n)
        wrist, mid = Hd(f'hand_{side}'), Hd(f'middle_01_{side}')
        idx, pky = Hd(f'index_01_{side}'), Hd(f'pinky_01_{side}')
        pdir = (mid - wrist).normalized()
        across = (idx - pky)
        pw = across.length
        across.normalize()
        pn = pdir.cross(across).normalized()                 # (the palm's normal)
        th = 0.44 * pw                                       # its thickness
        # the palm: the hull of a ring at the wrist and a rounded bar along the knuckles
        pts = []
        for j in range(10):
            a = 2 * math.pi * j / 10
            pts.append(wrist + pdir * (0.08 * pw) + across * math.cos(a) * 0.36 * pw + pn * math.sin(a) * 0.36 * th)
        for kn in (idx, Hd(f'middle_01_{side}'), Hd(f'ring_01_{side}'), pky):
            for a in range(8):
                ang = 2 * math.pi * a / 8
                pts.append(kn - pdir * 0.06 * pw + pn * math.sin(ang) * 0.5 * th + pdir * math.cos(ang) * 0.14 * pw)
        vs = [bm_.verts.new(q) for q in pts]
        hull = bmesh.ops.convex_hull(bm_, input=vs)
        for v in hull.get('geom_interior', []):
            if isinstance(v, bmesh.types.BMVert):
                bm_.verts.remove(v)
        for v in bm_.verts:
            v[dl][gi_(f'hand_{side}')] = 1.0
        # the fingers: round segments, a little tapered, each on its bone
        def capsule(a, b, r0, r1, bone, n=10):
            d = (b - a); L = d.length; d.normalize()
            up = pn if abs(d.dot(pn)) < 0.9 else across
            u = d.cross(up).normalized(); w = d.cross(u)
            prof = [(-0.55 * r0, 0.35 * r0), (-0.35 * r0, 0.8 * r0), (0.0, r0), (L, r1), (L + 0.4 * r1, 0.8 * r1), (L + 0.62 * r1, 0.35 * r1)]
            rings = []
            for t, rr in prof:
                ring = []
                for j in range(n):
                    phi = 2 * math.pi * j / n
                    v = bm_.verts.new(a + d * t + (u * math.cos(phi) + w * math.sin(phi)) * rr)
                    v[dl][gi_(bone)] = 1.0
                    ring.append(v)
                rings.append(ring)
            for i in range(len(rings) - 1):
                for j in range(n):
                    bm_.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
            bm_.faces.new(rings[0][::-1]); bm_.faces.new(rings[-1])
        RAD = {'thumb': 0.165, 'index': 0.145, 'middle': 0.15, 'ring': 0.14, 'pinky': 0.12}
        for f, rk in RAD.items():
            r = rk * pw
            for k in (1, 2, 3):
                bn = f'{f}_0{k}_{side}'
                if bn not in bones:
                    continue
                a = Hd(bn)
                b = Hd(f'{f}_0{k + 1}_{side}') if k < 3 and f'{f}_0{k + 1}_{side}' in bones else Tl(bn)
                capsule(a, b, r * (0.96 ** (k - 1)), r * (0.96 ** k) * (0.92 if k == 3 else 1), bn)
        bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
        me_ = bpy.data.meshes.new(f'hand_{side}')
        bm_.to_mesh(me_); bm_.free()
        for poly in me_.polygons:
            poly.use_smooth = True
        ho = bpy.data.objects.new(f'hand_{side}', me_)
        bpy.context.collection.objects.link(ho)
        for n_ in gnames:
            ho.vertex_groups.new(name=n_)
        ho.parent = rig
        mod = ho.modifiers.new('rig', 'ARMATURE'); mod.object = rig
        me_.materials.append(skin)
        # MakeHuman's hand, hidden (taken out of the body's kept group)
        bgi = {g.name: g.index for g in body.vertex_groups}
        hand_b = {i for n_, i in bgi.items() if n_.endswith('_' + side) and (n_.startswith('hand') or n_.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky'))}
        hide = [v.index for v in body.data.vertices if sum(g.weight for g in v.groups if g.group in hand_b) >= 0.5]
        for m in [m for m in body.modifiers if m.type == 'MASK']:
            vg = body.vertex_groups.get(m.vertex_group)
            if vg is None:
                continue
            if m.invert_vertex_group:
                vg.add(hide, 1.0, 'REPLACE')
            else:
                vg.remove(hide)
        print('new hand', side, len(me_.vertices), 'verts; old hand hidden', len(hide))

# ---- their motion on him: the reference's people (mixamo rigs in their scene.glb, the user's download) ----
# Each of his bones turns as its counterpart in theirs turns, frame by frame: their bone's rotation from its
# rest, applied to his bone once his rest has been turned to point the way theirs points at rest (so a
# T-pose and an A-pose agree); his hips go where theirs go. Baked into one clip as long as theirs, which the
# site scrubs with their timeline's share of it.
RETARGET = arg('--retarget', None)
if RETARGET:
    from mathutils import Matrix, Quaternion
    THEIRS = os.path.abspath(arg('--theirs', 'blender/illoca/scene.glb'))
    MAP = {'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'head'}
    for side, s in (('Left', 'l'), ('Right', 'r')):
        MAP.update({f'{side}Shoulder': f'clavicle_{s}', f'{side}Arm': f'upperarm_{s}', f'{side}ForeArm': f'lowerarm_{s}', f'{side}Hand': f'hand_{s}',
                    f'{side}UpLeg': f'thigh_{s}', f'{side}Leg': f'calf_{s}', f'{side}Foot': f'foot_{s}', f'{side}ToeBase': f'ball_{s}'})
        for f, g in (('Thumb', 'thumb'), ('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky')):
            for k in (1, 2, 3):
                MAP[f'{side}Hand{f}{k}'] = f'{g}_0{k}_{s}'
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=THEIRS)
    theirs = [o for o in bpy.data.objects if o not in before]
    src_name = RETARGET.split('_action')[0]
    src_name = '_'.join(src_name.split('_')[:2])            # human_01 / human_02 / human_03
    src = next(o for o in theirs if o.type == 'ARMATURE' and o.name.startswith(src_name))
    # where their pencil sits in the hand, read as numbers only (their pencil is part of their person's mesh,
    # all of it on the thumb's middle bone): which of its vertices are the pencil. Their person stays hidden
    # until the export, so the pencil can be read where their hand really holds it; it is never exported.
    pen_idx = []
    geo = next((o for o in theirs if o.type == 'MESH' and o.parent is src), None)
    if geo is not None:
        import bmesh
        gi = {g.index: g.name for g in geo.vertex_groups}
        bm_ = bmesh.new(); bm_.from_mesh(geo.data)
        dl = bm_.verts.layers.deform.active
        bmesh.ops.remove_doubles(bm_, verts=bm_.verts, dist=1e-5)
        bm_.verts.ensure_lookup_table()
        seen, keys = set(), set()
        key = lambda co: (round(co.x, 4), round(co.y, 4), round(co.z, 4))
        for v in bm_.verts:
            if v.index in seen:
                continue
            comp, st = [], [v]
            seen.add(v.index)
            while st:
                q = st.pop(); comp.append(q)
                for e in q.link_edges:
                    w_ = e.other_vert(q)
                    if w_.index not in seen:
                        seen.add(w_.index); st.append(w_)
            if len(comp) > 20 and all(len(q[dl]) == 1 and gi[next(iter(q[dl].keys()))] == 'mixamorig:RightHandThumb2' for q in comp):
                keys |= {key(q.co) for q in comp}
        bm_.free()
        pen_idx = [v.index for v in geo.data.vertices if key(v.co) in keys]
        geo.hide_render = True; geo.hide_set(True)
        print('their pencil:', len(pen_idx), 'vertices')
    for o in theirs:                                        # only their rig (and, hidden, their person) stays
        if o is not src and o is not geo:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(m)
    act = bpy.data.actions[RETARGET]
    src.animation_data_create()
    src.animation_data.action = act
    try:
        src.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    sp = lambda n: src.pose.bones.get('mixamorig:' + n)
    scn = bpy.context.scene
    scn.render.fps = 24
    NF = int(round((act.frame_range[1] - act.frame_range[0]))) + 1
    F0 = int(act.frame_range[0])
    print('their clip', RETARGET, 'frames', F0, '..', F0 + NF - 1)

    # his rig at the origin, turned to face the way theirs faces at rest
    rig.parent = None
    rig.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    def lateral(arm, l, r):
        return (arm.matrix_world @ arm.data.bones[r].head_local) - (arm.matrix_world @ arm.data.bones[l].head_local)
    a_src = lateral(src, 'mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'); a_src.z = 0
    a_tgt = lateral(rig, 'thigh_l', 'thigh_r'); a_tgt.z = 0
    yaw = a_tgt.to_2d().angle_signed(a_src.to_2d())
    # his size: theirs. Their people are smaller than him (her body is 18% shorter), so he is scaled to the size
    # of the one whose motion he takes (the mean of the hips-to-head and the shoulder-to-wrist ratios): the
    # shots then hold the same people at the same size, and his wrists and feet are put on theirs below
    span = lambda arm, a_, b_: ((arm.matrix_world @ arm.data.bones[b_].head_local) - (arm.matrix_world @ arm.data.bones[a_].head_local)).length
    FIT = arg('--fit', 'auto')
    if FIT == 'auto':
        r_body = span(src, 'mixamorig:Hips', 'mixamorig:Head') / span(rig, 'pelvis', 'head')
        r_arm = (span(src, 'mixamorig:RightArm', 'mixamorig:RightForeArm') + span(src, 'mixamorig:RightForeArm', 'mixamorig:RightHand')) / \
                (span(rig, 'upperarm_r', 'lowerarm_r') + span(rig, 'lowerarm_r', 'hand_r'))
        FIT = 0.5 * (r_body + r_arm)
        # (but never so small that his legs cannot reach their feet: a standing figure's legs are straight)
        leg = span(rig, 'thigh_r', 'calf_r') + span(rig, 'calf_r', 'foot_r')
        need = 0.0
        for f_ in range(F0, F0 + NF, 3):
            scn.frame_set(f_)
            for sd in ('Left', 'Right'):
                hip = src.matrix_world @ src.pose.bones[f'mixamorig:{sd}UpLeg'].head
                ank = src.matrix_world @ src.pose.bones[f'mixamorig:{sd}Foot'].head
                need = max(need, (ank - hip).length)
        FIT = max(FIT, need / leg + 0.003)
    FIT = float(FIT)
    rig.matrix_world = Matrix.Rotation(-yaw, 4, 'Z') @ Matrix.Diagonal((FIT, FIT, FIT, 1))
    bpy.context.view_layer.update()
    print('his rest turned by', round(math.degrees(-yaw), 1), 'and scaled by', round(FIT, 3))

    # his hands shaped as theirs: each bone of the palm and of the fingers made as long as the bone it copies
    # (stretched or shortened along itself, the skin on it with it), its girth left as it is. Scaling the whole
    # hand up to their long palm, as before, made his fingers half again as thick as theirs and his palm 40%
    # wider: a fist of sausages round the pencil. With their lengths, their turns put his knuckles and his
    # fingertips where theirs are, round their pencil, and his fingers keep a real hand's width.
    if arg('--hand-shape', '1') != '0':
        MWr, MWs = rig.matrix_world.copy(), src.matrix_world
        OH = lambda n: MWr @ rig.data.bones[n].head_local
        OT_ = lambda n: MWr @ rig.data.bones[n].tail_local
        TH = lambda n: MWs @ src.data.bones['mixamorig:' + n].head_local
        SHAPE = {}
        for side, s_ in (('Right', 'r'), ('Left', 'l')):
            SHAPE[f'hand_{s_}'] = (f'{side}Hand', f'{side}HandMiddle1', f'middle_01_{s_}')
            for f_, g_ in (('Thumb', 'thumb'), ('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky')):
                for k_ in (1, 2, 3):
                    SHAPE[f'{g_}_0{k_}_{s_}'] = (f'{side}Hand{f_}{k_}', f'{side}Hand{f_}{k_ + 1}', f'{g_}_0{k_ + 1}_{s_}' if k_ < 3 else None)
        A = {}          # bone: (old head, new head, the axis it is stretched along, by how much)
        def amap(a, q):
            h0, h1, u, sc = a
            d = q - h0
            return h1 + d + u * ((sc - 1.0) * d.dot(u))
        order_ = []
        def walk_(b):
            order_.append(b)
            for c in b.children:
                walk_(c)
        for b in rig.data.bones:
            if b.parent is None:
                walk_(b)
        rep = []
        for b in order_:
            if b.name not in SHAPE or not src.data.bones.get('mixamorig:' + SHAPE[b.name][1]):
                continue
            ta, tb, nxt = SHAPE[b.name]
            h0 = OH(b.name)
            v_ = (OH(nxt) if nxt else OT_(b.name)) - h0
            mine, theirs_ = v_.length, (TH(tb) - TH(ta)).length
            sc = max(0.7, min(1.6, theirs_ / mine))
            h1 = amap(A[b.parent.name], h0) if b.parent and b.parent.name in A else h0.copy()
            A[b.name] = (h0, h1, v_.normalized(), sc)
            rep.append(f'{b.name} {1000 * mine:.0f}->{1000 * theirs_:.0f}mm')
        print('hands shaped as theirs:', ', '.join(rep))
        # the skin: every vertex moved as the bones it hangs on move, by its weights (the rest of its weight, on
        # the forearm, keeps it where it is: the wrist stays joined)
        names = set(rig.data.bones.keys())
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object is rig for m in o.modifiers)]:
            gi = {g.index: g.name for g in o.vertex_groups}
            if not any(n in A for n in gi.values()):
                continue
            if o.data.shape_keys:
                bpy.ops.object.select_all(action='DESELECT')
                bpy.context.view_layer.objects.active = o
                o.select_set(True)
                bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
            mw = o.matrix_world; mwi = mw.inverted()
            moved = 0
            for v in o.data.vertices:
                ws = [(gi[g.group], g.weight) for g in v.groups if gi.get(g.group) in names and g.weight > 0]
                if not ws or not any(n in A for n, _ in ws):
                    continue
                p0 = mw @ v.co
                tot = sum(w for _, w in ws)
                acc = Vector((0, 0, 0))
                for n, w in ws:
                    acc += (amap(A[n], p0) if n in A else p0) * w
                v.co = mwi @ (acc / tot)
                moved += 1
            o.data.update()
            print('  reshaped', o.name, moved, 'vertices')
        # and the bones themselves
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        MWi = MWr.inverted()
        news = {n: (MWi @ a[1], MWi @ amap(a, OT_(n))) for n, a in A.items()}
        for n in [b.name for b in order_ if b.name in news]:
            eb = rig.data.edit_bones[n]
            roll = eb.roll
            eb.head, eb.tail = news[n]
            eb.roll = roll
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.context.view_layer.update()

    RW = rig.matrix_world.copy()
    RWr = Matrix.Rotation(-yaw, 4, 'Z')                       # (its turn alone, for the bones' turns)
    R3 = RW.to_3x3().normalized()
    # rests: world rotations, and the turn that points his rest bone along theirs
    tgt_bones = rig.data.bones
    rest_src, align, rest_tgt_w = {}, {}, {}
    for sname, tname in MAP.items():
        sb = src.data.bones.get('mixamorig:' + sname); tb = tgt_bones.get(tname)
        if not sb or not tb:
            continue
        sw = src.matrix_world @ sb.matrix_local
        tw = RWr @ tb.matrix_local
        rest_src[tname] = sw.to_quaternion()
        rest_tgt_w[tname] = tw.to_quaternion()
        ds = (src.matrix_world @ sb.tail_local) - (src.matrix_world @ sb.head_local)
        dt = (RW @ tb.tail_local) - (RW @ tb.head_local)
        align[tname] = dt.normalized().rotation_difference(ds.normalized())
    # where a bone's turn about its own length matters (the palm: which way it faces; the hips and the chest:
    # where the legs and the shoulders hang from), the turn that fits his rest to theirs is taken from two
    # directions, not one: along the bone, and across it (the knuckles, the hips, the shoulders)
    def gframe(arm, mw, y0, y1, x0, x1, pre=''):
        P_ = lambda n: mw @ arm.data.bones[pre + n].head_local
        Y = (P_(y1) - P_(y0)).normalized()
        X = P_(x1) - P_(x0); X = (X - Y * X.dot(Y)).normalized()
        return Matrix((X, Y, X.cross(Y))).transposed()
    FRAMES = {
        'hand_r': (('hand_r', 'middle_01_r', 'pinky_01_r', 'index_01_r'), ('RightHand', 'RightHandMiddle1', 'RightHandPinky1', 'RightHandIndex1')),
        'hand_l': (('hand_l', 'middle_01_l', 'pinky_01_l', 'index_01_l'), ('LeftHand', 'LeftHandMiddle1', 'LeftHandPinky1', 'LeftHandIndex1')),
        'pelvis': (('pelvis', 'spine_01', 'thigh_r', 'thigh_l'), ('Hips', 'Spine', 'RightUpLeg', 'LeftUpLeg')),
        'spine_03': (('spine_03', 'neck_01', 'clavicle_r', 'clavicle_l'), ('Spine2', 'Neck', 'RightShoulder', 'LeftShoulder')),
    }
    for b_, (o_, t_) in FRAMES.items():
        if b_ in align and all(n in tgt_bones for n in o_) and all(src.data.bones.get('mixamorig:' + n) for n in t_):
            Fo = gframe(rig, RW, *o_); Ft = gframe(src, src.matrix_world, *t_, pre='mixamorig:')
            align[b_] = (Ft @ Fo.inverted()).to_quaternion()
            print('frame fitted', b_)
    mapped = {v: k for k, v in MAP.items() if v in rest_src}
    # his bones in the order a parent comes before its children
    order = []
    def walk(b):
        order.append(b)
        for c in b.children:
            walk(c)
    for b in tgt_bones:
        if b.parent is None:
            walk(b)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    # his hips: theirs, less the height his legs differ by (their hips' rest height over his)
    hs = (src.matrix_world @ src.data.bones['mixamorig:Hips'].head_local).z
    ht = (RW @ tgt_bones['pelvis'].head_local).z
    drop = ht - hs
    print('hips at rest: theirs', round(hs, 3), 'his', round(ht, 3))
    RWi = RW.inverted()
    # his wrists go where theirs go (his arms are not as long as theirs, so turning his bones as theirs turn
    # put his hands 17 cm off, in the desk): after the turns, each arm is bent in its own plane (two bones,
    # the law of cosines) until the wrist is on theirs; the hand keeps its turn, so the grip is theirs
    # (each limb bends toward their elbow or knee, so his forearm lies where hers does: on the desk, not in it)
    ARMS = [('upperarm_l', 'lowerarm_l', 'hand_l', 'LeftHand', 'LeftForeArm'), ('upperarm_r', 'lowerarm_r', 'hand_r', 'RightHand', 'RightForeArm'),
            ('thigh_l', 'calf_l', 'foot_l', 'LeftFoot', 'LeftLeg'), ('thigh_r', 'calf_r', 'foot_r', 'RightFoot', 'RightLeg')]
    REACH = arg('--reach', '1') != '0'
    # his hands a fifth bigger, as the reference draws its people's hands (theirs are big and read from afar)
    HAND_S = arg('--hands', 'auto')
    if HAND_S == 'auto':
        HAND_S = span(src, 'mixamorig:RightHand', 'mixamorig:RightHandMiddle1') / span(rig, 'hand_r', 'middle_01_r')
    HAND_S = float(HAND_S)
    print('hands scaled by', round(HAND_S, 3))
    HAND_BONES = [b.name for b in tgt_bones if b.name.startswith('hand_') or b.name.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky')]
    # the desk (their room's: top 0.762, x -1.014..0.986, the site's z -0.83..0.63, so Blender's y -0.63..0.83),
    # and how far above it a forearm in a sleeve must stay
    DESK, CLR, EDGE = 0.762, 0.03, -0.63
    EXACT = arg('--exact-elbow', '1') != '0'          # (elbows and wrists where theirs are)
    TIPS = arg('--tips', arg('--hand-shape', '1')) != '0'   # (his fingertips bent onto theirs: only with their hand's shape)
    tip_err = {}
    CURL = float(arg('--curl', '0'))                  # (extra closing of his fingers: off; their turns, as they are)
    over_desk = lambda w: -1.014 < w.x < 0.986 and -0.63 < w.y < 0.83
    short = {}
    def build(WANT, pel):
        M = {}
        for b in order:
            rest = b.matrix_local
            base = M[b.parent.name] @ b.parent.matrix_local.inverted() @ rest if b.parent else rest.copy()
            if b.name in WANT:
                w = WANT[b.name].to_4x4()
                w.translation = pel if b.name == 'pelvis' else base.translation
                M[b.name] = w
            else:
                M[b.name] = base
        return M
    # ---- his right hand's grip: a writer's own (the dynamic tripod), not theirs -------------------------------
    # Their person holds the pencil upright in a fist (it reads from afar); up close no hand holds a pencil so.
    # His: the pencil between the pads of the thumb and the index, on the side of the middle finger's last joint,
    # its shaft lying back across the web of the thumb, the ring and little fingers curled under. The grip is fixed
    # in his hand (worked out once, at rest, from his own bones); the hand turns as theirs, tipped so the pencil
    # stands at a writer's slant, and is carried so his pencil's point is on theirs (on the paper, drawing theirs)
    PEN = arg('--pen', None)
    GRIP = arg('--grip', 'tripod') if (PEN and pen_idx) else 'theirs'
    penT = None
    if PEN and pen_idx:
        import numpy as np
        Fm = NF // 2
        scn.frame_set(F0 + Fm)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = geo.evaluated_get(dg); me_e = ev.to_mesh()
        P_ = np.array([tuple(ev.matrix_world @ me_e.vertices[i].co) for i in pen_idx])
        ev.to_mesh_clear()
        c_ = P_.mean(0)
        ax = np.linalg.eigh(np.cov((P_ - c_).T))[1][:, -1]
        t_ = (P_ - c_) @ ax
        L_ = t_.max() - t_.min()
        rad = lambda m: np.linalg.norm((P_[m] - c_) - np.outer(t_[m], ax), axis=1).mean()
        lo, hi = t_ < t_.min() + 0.12 * L_, t_ > t_.max() - 0.12 * L_
        e_lo, e_hi = Vector(c_ + ax * t_.min()), Vector(c_ + ax * t_.max())
        tipT, backT = (e_lo, e_hi) if rad(lo) < rad(hi) else (e_hi, e_lo)
        # their point in their thumb's frame (their pencil rides that bone), to follow it frame by frame
        th2 = lambda: src.matrix_world @ sp('RightHandThumb2').matrix
        tipL = th2().inverted() @ tipT
        penT = (P_, tipT, backT, L_, Fm)
        zs = []
        for f_ in range(F0, F0 + NF, 4):
            scn.frame_set(f_)
            zs.append((th2() @ tipL).z)
        print('their pencil point height over the desk (mm): min', round(1000 * (min(zs) - 0.762), 1), 'max', round(1000 * (max(zs) - 0.762), 1), 'F0', F0, 'length', round(1000 * float(L_), 1))
    G, grip_off, grip_ax, Hr = {}, None, None, None
    if GRIP == 'tripod':
        BL = lambda n: tgt_bones[n].matrix_local
        hd = lambda n: tgt_bones[n].head_local.copy()
        Hr = BL('hand_r').to_3x3().normalized()
        H0 = hd('hand_r')
        fwd0 = (hd('middle_01_r') - H0).normalized()
        rad0 = hd('index_01_r') - hd('pinky_01_r'); rad0 = (rad0 - fwd0 * rad0.dot(fwd0)).normalized()
        pal0 = rad0.cross(fwd0)                          # (a right hand: the palm's side)
        thumb_side = (hd('thumb_02_r') - H0).dot(pal0)
        print('grip: the thumb lies', round(1000 * thumb_side, 1), 'mm to the palm side (should be > 0)')
        fl = lambda k, d: [float(x) for x in arg(k, d).split(',')]
        ANG = {'index': fl('--g-index', '30,38,12'), 'middle': fl('--g-middle', '42,58,22'), 'ring': fl('--g-ring', '62,78,40'), 'pinky': fl('--g-pinky', '70,80,40')}
        SPR = fl('--g-spread', '4,0,-6,-12')
        SPREAD = {'index': SPR[0], 'middle': SPR[1], 'ring': SPR[2], 'pinky': SPR[3]}
        for fg, angs in ANG.items():
            d1 = (BL(f'{fg}_01_r').to_3x3() @ Vector((0, 1, 0))).normalized()
            axf = d1.cross(pal0).normalized()
            Rs = Matrix.Rotation(math.radians(SPREAD[fg]), 3, pal0)     # (spread: toward the thumb +)
            cum = 0.0
            for k_, a_ in zip((1, 2, 3), angs):
                cum += a_
                G[f'{fg}_0{k_}_r'] = Matrix.Rotation(math.radians(cum), 3, Rs @ axf) @ Rs @ BL(f'{fg}_0{k_}_r').to_3x3()
        for k_ in (1, 2, 3):
            G[f'thumb_0{k_}_r'] = BL(f'thumb_0{k_}_r').to_3x3()
        Mg = build(G, None)
        tl = lambda n: Mg[n] @ Vector((0, tgt_bones[n].length, 0))
        hh = lambda n: Mg[n].translation.copy()
        pd = lambda n: (Mg[n].to_3x3().normalized() @ (BL(n).to_3x3().normalized().inverted() @ pal0)).normalized()
        RP = float(arg('--g-r', '0.0036')) / FIT
        PADI, PADM = float(arg('--g-padi', '0.0055')) / FIT, float(arg('--g-padm', '0.0075')) / FIT
        # where the pencil's axis passes: under the index's pad, on the thumb side of the middle finger's last
        # joint, and back across the web between the thumb and the index
        di = (tl('index_03_r') - hh('index_03_r')).normalized()
        C_i = tl('index_03_r') - di * (0.006 / FIT) + pd('index_03_r') * (PADI + RP)
        C_m = hh('middle_03_r').lerp(tl('middle_03_r'), 0.5) + rad0 * (PADM + RP) - pd('middle_03_r') * (0.002 / FIT)
        web = hh('index_01_r') + (rad0 * float(arg('--g-webr', '0.016')) - fwd0 * float(arg('--g-webb', '0.012')) - pal0 * float(arg('--g-webd', '0.004'))) / FIT
        Cc = C_i.lerp(C_m, 0.5)
        axv = (web - Cc).normalized()
        tip = Cc - axv * (float(arg('--g-tip', '0.026')) / FIT)
        offl = lambda q: ((q - Cc) - axv * (q - Cc).dot(axv)).length
        print('grip: pencil axis off the index pad line', round(1000 * FIT * offl(C_i), 1), 'mm, off the middle', round(1000 * FIT * offl(C_m), 1), 'mm')
        # the thumb: its pad onto the pencil's thumb side, just behind the index (a few rounds of CCD)
        side = rad0 - axv * rad0.dot(axv); side.normalize()
        Tt = Cc + (axv * float(arg('--g-thumb-up', '0.008')) + side * (0.0036 + float(arg('--g-padt', '0.0065'))) + pal0 * 0.002) / FIT
        ch = ['thumb_01_r', 'thumb_02_r', 'thumb_03_r']
        def fk_t():
            Mc = {}
            for c in ch:
                bn = tgt_bones[c]
                Mp = Mc.get(bn.parent.name) or Mg[bn.parent.name]
                w = G[c].to_4x4()
                w.translation = (Mp @ bn.parent.matrix_local.inverted() @ bn.matrix_local).translation
                Mc[c] = w
            dt = Mc[ch[-1]].to_3x3() @ Vector((0, 1, 0))
            return Mc, Mc[ch[-1]] @ Vector((0, tgt_bones[ch[-1]].length, 0)) - dt.normalized() * (0.006 / FIT)
        for it in range(12):
            for k_ in (2, 1, 0):
                Mc, padt = fk_t()
                j_ = Mc[ch[k_]].translation
                v1, v2 = padt - j_, Tt - j_
                if v1.length < 1e-6 or v2.length < 1e-6:
                    continue
                q = v1.rotation_difference(v2)
                if q.angle > math.radians(8):
                    q = Quaternion(q.axis, math.radians(8))
                for c in ch[k_:]:
                    G[c] = q.to_matrix() @ G[c]
        print('grip: thumb pad off its place', round(1000 * FIT * (fk_t()[1] - Tt).length, 1), 'mm')
        Mg = build(G, None)
        grip_off = Hr.inverted() @ (tip - H0)            # (the point, from the wrist, in the hand's rest frame)
        grip_ax = (Hr.inverted() @ axv).normalized()
        GREL = {n: Hr.inverted() @ G[n] for n in G}
        ELEV = math.radians(float(arg('--g-elev', '58')))
        PITCH = float(arg('--g-pitch', '25'))             # (how far his hand may bend at the wrist to bring the point down)
        pitch_ = {}
        print('grip: point', round(1000 * FIT * (tip - H0).length, 1), 'mm from the wrist')
        if arg('--grip-test', None):
            # a look at the grip alone, at rest: the hand from five sides, a stick for the pencil
            for b in order:
                pb = rig.pose.bones[b.name]
                rest = b.matrix_local
                base = Mg[b.parent.name] @ b.parent.matrix_local.inverted() @ rest if b.parent else rest.copy()
                pb.matrix_basis = base.inverted() @ Mg[b.name]
            bpy.context.view_layer.update()
            Lp = (float(penT[3]) if penT else 0.16) / FIT
            cyl = bpy.data.meshes.new('gtest')
            bmt = bmesh.new()
            bmesh.ops.create_cone(bmt, cap_ends=True, segments=12, radius1=RP, radius2=RP, depth=Lp)
            bmt.to_mesh(cyl); bmt.free()
            st = bpy.data.objects.new('gtest', cyl); bpy.context.collection.objects.link(st)
            st.matrix_world = RW @ (Matrix.Translation(tip + axv * Lp / 2) @ Vector((0, 0, 1)).rotation_difference(axv).to_matrix().to_4x4())
            for o in theirs:
                try:
                    o.hide_render = True
                except ReferenceError:
                    pass
            scn.render.engine = 'BLENDER_WORKBENCH'
            scn.display.shading.light = 'STUDIO'
            scn.display.shading.show_cavity = True
            scn.render.resolution_x = scn.render.resolution_y = 480
            cam = bpy.data.objects.new('gcam', bpy.data.cameras.new('gcam')); scn.collection.objects.link(cam)
            cam.data.lens = 50; cam.data.clip_start = 0.01; scn.camera = cam
            cw = RW @ Cc.lerp(H0, 0.4)
            fw, rw_, pw = (RW.to_3x3() @ fwd0).normalized(), (RW.to_3x3() @ rad0).normalized(), (RW.to_3x3() @ pal0).normalized()
            for j_, off in enumerate((-pw * 0.3 + rw_ * 0.08, rw_ * 0.3 + fw * 0.05, fw * 0.3 - pw * 0.08 + rw_ * 0.08, -rw_ * 0.3 - pw * 0.1, pw * 0.3 + rw_ * 0.05)):
                cam.location = cw + off
                cam.rotation_mode = 'QUATERNION'
                cam.rotation_quaternion = (cw - cam.location).to_track_quat('-Z', 'Y')
                scn.render.filepath = f"{arg('--grip-test', '')}-{j_}.png"
                bpy.ops.render.render(write_still=True)
            print('grip test written')
            sys.exit(0)
    hand_M = {}
    for fi in range(NF):
        scn.frame_set(F0 + fi)
        WANT = {}
        for b in order:
            if b.name in mapped:
                cur = (src.matrix_world @ sp(mapped[b.name]).matrix).to_quaternion()
                delta = cur @ rest_src[b.name].inverted()
                WANT[b.name] = (R3.to_quaternion().inverted() @ (delta @ align[b.name] @ rest_tgt_w[b.name])).to_matrix()
        pel = RWi @ (src.matrix_world @ sp('Hips').matrix.translation)   # (his hips go where theirs go)
        if CURL:
            # MakeHuman's fingers close less than theirs for the same turns: each joint of his right hand's four
            # fingers turned a little further toward the palm (the side they already curl to)
            M0 = build(WANT, pel)
            fwd = (M0['middle_01_r'].translation - M0['hand_r'].translation).normalized()
            inward = M0['middle_03_r'].translation - M0['middle_01_r'].translation
            inward = (inward - fwd * inward.dot(fwd))
            if inward.length > 1e-6:
                inward.normalize()
                for fg in ('index', 'middle', 'ring', 'pinky'):
                    for kk in (1, 2, 3):
                        bn = f'{fg}_0{kk}_r'
                        if bn not in WANT:
                            continue
                        d_ = (WANT[bn] @ Vector((0, 1, 0))).normalized()
                        axv = d_.cross(inward)
                        if axv.length > 1e-6:
                            WANT[bn] = Matrix.Rotation(math.radians(CURL), 3, axv.normalized()) @ WANT[bn]
        for hb in HAND_BONES:
            if hb in WANT:
                WANT[hb] = WANT[hb] @ Matrix.Diagonal((HAND_S, HAND_S, HAND_S))
        wrist_t = None
        if GRIP == 'tripod' and 'hand_r' in WANT:
            Rh = WANT['hand_r'].normalized()
            av = Rh @ grip_ax
            hz = Vector((av.x, av.y, 0.0))
            if hz.length < 1e-3:
                hz = Vector((1.0, 0.0, 0.0))
            hz.normalize()
            want_v = hz * math.cos(ELEV) + Vector((0, 0, 1)) * math.sin(ELEV)
            qf = av.rotation_difference(want_v)
            if qf.angle > math.radians(45):
                qf = Quaternion(qf.axis, math.radians(45))
            Rh = qf.to_matrix() @ Rh
            WANT['hand_r'] = Rh @ Matrix.Diagonal((HAND_S, HAND_S, HAND_S))
            for n_, r_ in GREL.items():
                WANT[n_] = Rh @ r_ @ Matrix.Diagonal((HAND_S, HAND_S, HAND_S))
            # his wrist stays on theirs (his arm cannot reach their point: their pencil is under their fist, his
            # 12 cm out in front of his wrist); his point comes down onto the paper (to their point's height, so it
            # lifts where theirs lifts) by his hand bending at the wrist, the little left by his wrist coming down
            their_tip = RWi @ (th2() @ tipL)
            W_t = RWi @ (src.matrix_world @ sp('RightHand').head)
            rel = Rh @ (grip_off * HAND_S)
            r_ = rel.length
            e0 = math.asin(max(-1.0, min(1.0, rel.z / r_)))
            e1 = math.asin(max(-1.0, min(1.0, (their_tip.z - W_t.z) / r_)))
            de = max(-math.radians(PITCH), min(math.radians(PITCH), e1 - e0))
            hzr = Vector((rel.x, rel.y, 0.0))
            if hzr.length > 1e-6:
                pax = hzr.normalized().cross(Vector((0, 0, 1)))           # (turning about it by + raises the point)
                Rp = Matrix.Rotation(de, 3, pax)
                if (Rp @ rel).z < rel.z and de > 0 or (Rp @ rel).z > rel.z and de < 0:
                    Rp = Matrix.Rotation(-de, 3, pax)
                Rh = Rp @ Rh
                WANT['hand_r'] = Rh @ Matrix.Diagonal((HAND_S, HAND_S, HAND_S))
                for n_, r_m in GREL.items():
                    WANT[n_] = Rh @ r_m @ Matrix.Diagonal((HAND_S, HAND_S, HAND_S))
                rel = Rh @ (grip_off * HAND_S)
            wrist_t = W_t + Vector((0, 0, their_tip.z - (W_t.z + rel.z)))
            pitch_[fi] = (math.degrees(de), (their_tip.z - (W_t.z + rel.z)) * FIT, math.degrees(math.asin(max(-1, min(1, (Rh @ grip_ax).z)))))
        M = build(WANT, pel)
        if REACH:
            # a standing figure whose legs are still short of their feet: its hips come down that much
            for _ in range(3):
                ex = 0.0
                for up, lo, ha, sname, _ in ARMS[2:]:
                    S_ = M[up].translation
                    T_ = RWi @ (src.matrix_world @ sp(sname).head)
                    L_ = (tgt_bones[lo].head_local - tgt_bones[up].head_local).length + (tgt_bones[ha].head_local - tgt_bones[lo].head_local).length
                    ex = max(ex, (T_ - S_).length - (L_ - 0.002))
                if ex <= 1e-5:
                    break
                pel = pel - (RWi.to_3x3() @ Vector((0, 0, 1))).normalized() * ex
                M = build(WANT, pel)
            # his shoulders sit lower under his long neck than theirs do (5.6 cm): each collarbone turned up toward
            # their shoulder by a part of the way (--lift), so his upper arm needs less shortening to reach her elbow
            LIFT = float(arg('--lift', '0.5'))
            if LIFT:
                for cl, up_, sname_ in (('clavicle_r', 'upperarm_r', 'RightArm'), ('clavicle_l', 'upperarm_l', 'LeftArm')):
                    if cl not in WANT:
                        continue
                    C0, S0 = M[cl].translation.copy(), M[up_].translation.copy()
                    St = RWi @ (src.matrix_world @ sp(sname_).head)
                    WANT[cl] = (S0 - C0).rotation_difference(S0.lerp(St, LIFT) - C0).to_matrix() @ WANT[cl]
                M = build(WANT, pel)
            for up, lo, ha, sname, mname in ARMS:
                if up not in WANT or lo not in WANT:
                    continue
                S, E0, W0 = M[up].translation.copy(), M[lo].translation.copy(), M[ha].translation.copy()
                T = RWi @ (src.matrix_world @ sp(sname).head)
                if ha == 'hand_r' and wrist_t is not None:
                    short['grip_shift'] = max(short.get('grip_shift', 0), (wrist_t - T).length * FIT)
                    T = wrist_t
                a = (tgt_bones[lo].head_local - tgt_bones[up].head_local).length    # (armature space: his own size)
                b_ = (tgt_bones[ha].head_local - tgt_bones[lo].head_local).length
                dv = T - S
                d0 = dv.length
                d = min(max(d0, abs(a - b_) + 1e-4), a + b_ - 1e-4)
                short[ha] = max(short.get(ha, 0), d0 - d)
                dirv = dv.normalized()
                arm = up.startswith('upperarm')
                if arm and not EXACT:                         # (a wrist on the desk stays a sleeve's width above it)
                    Tw = RW @ T
                    if over_desk(Tw) and Tw.z < DESK + CLR:
                        Tw.z = DESK + CLR
                        T = RWi @ Tw
                Et = RWi @ (src.matrix_world @ sp(mname).head)     # (their elbow / knee: the bend's side)
                perp = (Et - S) - dirv * (Et - S).dot(dirv)
                if perp.length < 1e-5:
                    perp = (E0 - S) - dirv * (E0 - S).dot(dirv)
                if perp.length < 1e-6:
                    perp = Vector((0, 0, -1)) - dirv * (-dirv.z)
                perp.normalize()
                ca = max(-1.0, min(1.0, (a * a + d * d - b_ * b_) / (2 * a * d)))
                al_ = math.acos(ca)
                E = S + a * (math.cos(al_) * dirv + math.sin(al_) * perp)
                if arm and REACH and not EXACT:
                    # his forearm is thicker than hers: if the elbow, or the forearm where it crosses the desk's
                    # front edge, would be in the desk, the bend turns about the shoulder-wrist line until it clears
                    def clear(Ec):
                        Ew, Tw2 = RW @ Ec, RW @ T
                        c = (Ew.z - DESK) if over_desk(Ew) else 1.0
                        if (Ew.y - EDGE) * (Tw2.y - EDGE) < 0:             # (it crosses the front edge)
                            k_ = (EDGE - Ew.y) / (Tw2.y - Ew.y)
                            c = min(c, Ew.z + (Tw2.z - Ew.z) * k_ - DESK)
                        return c
                    if clear(E) < CLR:
                        best, bestE = clear(E), E
                        for ang in range(10, 181, 10):
                            for sg in (1, -1):
                                pr = Quaternion(dirv, math.radians(ang * sg)) @ perp
                                Ec = S + a * (math.cos(al_) * dirv + math.sin(al_) * pr)
                                c = clear(Ec)
                                if c > best:
                                    best, bestE = c, Ec
                            if best >= CLR:
                                break
                        E = bestE
                sa = sb = 1.0
                if arm and EXACT:
                    # the elbow where hers is, exactly (so his forearm lies on the desk as hers does): each bone of
                    # the arm stretched along itself by the little his lengths differ from hers
                    E = RWi @ (src.matrix_world @ sp(mname).head)
                    sa, sb = (E - S).length / a, (T - E).length / b_
                R1 = (E0 - S).rotation_difference(E - S).to_matrix()
                # (the stretch uniform: a bone scaled along its length alone shears the bones it carries, a shear
                # no glTF node can hold; exported, it threw his wrist 2-3 cm off hers and swelled his forearm)
                WANT[up] = R1 @ WANT[up] @ Matrix.Diagonal((sa, sa, sa))
                R2 = (R1 @ (W0 - E0)).rotation_difference(T - E).to_matrix()
                WANT[lo] = R2 @ R1 @ WANT[lo] @ Matrix.Diagonal((sb, sb, sb))
            M = build(WANT, pel)
        if TIPS:
            # each finger bent the last little way onto theirs: their fingertip is the target, and each joint, from
            # the tip back, is turned to bring his tip to it (a few rounds of CCD, each turn kept small). His bones
            # are their lengths, so the turns are a few degrees, and his fingers close on the pencil where theirs do
            for side_, s_ in (('Right', 'r'), ('Left', 'l')):
                for f_, g_ in (('Thumb', 'thumb'), ('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky')):
                    ch = [f'{g_}_0{k_}_{s_}' for k_ in (1, 2, 3)]
                    tb_ = sp(f'{side_}Hand{f_}3')
                    if tb_ is None or not all(c in WANT for c in ch):
                        continue
                    tgt = RWi @ (src.matrix_world @ tb_.tail)
                    def fk():
                        Mc = {}
                        for c in ch:
                            bn = tgt_bones[c]
                            Mp = Mc.get(bn.parent.name) or M[bn.parent.name]
                            w = WANT[c].to_4x4()
                            w.translation = (Mp @ bn.parent.matrix_local.inverted() @ bn.matrix_local).translation
                            Mc[c] = w
                        return Mc, Mc[ch[-1]] @ Vector((0, tgt_bones[ch[-1]].length, 0))
                    for it in range(6):
                        for k_ in (2, 1, 0):
                            Mc, tip = fk()
                            j_ = Mc[ch[k_]].translation
                            v1, v2 = tip - j_, tgt - j_
                            if v1.length < 1e-6 or v2.length < 1e-6:
                                continue
                            q = v1.rotation_difference(v2)
                            if q.angle > math.radians(12):
                                q = Quaternion(q.axis, math.radians(12))
                            R = q.to_matrix()
                            for c in ch[k_:]:
                                WANT[c] = R @ WANT[c]
                    tip_err[f'{g_}_{s_}'] = max(tip_err.get(f'{g_}_{s_}', 0), (fk()[1] - tgt).length * FIT)
            M = build(WANT, pel)
        hand_M[fi] = M['hand_r'].copy()
        if 'lowerarm_r' in WANT:
            short['forearm_scale_r'] = max(short.get('forearm_scale_r', 0), abs(WANT['lowerarm_r'].to_scale()[0] - 1.0))
        for b in order:
            pb = rig.pose.bones[b.name]
            rest = b.matrix_local
            base = M[b.parent.name] @ b.parent.matrix_local.inverted() @ rest if b.parent else rest.copy()
            pb.matrix_basis = base.inverted() @ M[b.name]
            pb.keyframe_insert('rotation_quaternion', frame=fi)
            pb.keyframe_insert('scale', frame=fi)
            if b.name == 'pelvis':
                pb.keyframe_insert('location', frame=fi)
    print('reach: furthest a wrist fell short of theirs (m)', {k: round(v, 3) for k, v in short.items()})
    print('fingertips: furthest from theirs (mm)', {k: round(1000 * v, 1) for k, v in tip_err.items()})
    if GRIP == 'tripod' and pitch_:
        pv = list(pitch_.values())
        print('grip: wrist bent (deg) min', round(min(p[0] for p in pv), 1), 'max', round(max(p[0] for p in pv), 1), '| wrist lowered (mm) min', round(1000 * min(p[1] for p in pv), 1), 'max', round(1000 * max(p[1] for p in pv), 1), '| pencil slant (deg)', round(min(p[2] for p in pv), 1), '..', round(max(p[2] for p in pv), 1))
    rig.animation_data.action.name = src_name
    for fdbg in (0, NF // 2):
        scn.frame_set(fdbg)
        pp = rig.pose.bones['pelvis']
        print('DBG frame', fdbg, 'pelvis loc', tuple(round(x, 3) for x in pp.location), 'rot', tuple(round(x, 3) for x in pp.rotation_quaternion), 'world', tuple(round(x, 3) for x in (rig.matrix_world @ pp.head)), 'action', rig.animation_data.action and rig.animation_data.action.name, 'slot', getattr(rig.animation_data, 'action_slot', None))
    scn.frame_start, scn.frame_end = 0, NF - 1
    print('retargeted', NF, 'frames')
    # the pen in the right hand: ours (a pencil, or the red pen), held where theirs is held. Their pencil turns
    # with their thumb's middle bone; ours with his, so its ends, in that bone's frame, are theirs taken through
    # the turn that points his rest bone along theirs, scaled by how much smaller or bigger his hand is
    if PEN and pen_idx:
        import numpy as np
        tname, sname = 'hand_r', 'mixamorig:RightHandThumb2'
        span = lambda arm, mw, a_, b_: ((mw @ arm.data.bones[b_].head_local) - (mw @ arm.data.bones[a_].head_local)).length
        k = HAND_S * span(rig, RW, 'hand_r', 'middle_01_r') / span(src, src.matrix_world, 'mixamorig:RightHand', 'mixamorig:RightHandMiddle1')
        P_, tipT, backT, L_, Fm = penT
        scn.frame_set(F0 + Fm)
        print('their pencil held: length', round(float(L_), 3), 'tip', tuple(round(x, 3) for x in tipT), 'back', tuple(round(x, 3) for x in backT))
        # the pen's shape: their pencil's outline, measured (the median distance from its axis in 28 slices,
        # from the sharp end to the cap), turned into our own round pen of the same length and girth
        tipA, backA = np.array(tuple(tipT)), np.array(tuple(backT))
        axu = (backA - tipA) / np.linalg.norm(backA - tipA)
        tt = (P_ - tipA) @ axu
        rr = np.linalg.norm((P_ - tipA) - np.outer(tt, axu), axis=1)
        L_pen = float(np.linalg.norm(backA - tipA))
        NS = 28
        prof = []
        for i in range(NS + 1):
            lo_, hi_ = L_pen * (i - 0.5) / NS, L_pen * (i + 0.5) / NS
            sel = rr[(tt >= lo_) & (tt < hi_)]
            prof.append((L_pen * i / NS, float(np.percentile(sel, 90)) if len(sel) else None))
        known = [(t, r) for t, r in prof if r is not None]
        prof = [(t, r if r is not None else min(known, key=lambda q: abs(q[0] - t))[1]) for t, r in prof]
        prof[0] = (0.0, min(prof[0][1], 0.0006))
        print('their pen outline (mm):', [round(r * 1000, 1) for _, r in prof])
        bm_ = bmesh.new()
        SEG = 16
        rings = []
        for t, r in prof:
            rings.append([bm_.verts.new((math.cos(2 * math.pi * j / SEG) * max(r, 0.0003), math.sin(2 * math.pi * j / SEG) * max(r, 0.0003), t)) for j in range(SEG)])
        for a_, b2 in zip(rings, rings[1:]):
            for j in range(SEG):
                bm_.faces.new((a_[j], a_[(j + 1) % SEG], b2[(j + 1) % SEG], b2[j]))
        bm_.faces.new(rings[0][::-1]); bm_.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
        rgba = (0.62, 0.07, 0.04, 1) if PEN == 'redpen' else (0.85, 0.85, 0.85, 1)
        L0 = L_pen
        me_ = bpy.data.meshes.new(PEN); bm_.to_mesh(me_); bm_.free()
        for poly in me_.polygons:
            poly.use_smooth = True
        mt = bpy.data.materials.new(PEN); mt.use_nodes = True
        mt.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = rgba
        me_.materials.append(mt)
        pen = bpy.data.objects.new(PEN, me_); bpy.context.collection.objects.link(pen)
        pb = rig.pose.bones[tname]
        head = rig.matrix_world @ pb.head            # (his thumb, at the same frame: the clip's frame Fm is theirs)
        tipW, backW = tipT.copy(), backT.copy()      # (exactly where theirs is: his hand is where theirs is)
        if GRIP == 'tripod':
            # his own: in his grip, at the clip's middle frame (the rig at that frame of his own clip)
            scn.frame_set(Fm)
            bpy.context.view_layer.update()
            Mh = hand_M[Fm]
            tipW = RW @ (Mh.translation + Mh.to_3x3() @ grip_off)
            backW = tipW + (RW.to_3x3() @ (Mh.to_3x3() @ grip_ax)).normalized() * (backT - tipT).length
            print('PENCHECK grip: bone vs kept', round(1000 * ((RW @ rig.pose.bones['hand_r'].matrix).translation - RW @ Mh.translation).length, 2), 'mm; point off theirs', round(1000 * (tipW - tipT).length, 1), 'mm')
        axis = backW - tipW
        sc = axis.length / L0
        pen.parent = rig; pen.parent_type = 'BONE'; pen.parent_bone = tname
        bpy.context.view_layer.update()
        pen.matrix_world = Matrix.Translation(tipW) @ Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4() @ Matrix.Diagonal((sc, sc, sc, 1))
        bpy.context.view_layer.update()
        print('pen', PEN, 'hand scale', round(k, 3), 'length', round(axis.length, 3), 'tip at frame', Fm, tuple(round(x, 3) for x in tipW))
        def pen_ends(tag):
            scn.frame_set(Fm if GRIP == 'tripod' else F0 + Fm)
            dg_ = bpy.context.evaluated_depsgraph_get()
            e_ = pen.evaluated_get(dg_); m_ = e_.to_mesh()
            zs = [(pen.matrix_world @ v.co) for v in m_.vertices]
            e_.to_mesh_clear()
            lo_ = min(zs, key=lambda q: (q - tipW).length)
            print('PENCHECK', tag, 'nearest vertex to their tip', round(1000 * (lo_ - tipW).length, 1), 'mm; pen origin', tuple(round(x, 4) for x in pen.matrix_world.translation), 'their tip', tuple(round(x, 4) for x in tipW))
        pen_ends('placed')
    # their rig and their person go; his, skinned, is the export
    if geo is not None:
        bpy.data.objects.remove(geo, do_unlink=True)
    bpy.data.objects.remove(src, do_unlink=True)
    for m in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(m)
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys]:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    PREVIEW = arg('--preview', None)
    if PREVIEW:
        scn.render.engine = 'BLENDER_WORKBENCH'
        scn.render.resolution_x, scn.render.resolution_y = 640, 480
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam)
        cam.data.lens = 35; scn.camera = cam
        for f in (0, NF // 4, NF // 2, 3 * NF // 4):
            scn.frame_set(f)
            pel = rig.matrix_world @ rig.pose.bones['pelvis'].head
            cam.location = pel + Vector((1.6, -1.6, 0.6))
            cam.rotation_mode = 'QUATERNION'
            cam.rotation_quaternion = (pel + Vector((0, 0, 0.2)) - cam.location).to_track_quat('-Z', 'Y')
            scn.render.filepath = f'{PREVIEW}-{f}.png'
            bpy.ops.render.render(write_still=True)
        sys.exit(0)
    SUBD = arg('--subd', '1') != '0'
    # smooth skin and cloth (MakeHuman's meshes come with hard split normals: the two tones then broke along
    # every polygon and the inked hull, pushed out along those normals, cracked open into black slits)
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and not any(k in o.name.lower() for k in ('glasses', 'pencil', 'redpen'))]:
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        try:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except Exception:
            pass
        try:
            o.data.shade_smooth()
        except Exception:
            for poly in o.data.polygons:
                poly.use_smooth = True
        for m in [m for m in o.modifiers if m.type == 'EDGE_SPLIT']:
            o.modifiers.remove(m)
        # the skin and the clothes subdivided once before the bones move them: MakeHuman's forearm is a few
        # long facets, so the sharp edge between the two tones stepped along them
        if SUBD and (o.data.name.lower().find('casualsuit') >= 0 or o is body):
            sub = o.modifiers.new('subd', 'SUBSURF'); sub.levels = sub.render_levels = 1
            arm_i = next((i for i, m in enumerate(o.modifiers) if m.type == 'ARMATURE'), None)
            if arm_i is not None:
                o.modifiers.move(len(o.modifiers) - 1, arm_i)
    if PEN and pen_idx:
        pen_ends('before export')
    keep = rig.animation_data.action
    for a in [a for a in bpy.data.actions if a is not keep]:
        bpy.data.actions.remove(a)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_materials='EXPORT',
                              export_yup=True, export_skins=True, export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_morph=False)
    print('wrote', OUT, NF, 'frames')
    sys.exit(0)


# ---- sat, facing the desk ----------------------------------------------------------------------------------
bpy.context.view_layer.update()
rig.rotation_euler = (0, 0, math.pi + RY)        # (the rest pose faces -Y: turned to the site's -z, then by RY)
bpy.context.view_layer.update()
rig.location += TL(0, HIPS, 0) - rig.matrix_world @ rig.data.bones['pelvis'].head_local
bpy.context.view_layer.update()


def empty(name, at):
    e = bpy.data.objects.new(name, None)
    e.location = at
    bpy.context.collection.objects.link(e)
    return e


def ik(bone, target, pole, chain=2, pole_angle=-90):
    c = rig.pose.bones[bone].constraints.new('IK')
    c.target, c.pole_target, c.pole_angle, c.chain_count = target, pole, math.radians(pole_angle), chain
    return c


for side, fx, fz in (('l', -0.13, -0.44), ('r', 0.15, -0.48)):          # a foot under each knee
    ik(f'calf_{side}', empty(f'foot_{side}', TL(fx, 0.09, fz)), empty(f'knee_{side}', TL(fx * 1.2, 0.55, -1.05)))
if WHO == 'him':
    hand_l = empty('hand_l_at', T(-0.2, 0.775, -0.13) if LAYOUT != 'illoca' else TL(-0.2, DY + 0.02, -0.4))   # his left hand on the desk at his left
    elbow_r, elbow_l = (T(0.45, 0.75, 0.4), T(-0.7, 0.75, 0.3)) if LAYOUT != 'illoca' else (TL(0.45, 0.75, 0.15), TL(-0.7, 0.75, 0.05))
    BEND = (('spine_01', 6), ('spine_02', 8), ('spine_03', 8), ('neck_01', 10), ('head', 14))
else:
    hand_l = empty('hand_l_at', TL(-0.2, DY + 0.025, -0.38))             # her left hand on the desk before her
    elbow_r, elbow_l = TL(0.45, 0.75, 0.15), TL(-0.7, 0.75, 0.15)
    BEND = (('spine_01', 5), ('spine_02', 7), ('spine_03', 6), ('neck_01', 8), ('head', 12))
hand_r = empty('hand_r_at', TL(0.1, 0.8, -0.45))
ik('lowerarm_r', hand_r, empty('elbow_r', elbow_r), chain=3)
ik('lowerarm_l', hand_l, empty('elbow_l', elbow_l))
for b, deg in BEND:
    pb = rig.pose.bones[b]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = (math.radians(deg), 0, 0)
bpy.context.view_layer.update()

# ---- the pen in the right hand ---------------------------------------------------------------------------------
def mk_pen(name, rgba, cap):
    bm_ = bmesh.new()
    if cap:
        bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.0048, radius2=0.0048, depth=0.118, matrix=Matrix.Translation((0, 0, 0.012 + 0.059)))
        bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.0011, radius2=0.0048, depth=0.012, matrix=Matrix.Translation((0, 0, 0.006)))
        bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.0058, radius2=0.0058, depth=0.034, matrix=Matrix.Translation((0, 0, 0.012 + 0.118 - 0.012)))
    else:
        bmesh.ops.create_cone(bm_, cap_ends=True, segments=6, radius1=0.0042, radius2=0.0042, depth=0.15, matrix=Matrix.Translation((0, 0, 0.018 + 0.075)))
        bmesh.ops.create_cone(bm_, cap_ends=True, segments=6, radius1=0.0002, radius2=0.0042, depth=0.018, matrix=Matrix.Translation((0, 0, 0.009)))
    me = bpy.data.meshes.new(name); bm_.to_mesh(me); bm_.free()
    mt = bpy.data.materials.new(name); mt.use_nodes = True
    mt.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = rgba
    me.materials.append(mt)
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.rotation_mode = 'QUATERNION'
    return ob


pen = mk_pen('pencil', (0.012, 0.012, 0.014, 1), False) if WHO == 'him' else mk_pen('redpen', (0.62, 0.07, 0.04, 1), True)
lean = D(0.26, 0.84, 0.47).normalized()            # a pen as a hand holds it to write: back up toward the right
wrist_off = D(0.04, 0.075, 0.075)
grip = empty('grip', Vector())
hr = rig.pose.bones['hand_r']
c = hr.constraints.new('DAMPED_TRACK'); c.target = grip; c.track_axis = 'TRACK_Y'; c.influence = 0.8
look = empty('look', Vector())
c = rig.pose.bones['head'].constraints.new('DAMPED_TRACK'); c.target = look; c.track_axis = 'TRACK_Y'; c.influence = 0.3
for fb, (dx, dz) in {'index_01_r': (14, 0), 'index_02_r': (24, 0), 'index_03_r': (16, 0), 'middle_01_r': (32, 0), 'middle_02_r': (52, 0), 'middle_03_r': (34, 0),
                     'ring_01_r': (52, 0), 'ring_02_r': (70, 0), 'ring_03_r': (46, 0), 'pinky_01_r': (58, 0), 'pinky_02_r': (72, 0), 'pinky_03_r': (46, 0),
                     'thumb_01_r': (8, -14), 'thumb_02_r': (16, 0), 'thumb_03_r': (12, 0)}.items():
    b = rig.pose.bones.get(fb)
    if b:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (math.radians(dx), 0, math.radians(dz))
grip_bones = lambda: (rig.pose.bones['index_01_r'].head + rig.pose.bones['thumb_02_r'].head) / 2
GD = 0.068
ez = lambda x: x * x * (3 - 2 * x)

# ---- the plan: per frame, the pen's point, whether it is on the paper, and what the head looks at ---------
plan = {}
if WHO == 'him':
    # the notebook (set.py): at (0.2, desk, -0.2), turned -0.06; the pencil resting near the right page's corner
    nb = lambda lx, lz: (0.2 + lx * math.cos(-0.06) + lz * math.sin(-0.06), -0.2 - lx * math.sin(-0.06) + lz * math.cos(-0.06))
    hx, hz = nb(0.145, 0.085)
    HOLD = T(hx, DY + 0.0105, hz)
    page = T(nb(0.075, 0.0)[0], DY + 0.01, nb(0.075, 0.0)[1])
    up = T(0.27, DY + 0.24, -0.2)                   # the screen standing on the page, its middle
    if LAYOUT == 'illoca':                          # the pencil on the tracing sheet before him; the screen rises at (-0.05, 0.074)
        HOLD, page, up = T(0.12, DY + 0.0075, 0.3), T(-0.02, DY + 0.01, 0.12), T(-0.05, DY + 0.2, 0.07)
    NEND = 120
    for f in range(NEND + 1):
        k = ez(min(1.0, max(0.0, (f - 40) / 40)))  # 0..40 at the page, 40..80 up to the screen, held
        plan[f] = (HOLD, lean, True, page.lerp(up, k))
else:
    # the printout (set.py): its middle at (0.66, desk, -0.3), turned 0.93, A4; the site's red marks are
    # drawn on a 1240 x 1754 picture of it (scene5.js): a loop round the cards, then "2 COLUMNS" under them
    PX0, PZ0, PR = 0.66, -0.3, 0.93
    PW_, PH_, CW, CH = 0.21, 0.297, 1240, 1754
    if LAYOUT == 'illoca':                          # the printout as their plan sheet ends: slid across to her, turned to face her
        PX0, PZ0, PR, PW_, PH_, CW, CH = -0.003, -0.6, math.pi, 0.52, 0.35, 1560, 1050

    def on_print(cx, cy, lift=0.0):
        lx, lz = (cx / CW - 0.5) * PW_, (cy / CH - 0.5) * PH_
        return T(PX0 + lx * math.cos(PR) + lz * math.sin(PR), DY + 0.0012 + lift, PZ0 - lx * math.sin(PR) + lz * math.cos(PR))

    LOOP = (780, 640, 300, 200) if LAYOUT == 'illoca' else (620, 1060, 330, 250)
    TEXT = (1040, 1500, 900) if LAYOUT == 'illoca' else (250, 1080, 1480)

    def loop_at(k):                                 # (as the site draws it)
        a = -2.2 + k * math.pi * 2.15
        return on_print(LOOP[0] + math.cos(a) * LOOP[2], LOOP[1] + math.sin(a) * LOOP[3])

    def text_at(k):                                 # writing: left to right along the line, the point up and down
        x = TEXT[0] + (TEXT[1] - TEXT[0]) * k
        ink = not (TEXT[0] + 80 <= x < TEXT[0] + 170)  # the gap between "2" and "COLUMNS"
        y = TEXT[2] - 40 + 40 * math.sin(k * math.pi * 2 * 9)
        return on_print(x, y, 0.0 if ink else 0.008), ink

    REST = on_print(CW * 0.93, CH * 0.94, 0.02)
    F_IDLE, F_TO, F_LOOP, F_HOP, F_TEXT, F_LIFT = 30, 50, 110, 118, 190, 210
    NEND = F_LIFT
    cards = on_print(LOOP[0], LOOP[1])
    for f in range(NEND + 1):
        if f <= F_IDLE:
            plan[f] = (REST, lean, False, cards)
        elif f <= F_TO:
            k = ez((f - F_IDLE) / (F_TO - F_IDLE))
            plan[f] = (REST.lerp(loop_at(0), k) + D(0, 0.02 * math.sin(math.pi * k), 0), lean, False, cards)
        elif f <= F_LOOP:
            plan[f] = (loop_at((f - F_TO) / (F_LOOP - F_TO)), lean, True, cards)
        elif f <= F_HOP:
            k = ez((f - F_LOOP) / (F_HOP - F_LOOP))
            plan[f] = (loop_at(1).lerp(text_at(0)[0], k) + D(0, 0.012 * math.sin(math.pi * k), 0), lean, False, cards)
        elif f <= F_TEXT:
            tip, ink = text_at((f - F_HOP) / (F_TEXT - F_HOP))
            plan[f] = (tip, lean, ink, cards)
        else:
            k = ez((f - F_TEXT) / (F_LIFT - F_TEXT))
            plan[f] = (text_at(1)[0].lerp(REST, k), lean, False, cards)

scn = bpy.context.scene
scn.frame_start, scn.frame_end, scn.render.fps = 0, NEND, 24
wrist, prev_want, worst = None, None, 0.0
for f in range(NEND + 1):
    tip, axis, pinned, at = plan[f]
    want = tip + axis * GD
    wrist = (want + wrist_off) if wrist is None else wrist + (want - prev_want)
    prev_want = want
    grip.location = want
    look.location = at
    for it in range(6):
        hand_r.location = wrist
        bpy.context.view_layer.update()
        err = want - rig.matrix_world @ grip_bones()
        if err.length < 0.003:
            break
        wrist = wrist + err
    worst = max(worst, err.length)
    for o in (hand_r, grip, look):
        o.keyframe_insert('location', frame=f)
print('hand: frames 0 ..', NEND, 'grip error at most', round(worst, 3), 'm')

from bpy_extras import anim_utils
opts = anim_utils.BakeOptions(only_selected=False, do_pose=True, do_object=True, do_visual_keying=True, do_constraint_clear=True,
                              do_parents_clear=False, do_clean=False, do_location=True, do_rotation=True, do_scale=False,
                              do_bbone=False, do_custom_props=False)
act = anim_utils.bake_action(rig, action=None, frames=range(0, NEND + 1), bake_options=opts)
act.name = 'hold' if WHO == 'him' else 'review'
Zax = Vector((0, 0, 1))
for f in range(NEND + 1):
    scn.frame_set(f)
    tip, axis, pinned, _ = plan[f]
    gw = rig.matrix_world @ grip_bones()
    # pinned (on the paper): the point exact, the pen through the grip; carried: where the grip takes it
    a = (gw - tip).normalized() if pinned else axis
    pen.location = tip if pinned else gw - axis * GD
    pen.rotation_quaternion = Zax.rotation_difference(a)
    pen.keyframe_insert('location', frame=f)
    pen.keyframe_insert('rotation_quaternion', frame=f)

if PREVIEW:
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light, scn.display.shading.color_type, scn.display.shading.show_shadows = 'STUDIO', 'MATERIAL', True
    scn.render.resolution_x, scn.render.resolution_y = 800, 600
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam)
    cam.data.lens = 35
    scn.camera = cam
    for f in (0, NEND // 2, NEND):
        scn.frame_set(f)
        for nm, off in (('front', (0, 1.25, -1.4)), ('side', (1.3, 1.2, -0.2))):
            cam.location = TL(*off)
            cam.rotation_mode = 'QUATERNION'
            cam.rotation_quaternion = (TL(0, 0.85, -0.3) - cam.location).to_track_quat('-Z', 'Y')
            scn.render.filepath = f'{PREVIEW}-{f}-{nm}.png'
            bpy.ops.render.render(write_still=True)
    print('preview written')
    sys.exit(0)

for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o, do_unlink=True)
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
