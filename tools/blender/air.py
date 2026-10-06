"""
The air of the room, rendered as light really does it (Cycles volumes and real particles):
- haze: the whole room filled with a thin, even medium, so the low sun draws its beams in it
  through the window, cut by the window's bars, the shelf, the plants;
- dust: motes floating through the air in front of the camera, catching the sun where it
  reaches them, each on its own small closed path (so the loop loops), soft where the lens
  isn't focused;
- steam: a plume off the tea, a wispy density rising through a narrow cone.
All in the scene's centimetres. `phase` (0..1) is the moment in the loop.
"""
import math, random
import bpy, bmesh
from mathutils import Vector, Matrix

TAU = math.tau


def B(v):
    return Vector((v[0], -v[2], v[1]))


def _volume_material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    # (the Principled Volume's absorption colour is black by default: smoke that eats light; air
    # and steam scatter it and absorb next to none)
    vol.inputs['Absorption Color'].default_value = (1, 1, 1, 1)
    return m, nt, vol


def _box(name, lo, hi, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = (Vector(lo) + Vector(hi)) / 2
    o.scale = Vector(hi) - Vector(lo)
    me.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)
    return o


def haze(room, density=0.00022, anisotropy=0.4):
    """the room's air: from wall to wall, floor to ceiling, a centimetre in from each"""
    m, nt, vol = _volume_material('haze')
    vol.inputs['Density'].default_value = density
    vol.inputs['Anisotropy'].default_value = anisotropy
    vol.inputs['Color'].default_value = (1, 1, 1, 1)
    lo = B((room['left'] + 1, room['floor'] + 1, room['front'] - 1))
    hi = B((room['right'] - 1, room['ceiling'] - 1, 1))
    return _box('haze', (min(lo.x, hi.x), min(lo.y, hi.y), min(lo.z, hi.z)), (max(lo.x, hi.x), max(lo.y, hi.y), max(lo.z, hi.z)), m)


def mote_positions(cam, count, phase, seed=7, near=22, far=260, window_bias=0.55):
    """the motes, spread through the camera's view (evenly in volume: more far away), more of
    them toward the window's side of the frame, where the sun comes in and the wall behind is in
    shade (that is where dust shows: lit motes against a dark ground), each moved along its own
    closed path at this moment of the loop. Returns (positions N x 3, radii N, seeds N x 4)."""
    import numpy as np
    rng = np.random.default_rng(seed)
    cd = cam.data
    th = math.tan(cd.angle_y / 2)
    sc = bpy.context.scene.render
    aspect = sc.resolution_x / sc.resolution_y
    u = rng.random(count)
    d = (near ** 3 + u * (far ** 3 - near ** 3)) ** (1 / 3)
    sx = rng.random(count) * 2 - 1
    # a share of the motes drawn toward the left (the window's side): x in -1..0.2
    lean = rng.random(count) < window_bias
    sx = np.where(lean, -1 + rng.random(count) * 1.2, sx)
    sy = rng.random(count) * 2 - 1
    local = np.stack([sx * th * aspect * d * 1.1, sy * th * d * 1.1, -d], 1)
    mw = np.array(cam.matrix_world)
    world = local @ mw[:3, :3].T + mw[:3, 3]
    s = rng.random((count, 4))
    T = TAU
    off = np.stack([
        1.6 * np.sin(T * (phase + s[:, 0])) + 0.7 * np.sin(T * (2 * phase + s[:, 1])),
        1.4 * np.sin(T * (phase + s[:, 1] + 0.3)) + 0.6 * np.sin(T * (2 * phase + s[:, 0] + 0.6)),
        1.2 * np.sin(T * (phase + s[:, 2])) + 0.5 * np.sin(T * (3 * phase + s[:, 3])),
    ], 1)
    r = 0.022 + 0.085 * rng.random(count) ** 4                 # most tiny, a few flakes
    return world + off, r, s


_ICO = None
def _ico():
    """a unit icosphere's vertices and faces (the motes' shape), made once"""
    global _ICO
    if _ICO is None:
        import numpy as np
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        v = np.array([x.co[:] for x in bm.verts], np.float32)
        f = np.array([[l.vert.index for l in face.loops] for face in bm.faces], np.int32)
        bm.free()
        _ICO = (v, f)
    return _ICO


def dust_coords(cam, count, phase, seed=7):
    """every mote's vertices at this moment: a flattened sphere (a flake), turned its own way"""
    import numpy as np
    pos, r, s = mote_positions(cam, count, phase, seed)
    v, _ = _ico()
    # each mote's turn: a rotation from its seeds (fixed; a flake doesn't need to tumble to glint,
    # the light moving over it does that)
    a = s[:, 3] * TAU
    ax = s[:, :3] - 0.5
    ax /= np.linalg.norm(ax, axis=1, keepdims=True) + 1e-9
    c, sn = np.cos(a), np.sin(a)
    x, y, z = ax[:, 0], ax[:, 1], ax[:, 2]
    R = np.stack([
        np.stack([c + x * x * (1 - c), x * y * (1 - c) - z * sn, x * z * (1 - c) + y * sn], 1),
        np.stack([y * x * (1 - c) + z * sn, c + y * y * (1 - c), y * z * (1 - c) - x * sn], 1),
        np.stack([z * x * (1 - c) - y * sn, z * y * (1 - c) + x * sn, c + z * z * (1 - c)], 1),
    ], 1)                                                       # N x 3 x 3
    flat = v * np.array([1, 1, 0.35], np.float32)
    pts = np.einsum('nij,vj->nvi', R, flat) * r[:, None, None] + pos[:, None, :]
    return pts.reshape(-1, 3).astype(np.float32)


def dust(cam, count=9000, phase=0.0, seed=7):
    """the motes as one mesh (built with numpy: fast enough to rebuild every frame of the loop)"""
    import numpy as np
    v, f = _ico()
    co = dust_coords(cam, count, phase, seed)
    nv = len(v)
    faces = (f[None, :, :] + (np.arange(count) * nv)[:, None, None]).reshape(-1, 3)
    me = bpy.data.meshes.new('dust')
    me.vertices.add(len(co))
    me.vertices.foreach_set('co', co.ravel())
    me.loops.add(faces.size)
    me.loops.foreach_set('vertex_index', faces.ravel())
    me.polygons.add(len(faces))
    me.polygons.foreach_set('loop_start', np.arange(0, faces.size, 3, dtype=np.int32))
    me.update()
    o = bpy.data.objects.new('dust', me)
    m = bpy.data.materials.new('mote')
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (0.9, 0.87, 0.8, 1)
    p.inputs['Roughness'].default_value = 0.45
    if 'Subsurface Weight' in p.inputs:
        p.inputs['Subsurface Weight'].default_value = 0.3
    me.materials.append(m)
    o.visible_shadow = False                                  # a mote's shadow is nothing
    o['count'], o['seed'] = count, seed
    bpy.context.scene.collection.objects.link(o)
    return o


def move_dust(o, cam, phase):
    """the same motes at another moment of the loop"""
    o.data.vertices.foreach_set('co', dust_coords(cam, o['count'], phase, o['seed']).ravel())
    o.data.update()

def steam(mug, phase=0.0, gain=1.0):
    """a plume off the tea: density = a narrow cone leaning away from the window x wisps (thin
    ridges of a 4D noise rising through it; the 4th dimension turns once round the loop)"""
    m, nt, vol = _volume_material('steam')
    vol.inputs['Color'].default_value = (1, 1, 1, 1)
    vol.inputs['Anisotropy'].default_value = 0.3
    L = nt.links.new
    def node(kind, **kw):
        n = nt.nodes.new(kind)
        for k, v in kw.items():
            if not k.startswith('in_'):
                setattr(n, k, v)
        for k, v in kw.items():
            if k.startswith('in_'):
                name = k[3:].replace('_', ' ')
                s = next((s for s in n.inputs if s.name == name and s.enabled), n.inputs[name])
                s.default_value = v
        return n
    def math_(op, a=None, b=None, **kw):
        n = node('ShaderNodeMath', operation=op, **kw)
        if a is not None:
            (L(a, n.inputs[0]) if not isinstance(a, (int, float)) else setattr(n.inputs[0], 'default_value', a))
        if b is not None:
            (L(b, n.inputs[1]) if not isinstance(b, (int, float)) else setattr(n.inputs[1], 'default_value', b))
        return n.outputs[0]
    tc = node('ShaderNodeTexCoord').outputs['Object']        # the box's own: origin at the tea
    sep = node('ShaderNodeSeparateXYZ'); L(tc, sep.inputs[0])
    x, y, h = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    def mad(a, b, c):
        n = node('ShaderNodeMath', operation='MULTIPLY_ADD')
        for i, v in enumerate((a, b, c)):
            (L(v, n.inputs[i]) if not isinstance(v, (int, float)) else setattr(n.inputs[i], 'default_value', v))
        return n.outputs[0]
    # the plume's axis, leaning away from the window (+x) and swaying with the draught
    sway = 0.08 * math.sin(TAU * phase)
    ax = mad(h, 0.05 + sway, math_('MULTIPLY', math_('MULTIPLY', h, h), 0.002))
    dx = math_('SUBTRACT', x, ax)
    dy = math_('SUBTRACT', y, math_('MULTIPLY', h, 0.03 * math.sin(TAU * (2 * phase + 0.2))))
    r = math_('SQRT', math_('ADD', math_('MULTIPLY', dx, dx), math_('MULTIPLY', dy, dy)))
    rr = math_('DIVIDE', r, mad(h, 0.14, 1.8))               # 0 on the axis, 1 at the plume's edge
    cone = node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', in_From_Min=1.0, in_From_Max=0.2, in_To_Min=0, in_To_Max=1)
    L(rr, cone.inputs['Value'])
    rise = node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', in_From_Min=0.0, in_From_Max=2.0, in_To_Min=0, in_To_Max=1)
    L(h, rise.inputs['Value'])
    fade = math_('EXPONENT', math_('MULTIPLY', h, -1 / 6))
    env = math_('MULTIPLY', math_('MULTIPLY', cone.outputs['Result'], rise.outputs['Result']), fade)    # the wisps: the coordinates scaled (finer across than up), moved up as the loop runs
    mp = node('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.42, 0.42, 0.2)
    mp.inputs['Location'].default_value = (0, 0, -6.0 * phase)
    L(tc, mp.inputs['Vector'])
    nz = node('ShaderNodeTexNoise', noise_dimensions='4D', in_Scale=2.2, in_Detail=6.0, in_Roughness=0.55, in_Distortion=0.8)
    nz.inputs['W'].default_value = 2.0 * math.cos(TAU * phase)
    L(mp.outputs[0], nz.inputs['Vector'])
    ridge = math_('SUBTRACT', 1.0, math_('ABSOLUTE', mad(nz.outputs['Fac'], 2.0, -1.0)))
    wisp = math_('POWER', ridge, 7.0)
    dens = math_('MULTIPLY', math_('MULTIPLY', env, wisp), 0.9 * gain)
    L(dens, vol.inputs['Density'])
    # the box: the tea's surface at its origin
    c = B(mug)
    o = _box('steam', (0, 0, 0), (1, 1, 1), m)
    o.location = c
    o.scale = (1, 1, 1)
    # the unit cube from create_cube spans -0.5..0.5: rebuild it round the plume, from the tea up
    me = o.data
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((-7 + (v.co.x + 0.5) * 22, -7 + (v.co.y + 0.5) * 14, (v.co.z + 0.5) * 26))
    bm.to_mesh(me); bm.free()
    return o
