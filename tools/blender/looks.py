"""
What makes the desk read as a photograph, done in Blender after the glTF comes in:
- every material the browser could only paint flat gets its real surface: grain, weave,
  fibre, glaze, the veins and translucency of a leaf, as procedural node trees (nothing
  from outside: no image downloads, no scans);
- the leaves get a finer leaf (a midrib fold, a curl) in place of the browser's flat card;
- box-like things get rounded edges (nothing made is knife-sharp; the highlight along an
  edge is half of what makes an object look solid).
Units: one Blender unit = one centimetre (the glTF's).
"""
import math, random
import bpy, bmesh
from mathutils import Vector


# ---- node helpers -----------------------------------------------------------------------------
def nodes_of(m):
    nt = m.node_tree
    p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    return nt, p, out


def inp(n, name):
    """a node's input by name, the one in use (a Mix node has a float, a vector and a colour 'A')"""
    return next((s for s in n.inputs if s.name == name and s.enabled), n.inputs[name])


def outp(n, name):
    return next((s for s in n.outputs if s.name == name and s.enabled), n.outputs[name])


def new(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():                              # properties first: they decide the sockets
        if not k.startswith('in_'):
            setattr(n, k, v)
    for k, v in props.items():
        if k.startswith('in_'):
            inp(n, k[3:].replace('_', ' ')).default_value = v
    return n


def link(nt, a, b):
    nt.links.new(a, b)


def set_in(p, name, v):
    if name in p.inputs:
        p.inputs[name].default_value = v


def base_color_socket(nt, p):
    """what feeds the Base Color (a texture's output), or None when it is a plain colour"""
    ln = p.inputs['Base Color'].links
    return ln[0].from_socket if ln else None


def add_bump(nt, p, height, strength, distance):
    b = new(nt, 'ShaderNodeBump', in_Strength=strength, in_Distance=distance)
    link(nt, height, b.inputs['Height'])
    link(nt, b.outputs['Normal'], p.inputs['Normal'])
    return b


def coord(nt, kind='Object'):
    return new(nt, 'ShaderNodeTexCoord').outputs[kind]


# ---- the materials ----------------------------------------------------------------------------
def leaf(m, kind):
    """a leaf: its green varied leaf to leaf, a paler midrib and side veins pressed in, waxy (the
    ZZ) or satin (the pothos), and light coming through it"""
    nt, p, out = nodes_of(m)
    base = tuple(p.inputs['Base Color'].default_value)
    uv = new(nt, 'ShaderNodeUVMap').outputs['UV']
    sep = new(nt, 'ShaderNodeSeparateXYZ'); link(nt, uv, sep.inputs[0])
    u, v = sep.outputs['X'], sep.outputs['Y']
    # across the leaf, -1..1 from edge to edge; |that|
    vc = new(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD', in_Value=0)
    vc.inputs[1].default_value = 2; vc.inputs[2].default_value = -1
    link(nt, v, vc.inputs[0])
    av = new(nt, 'ShaderNodeMath', operation='ABSOLUTE'); link(nt, vc.outputs[0], av.inputs[0])
    # the midrib: a line down the middle
    mid = new(nt, 'ShaderNodeMapRange', in_From_Min=0.05, in_From_Max=0.0, in_To_Min=0, in_To_Max=1)
    link(nt, av.outputs[0], mid.inputs['Value'])
    # side veins: lines running out from the midrib toward the tip
    sv = new(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD')
    sv.inputs[1].default_value = -0.55 if kind == 'zz' else -0.8
    link(nt, av.outputs[0], sv.inputs[0]); link(nt, u, sv.inputs[2])
    wave = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); wave.inputs[1].default_value = 11 if kind == 'zz' else 8
    link(nt, sv.outputs[0], wave.inputs[0])
    frac = new(nt, 'ShaderNodeMath', operation='PINGPONG'); frac.inputs[1].default_value = 0.5
    link(nt, wave.outputs[0], frac.inputs[0])
    vein = new(nt, 'ShaderNodeMapRange', in_From_Min=0.06, in_From_Max=0.0, in_To_Min=0, in_To_Max=0.25 if kind == 'zz' else 0.7)
    link(nt, frac.outputs[0], vein.inputs['Value'])
    veins = new(nt, 'ShaderNodeMath', operation='MAXIMUM')
    link(nt, mid.outputs[0], veins.inputs[0]); link(nt, vein.outputs[0], veins.inputs[1])
    # colour: this leaf's own shade of the plant's green, paler along the veins, a touch
    # darker to the edge, and faint mottling
    obj = new(nt, 'ShaderNodeObjectInfo')
    hsv = new(nt, 'ShaderNodeHueSaturation', in_Color=base)
    shift = new(nt, 'ShaderNodeMapRange', in_To_Min=-0.025, in_To_Max=0.025)
    link(nt, obj.outputs['Random'], shift.inputs['Value'])
    hue = new(nt, 'ShaderNodeMath', operation='ADD'); hue.inputs[1].default_value = 0.5
    link(nt, shift.outputs[0], hue.inputs[0]); link(nt, hue.outputs[0], hsv.inputs['Hue'])
    val = new(nt, 'ShaderNodeMapRange', in_To_Min=0.8, in_To_Max=1.2)
    link(nt, obj.outputs['Random'], val.inputs['Value']); link(nt, val.outputs[0], hsv.inputs['Value'])
    pale = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MIX')
    inp(pale, 'B').default_value = (min(1, base[0] * 2.2 + 0.04), min(1, base[1] * 1.7 + 0.05), base[2] * 1.1, 1)
    link(nt, hsv.outputs[0], inp(pale, 'A')); link(nt, veins.outputs[0], pale.inputs['Factor'])
    edge = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    inp(edge, 'B').default_value = (0.7, 0.72, 0.7, 1)
    ed = new(nt, 'ShaderNodeMapRange', in_From_Min=0.75, in_From_Max=1.0, in_To_Min=0, in_To_Max=0.8)
    link(nt, av.outputs[0], ed.inputs['Value']); link(nt, ed.outputs[0], edge.inputs['Factor'])
    link(nt, outp(pale, 'Result'), inp(edge, 'A'))
    mott = new(nt, 'ShaderNodeTexNoise', in_Scale=6.0, in_Detail=4.0)
    link(nt, uv, mott.inputs['Vector'])
    mm = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='OVERLAY', in_Factor=0.12)
    link(nt, outp(edge, 'Result'), inp(mm, 'A')); link(nt, mott.outputs['Color'], inp(mm, 'B'))
    if kind != 'zz':
        # a golden pothos: pale yellow streaks running out along the leaf, each leaf its own
        mp = new(nt, 'ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (2.2, 9.0, 1.0)
        link(nt, uv, mp.inputs['Vector'])
        off = new(nt, 'ShaderNodeCombineXYZ')
        rs = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); rs.inputs[1].default_value = 37.0
        link(nt, obj.outputs['Random'], rs.inputs[0]); link(nt, rs.outputs[0], off.inputs['Z'])
        mp.vector_type = 'POINT'
        add_off = new(nt, 'ShaderNodeVectorMath', operation='ADD')
        link(nt, mp.outputs[0], add_off.inputs[0]); link(nt, off.outputs[0], add_off.inputs[1])
        st = new(nt, 'ShaderNodeTexNoise', noise_dimensions='3D', in_Scale=1.0, in_Detail=4.0, in_Distortion=0.6)
        link(nt, add_off.outputs[0], st.inputs['Vector'])
        sm = new(nt, 'ShaderNodeMapRange', in_From_Min=0.58, in_From_Max=0.72, in_To_Min=0, in_To_Max=0.75)
        link(nt, st.outputs['Fac'], sm.inputs['Value'])
        gold = new(nt, 'ShaderNodeMix', data_type='RGBA', in_B=(0.52, 0.55, 0.12, 1))
        link(nt, outp(mm, 'Result'), inp(gold, 'A')); link(nt, sm.outputs[0], gold.inputs['Factor'])
        mm = gold
    link(nt, outp(mm, 'Result'), p.inputs['Base Color'])
    set_in(p, 'Roughness', 0.22 if kind == 'zz' else 0.42)
    set_in(p, 'Coat Weight', 0.55 if kind == 'zz' else 0.15)
    set_in(p, 'Coat Roughness', 0.12)
    set_in(p, 'Specular IOR Level', 0.5)
    # the veins pressed in
    inv = new(nt, 'ShaderNodeMath', operation='SUBTRACT', in_Value=1.0)
    link(nt, veins.outputs[0], inv.inputs[1])
    add_bump(nt, p, inv.outputs[0], 0.12 if kind == 'zz' else 0.35, 0.02)   # a ZZ's veins barely show
    # light through the leaf: yellow-green, brighter where it is thin (between the veins)
    tr = new(nt, 'ShaderNodeBsdfTranslucent')
    tcol = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    inp(tcol, 'B').default_value = (1.7, 1.9, 0.55, 1)
    tcol.inputs['Factor'].default_value = 1
    link(nt, outp(mm, 'Result'), inp(tcol, 'A')); link(nt, outp(tcol, 'Result'), tr.inputs['Color'])
    mix = new(nt, 'ShaderNodeMixShader', in_Fac=0.22 if kind == 'zz' else 0.32)
    link(nt, p.outputs['BSDF'], mix.inputs[1]); link(nt, tr.outputs['BSDF'], mix.inputs[2])
    link(nt, mix.outputs['Shader'], out.inputs['Surface'])


def plaster(m, strength=0.06):
    nt, p, _ = nodes_of(m)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=0.9, in_Detail=12.0, in_Roughness=0.62)
    link(nt, coord(nt), n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], strength, 0.05)
    set_in(p, 'Roughness', 0.92)


def paper(m, strength=0.04):
    """paper: a fine fibre, matte, and a little light through it"""
    nt, p, _ = nodes_of(m)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=6.0, in_Detail=10.0, in_Roughness=0.7)
    link(nt, coord(nt), n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], strength, 0.01)
    set_in(p, 'Roughness', 0.88)
    set_in(p, 'Subsurface Weight', 0.05)


def ceramic(m):
    """a glazed pot: satin glaze with a faint orange-peel ripple and a few iron specks"""
    nt, p, _ = nodes_of(m)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=0.8, in_Detail=3.0)
    link(nt, coord(nt), n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], 0.08, 0.05)
    base = tuple(p.inputs['Base Color'].default_value)
    sp = new(nt, 'ShaderNodeTexVoronoi', in_Scale=2.2, feature='F1')
    link(nt, coord(nt), sp.inputs['Vector'])
    dots = new(nt, 'ShaderNodeMapRange', in_From_Min=0.06, in_From_Max=0.03, in_To_Min=0, in_To_Max=0.7)
    link(nt, sp.outputs['Distance'], dots.inputs['Value'])
    mix = new(nt, 'ShaderNodeMix', data_type='RGBA', in_A=base, in_B=(0.25, 0.2, 0.16, 1))
    link(nt, dots.outputs[0], mix.inputs['Factor'])
    link(nt, outp(mix, 'Result'), p.inputs['Base Color'])
    set_in(p, 'Roughness', 0.32)
    set_in(p, 'Coat Weight', 0.35)
    set_in(p, 'Coat Roughness', 0.08)


def soil(m):
    nt, p, _ = nodes_of(m)
    vo = new(nt, 'ShaderNodeTexVoronoi', in_Scale=3.5)
    link(nt, coord(nt), vo.inputs['Vector'])
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=2.0, in_Detail=8.0)
    link(nt, coord(nt), n.inputs['Vector'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.035, 0.025, 0.018, 1)
    ramp.color_ramp.elements[1].color = (0.13, 0.095, 0.065, 1)
    link(nt, n.outputs['Fac'], ramp.inputs['Fac'])
    link(nt, ramp.outputs['Color'], p.inputs['Base Color'])
    add_bump(nt, p, vo.outputs['Distance'], 0.8, 0.15)
    set_in(p, 'Roughness', 0.95)


def basket(m):
    """rattan, woven: flat cane strands over and under, each strand its own tan, the weave
    standing out in relief"""
    nt, p, _ = nodes_of(m)
    uv = new(nt, 'ShaderNodeUVMap').outputs['UV']
    sep = new(nt, 'ShaderNodeSeparateXYZ'); link(nt, uv, sep.inputs[0])
    u = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); u.inputs[1].default_value = 64
    v = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); v.inputs[1].default_value = 22
    link(nt, sep.outputs['X'], u.inputs[0]); link(nt, sep.outputs['Y'], v.inputs[0])
    fu = new(nt, 'ShaderNodeMath', operation='FRACT'); link(nt, u.outputs[0], fu.inputs[0])
    fv = new(nt, 'ShaderNodeMath', operation='FRACT'); link(nt, v.outputs[0], fv.inputs[0])
    iu = new(nt, 'ShaderNodeMath', operation='FLOOR'); link(nt, u.outputs[0], iu.inputs[0])
    iv = new(nt, 'ShaderNodeMath', operation='FLOOR'); link(nt, v.outputs[0], iv.inputs[0])
    par = new(nt, 'ShaderNodeMath', operation='ADD'); link(nt, iu.outputs[0], par.inputs[0]); link(nt, iv.outputs[0], par.inputs[1])
    odd = new(nt, 'ShaderNodeMath', operation='MODULO'); odd.inputs[1].default_value = 2
    link(nt, par.outputs[0], odd.inputs[0])
    # a strand's cross-section: round across it, highest in the middle of its span
    su = new(nt, 'ShaderNodeMath', operation='SINE')
    mu = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); mu.inputs[1].default_value = math.pi
    link(nt, fu.outputs[0], mu.inputs[0]); link(nt, mu.outputs[0], su.inputs[0])
    sv = new(nt, 'ShaderNodeMath', operation='SINE')
    mv = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); mv.inputs[1].default_value = math.pi
    link(nt, fv.outputs[0], mv.inputs[0]); link(nt, mv.outputs[0], sv.inputs[0])
    over = new(nt, 'ShaderNodeMix', data_type='FLOAT')
    link(nt, odd.outputs[0], over.inputs['Factor']); link(nt, su.outputs[0], inp(over, 'A')); link(nt, sv.outputs[0], inp(over, 'B'))
    h = new(nt, 'ShaderNodeMath', operation='POWER'); h.inputs[1].default_value = 0.6
    link(nt, outp(over, 'Result'), h.inputs[0])
    add_bump(nt, p, h.outputs[0], 1.0, 0.35)
    # colour: tan cane, each strand lighter or darker, fibres along it, darker in the gaps
    strand = new(nt, 'ShaderNodeTexWhiteNoise', noise_dimensions='2D')
    cell = new(nt, 'ShaderNodeCombineXYZ')
    link(nt, iu.outputs[0], cell.inputs['X']); link(nt, iv.outputs[0], cell.inputs['Y'])
    link(nt, cell.outputs[0], strand.inputs['Vector'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.33, 0.2, 0.09, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.43, 0.22, 1)
    link(nt, strand.outputs['Value'], ramp.inputs['Fac'])
    gap = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY', in_Factor=1.0)
    gv = new(nt, 'ShaderNodeMapRange', in_From_Min=0.0, in_From_Max=0.45, in_To_Min=0.35, in_To_Max=1.0)
    link(nt, h.outputs[0], gv.inputs['Value'])
    gcol = new(nt, 'ShaderNodeCombineColor')
    for ch in ('Red', 'Green', 'Blue'):
        link(nt, gv.outputs[0], gcol.inputs[ch])
    link(nt, ramp.outputs['Color'], inp(gap, 'A')); link(nt, gcol.outputs[0], inp(gap, 'B'))
    link(nt, outp(gap, 'Result'), p.inputs['Base Color'])
    set_in(p, 'Roughness', 0.62)
    set_in(p, 'Sheen Weight', 0.2)


def wood_grain(nt, p, dark, light, scale=0.35, bump=0.12, ring_axis='X'):
    """a wood's grain from the object's coordinates: long rings, bent by a slow noise"""
    tc = coord(nt)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=0.25, in_Detail=2.0)
    link(nt, tc, n.inputs['Vector'])
    warp = new(nt, 'ShaderNodeVectorMath', operation='MULTIPLY_ADD')
    warp.inputs[1].default_value = (1.6, 1.6, 1.6)
    link(nt, n.outputs['Color'], warp.inputs[0]); link(nt, tc, warp.inputs[2])
    wave = new(nt, 'ShaderNodeTexWave', wave_type='RINGS', rings_direction=ring_axis, in_Scale=scale, in_Distortion=3.0, in_Detail=3.0)
    link(nt, warp.outputs[0], wave.inputs['Vector'])
    fine = new(nt, 'ShaderNodeTexNoise', in_Scale=14.0, in_Detail=6.0)
    link(nt, tc, fine.inputs['Vector'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = dark; ramp.color_ramp.elements[1].color = light
    ramp.color_ramp.elements[0].position = 0.25
    link(nt, wave.outputs['Fac'], ramp.inputs['Fac'])
    ov = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='OVERLAY', in_Factor=0.15)
    link(nt, ramp.outputs['Color'], inp(ov, 'A')); link(nt, fine.outputs['Color'], inp(ov, 'B'))
    add_bump(nt, p, wave.outputs['Fac'], bump, 0.02)
    return outp(ov, 'Result')


def walnut(m):
    """oiled walnut: fine, quiet grain (streaks a millimetre or two apart, running along each
    piece's length, its local Z), low contrast; a satin finish. (The first try used big wave
    rings: the chair came out tiger-striped, the user's phone view showed it.)"""
    nt, p, _ = nodes_of(m)
    tc = coord(nt)
    mp = new(nt, 'ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (9.0, 9.0, 0.35)       # stretched along the length: streaks
    link(nt, tc, mp.inputs['Vector'])
    streak = new(nt, 'ShaderNodeTexNoise', in_Scale=1.0, in_Detail=6.0, in_Roughness=0.6, in_Distortion=0.3)
    link(nt, mp.outputs[0], streak.inputs['Vector'])
    broad = new(nt, 'ShaderNodeTexNoise', in_Scale=0.35, in_Detail=2.0)
    link(nt, tc, broad.inputs['Vector'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.055, 0.026, 0.012, 1)
    ramp.color_ramp.elements[1].color = (0.12, 0.062, 0.03, 1)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].position = 0.65
    link(nt, streak.outputs['Fac'], ramp.inputs['Fac'])
    tone = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY', in_Factor=0.35)
    link(nt, ramp.outputs['Color'], inp(tone, 'A')); link(nt, broad.outputs['Color'], inp(tone, 'B'))
    link(nt, outp(tone, 'Result'), p.inputs['Base Color'])
    add_bump(nt, p, streak.outputs['Fac'], 0.06, 0.01)
    set_in(p, 'Roughness', 0.42)
    set_in(p, 'Coat Weight', 0.35)
    set_in(p, 'Coat Roughness', 0.25)


def mug_glaze(m):
    """speckled stoneware: an oatmeal glaze with round iron specks of every size (not the
    browser texture's dashes), a darker band at the rim where the glaze thins, glossy"""
    nt, p, _ = nodes_of(m)
    for l in list(p.inputs['Base Color'].links):
        nt.links.remove(l)
    tc = coord(nt)
    base = (0.78, 0.72, 0.62, 1)
    specks = None
    # (cells 1.7, 0.8 and 0.4 cm across, specks up to 1.4, 0.9 and 0.4 mm: the size of iron specks,
    # big enough to read on the mug at the site's size; the first try's were a third of a millimetre)
    for scale, size, dark in ((0.6, 0.16, 0.95), (1.25, 0.2, 0.85), (2.5, 0.22, 0.6)):
        vo = new(nt, 'ShaderNodeTexVoronoi', in_Scale=scale, in_Randomness=1.0)
        link(nt, tc, vo.inputs['Vector'])
        # each cell's own speck size, from its random colour; most cells get none
        sep = new(nt, 'ShaderNodeSeparateColor'); link(nt, vo.outputs['Color'], sep.inputs[0])
        rad = new(nt, 'ShaderNodeMapRange', in_From_Min=0.4, in_From_Max=1.0, in_To_Min=0.0, in_To_Max=size)
        link(nt, sep.outputs['Red'], rad.inputs['Value'])
        dot = new(nt, 'ShaderNodeMath', operation='LESS_THAN')
        link(nt, vo.outputs['Distance'], dot.inputs[0]); link(nt, rad.outputs[0], dot.inputs[1])
        amt = new(nt, 'ShaderNodeMath', operation='MULTIPLY'); amt.inputs[1].default_value = dark
        link(nt, dot.outputs[0], amt.inputs[0])
        specks = amt.outputs[0] if specks is None else link_max(nt, specks, amt.outputs[0])
    col = new(nt, 'ShaderNodeMix', data_type='RGBA', in_A=base, in_B=(0.2, 0.13, 0.08, 1))
    link(nt, specks, col.inputs['Factor'])
    # the rim: the top centimetre, where the glaze runs thin over the clay (Blender's local Z up)
    sep = new(nt, 'ShaderNodeSeparateXYZ'); link(nt, tc, sep.inputs[0])
    rim = new(nt, 'ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', in_From_Min=9.2, in_From_Max=9.7, in_To_Min=0, in_To_Max=0.85)
    link(nt, sep.outputs['Z'], rim.inputs['Value'])
    band = new(nt, 'ShaderNodeMix', data_type='RGBA', in_B=(0.36, 0.24, 0.15, 1))
    link(nt, outp(col, 'Result'), inp(band, 'A')); link(nt, rim.outputs[0], band.inputs['Factor'])
    link(nt, outp(band, 'Result'), p.inputs['Base Color'])
    set_in(p, 'Roughness', 0.22)
    set_in(p, 'Coat Weight', 0.5)
    set_in(p, 'Coat Roughness', 0.05)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=1.5, in_Detail=3.0)
    link(nt, tc, n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], 0.04, 0.02)


def link_max(nt, a, b):
    mx = new(nt, 'ShaderNodeMath', operation='MAXIMUM')
    link(nt, a, mx.inputs[0]); link(nt, b, mx.inputs[1])
    return mx.outputs[0]


def washi_tape(m):
    """washi: thin fibrous paper tape, the wall's light coming through it"""
    nt, p, _ = nodes_of(m)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=12.0, in_Detail=10.0)
    link(nt, coord(nt), n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], 0.1, 0.005)
    set_in(p, 'Roughness', 0.75)
    set_in(p, 'Transmission Weight', 0.25)


def cable_rubber(m):
    nt, p, _ = nodes_of(m)
    set_in(p, 'Roughness', 0.5)
    set_in(p, 'Subsurface Weight', 0.15)
    set_in(p, 'Sheen Weight', 0.2)


def desk_wood(m):
    """the ash top: keeps its painted grain, gains the grain's feel and a satin lacquer that
    varies a little in sheen"""
    nt, p, _ = nodes_of(m)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=0.08, in_Detail=6.0)
    link(nt, coord(nt), n.inputs['Vector'])
    r = new(nt, 'ShaderNodeMapRange', in_To_Min=0.34, in_To_Max=0.5)
    link(nt, n.outputs['Fac'], r.inputs['Value']); link(nt, r.outputs[0], p.inputs['Roughness'])
    src = base_color_socket(nt, p)
    if src is not None:
        bw = new(nt, 'ShaderNodeRGBToBW'); link(nt, src, bw.inputs[0])
        add_bump(nt, p, bw.outputs[0], 0.12, 0.01)
    set_in(p, 'Coat Weight', 0.25)
    set_in(p, 'Coat Roughness', 0.18)


def oak_floor(m):
    """an oak plank floor, oiled: planks of their own tone, fine seams, grain along them"""
    nt, p, _ = nodes_of(m)
    tc = coord(nt)
    # planks run from the wall into the room (Blender's y); 18 cm wide, 140 long
    mp = new(nt, 'ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / 18, 1 / 140, 1)
    link(nt, tc, mp.inputs['Vector'])
    br = new(nt, 'ShaderNodeTexBrick', offset=0.37, in_Scale=1.0, in_Mortar_Size=0.006, in_Bias=0.0, in_Brick_Width=1.0, in_Row_Height=1.0)
    br.inputs['Color1'].default_value = (0.36, 0.24, 0.14, 1)
    br.inputs['Color2'].default_value = (0.5, 0.35, 0.21, 1)
    br.inputs['Mortar'].default_value = (0.1, 0.07, 0.05, 1)
    link(nt, mp.outputs[0], br.inputs['Vector'])
    grain = wood_grain(nt, p, (0.3, 0.19, 0.1, 1), (0.52, 0.36, 0.22, 1), scale=0.08, bump=0.05, ring_axis='Y')
    mix = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY', in_Factor=0.65)
    link(nt, br.outputs['Color'], inp(mix, 'A')); link(nt, grain, inp(mix, 'B'))
    bright = new(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='SCREEN', in_Factor=0.35)
    link(nt, outp(mix, 'Result'), inp(bright, 'A')); link(nt, br.outputs['Color'], inp(bright, 'B'))
    link(nt, outp(bright, 'Result'), p.inputs['Base Color'])
    seam = new(nt, 'ShaderNodeMath', operation='SUBTRACT', in_Value=1.0)
    link(nt, br.outputs['Fac'], seam.inputs[1])
    b = new(nt, 'ShaderNodeBump', in_Strength=0.6, in_Distance=0.05)
    link(nt, seam.outputs[0], b.inputs['Height'])
    # keep the grain's bump under the seams' (chain them)
    if p.inputs['Normal'].links:
        link(nt, p.inputs['Normal'].links[0].from_socket, b.inputs['Normal'])
    link(nt, b.outputs['Normal'], p.inputs['Normal'])
    set_in(p, 'Roughness', 0.42)
    set_in(p, 'Coat Weight', 0.2)


def fabric(m):
    """charcoal upholstery: a fine basket weave, soft sheen at grazing angles"""
    nt, p, _ = nodes_of(m)
    tc = coord(nt)
    w1 = new(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='X', in_Scale=9.0, in_Distortion=0.4)
    w2 = new(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Z', in_Scale=9.0, in_Distortion=0.4)
    link(nt, tc, w1.inputs['Vector']); link(nt, tc, w2.inputs['Vector'])
    mx = new(nt, 'ShaderNodeMath', operation='MULTIPLY')
    link(nt, w1.outputs['Fac'], mx.inputs[0]); link(nt, w2.outputs['Fac'], mx.inputs[1])
    add_bump(nt, p, mx.outputs[0], 0.5, 0.02)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=3.0, in_Detail=8.0)
    link(nt, tc, n.inputs['Vector'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.018, 0.02, 0.021, 1)
    ramp.color_ramp.elements[1].color = (0.05, 0.052, 0.055, 1)
    link(nt, n.outputs['Fac'], ramp.inputs['Fac'])
    link(nt, ramp.outputs['Color'], p.inputs['Base Color'])
    set_in(p, 'Roughness', 0.9)
    set_in(p, 'Sheen Weight', 0.6)
    set_in(p, 'Sheen Roughness', 0.4)


def cork(m):
    nt, p, _ = nodes_of(m)
    vo = new(nt, 'ShaderNodeTexVoronoi', in_Scale=4.0)
    link(nt, coord(nt), vo.inputs['Vector'])
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=3.0, in_Detail=6.0)
    link(nt, coord(nt), n.inputs['Vector'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.23, 0.12, 0.05, 1)
    ramp.color_ramp.elements[1].color = (0.5, 0.31, 0.16, 1)
    link(nt, n.outputs['Fac'], ramp.inputs['Fac'])
    link(nt, ramp.outputs['Color'], p.inputs['Base Color'])
    add_bump(nt, p, vo.outputs['Distance'], 0.5, 0.03)
    set_in(p, 'Roughness', 0.85)


def tea(m):
    nt, p, _ = nodes_of(m)
    set_in(p, 'Base Color', (0.06, 0.025, 0.008, 1))
    set_in(p, 'Roughness', 0.02)
    set_in(p, 'IOR', 1.34)
    set_in(p, 'Coat Weight', 0.0)


def glaze(m, rough=0.3):
    nt, p, _ = nodes_of(m)
    set_in(p, 'Roughness', rough)
    set_in(p, 'Coat Weight', 0.4)
    set_in(p, 'Coat Roughness', 0.06)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=1.0, in_Detail=3.0)
    link(nt, coord(nt), n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], 0.05, 0.03)


def book_cover(m):
    nt, p, _ = nodes_of(m)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=5.0, in_Detail=10.0)
    link(nt, coord(nt), n.inputs['Vector'])
    add_bump(nt, p, n.outputs['Fac'], 0.12, 0.01)
    set_in(p, 'Roughness', 0.62)


def pages(m):
    """a book's page block: the texture's lines pressed in, the paper's own fibre"""
    nt, p, _ = nodes_of(m)
    src = base_color_socket(nt, p)
    if src is not None:
        bw = new(nt, 'ShaderNodeRGBToBW'); link(nt, src, bw.inputs[0])
        add_bump(nt, p, bw.outputs[0], 0.4, 0.01)
    set_in(p, 'Roughness', 0.9)


def aluminium(m):
    """bead-blasted anodised aluminium (a current laptop's): a fine even satin, no brushing"""
    nt, p, _ = nodes_of(m)
    set_in(p, 'Base Color', (0.62, 0.63, 0.65, 1))
    set_in(p, 'Roughness', 0.33)
    set_in(p, 'Anisotropic', 0.0)
    n = new(nt, 'ShaderNodeTexNoise', in_Scale=90.0, in_Detail=2.0)
    link(nt, coord(nt), n.inputs['Vector'])
    r = new(nt, 'ShaderNodeMapRange', in_To_Min=0.3, in_To_Max=0.37)
    link(nt, n.outputs['Fac'], r.inputs['Value']); link(nt, r.outputs[0], p.inputs['Roughness'])
    add_bump(nt, p, n.outputs['Fac'], 0.012, 0.003)


def keycap(m):
    """a keycap's soft-touch black: matte, with the faint sheen of a much-used key"""
    nt, p, _ = nodes_of(m)
    set_in(p, 'Base Color', (0.012, 0.012, 0.013, 1))
    set_in(p, 'Roughness', 0.48)
    set_in(p, 'Sheen Weight', 0.15)


def wax(m):
    """paraffin: light goes into it and glows back out, warm, the way a lit candle's wax does"""
    nt, p, _ = nodes_of(m)
    set_in(p, 'Base Color', (0.86, 0.8, 0.68, 1))
    set_in(p, 'Roughness', 0.45)
    set_in(p, 'Subsurface Weight', 0.6)
    if 'Subsurface Radius' in p.inputs:
        p.inputs['Subsurface Radius'].default_value = (1.2, 0.6, 0.3)
    if 'Subsurface Scale' in p.inputs:
        p.inputs['Subsurface Scale'].default_value = 0.8


def amber(m):
    """the tumbler: smooth amber glass, deep orange where it is thick"""
    nt, p, _ = nodes_of(m)
    set_in(p, 'Base Color', (0.95, 0.52, 0.16, 1))
    set_in(p, 'Transmission Weight', 1.0)
    set_in(p, 'Roughness', 0.03)
    set_in(p, 'IOR', 1.5)


def flame(m):
    """a candle flame: faint blue at its root, a white-gold core, orange to its tip, very bright"""
    nt, p, out = nodes_of(m)
    keep = out.name                                  # (bpy hands back a new wrapper each time: compare names)
    for n in list(nt.nodes):
        if n.name != keep:
            nt.nodes.remove(n)
    out = nt.nodes[keep]
    tc = coord(nt)
    sep = new(nt, 'ShaderNodeSeparateXYZ'); link(nt, tc, sep.inputs[0])
    h = new(nt, 'ShaderNodeMapRange', in_From_Min=0.0, in_From_Max=2.2, in_To_Min=0, in_To_Max=1)
    link(nt, sep.outputs['Z'], h.inputs['Value'])
    ramp = new(nt, 'ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = 0.0, (0.35, 0.45, 1.0, 1)
    cr.elements[1].position, cr.elements[1].color = 1.0, (1.0, 0.32, 0.06, 1)
    e = cr.elements.new(0.14); e.color = (1.0, 0.93, 0.78, 1)
    e = cr.elements.new(0.55); e.color = (1.0, 0.72, 0.32, 1)
    link(nt, h.outputs[0], ramp.inputs['Fac'])
    em = new(nt, 'ShaderNodeEmission', in_Strength=45.0)
    em.name = 'flame_emission'
    link(nt, ramp.outputs['Color'], em.inputs['Color'])
    link(nt, em.outputs['Emission'], out.inputs['Surface'])


def bulb(m):
    """a fairy light's bulb: a warm point of light"""
    nt, p, out = nodes_of(m)
    em = new(nt, 'ShaderNodeEmission', in_Strength=28.0, in_Color=(1.0, 0.58, 0.24, 1))
    link(nt, em.outputs['Emission'], out.inputs['Surface'])


UPGRADES = {
    'wax': wax, 'amber': amber, 'flame': flame, 'bulb': bulb,
    'leaf_zz': lambda m: leaf(m, 'zz'), 'leaf_pothos': lambda m: leaf(m, 'pothos'), 'leaf_trail': lambda m: leaf(m, 'pothos'),
    'wall': plaster, 'windowframe': lambda m: plaster(m, 0.02), 'paper': paper, 'note': paper,
    'ceramic': ceramic, 'soil': soil, 'basket': basket, 'walnut': walnut, 'desktop': desk_wood, 'deskside': desk_wood,
    'floor': oak_floor, 'fabric': fabric, 'cork': cork, 'tea': tea, 'mug': mug_glaze, 'bookcover': book_cover, 'pages': pages,
    'washi': washi_tape, 'cable': cable_rubber, 'keycap': keycap,
    'aluminium': aluminium,
}


def upgrade_materials():
    done = {}
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        key = m.name.split('.')[0]
        fn = UPGRADES.get(key)
        if fn and nodes_of(m)[1] is not None:
            fn(m)
            done[key] = done.get(key, 0) + 1
    return done


# ---- a finer leaf -----------------------------------------------------------------------------
def leaf_mesh(kind, name):
    """a unit leaf in the browser leaf's own frame (tip along +x from the stalk at 0, its width
    across, its face toward -y in Blender's axes), with a midrib fold and a curl"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    nu, nv = 28, 10
    uvl = bm.loops.layers.uv.new('UVMap')
    grid = []
    for i in range(nu + 1):
        x = i / nu
        if kind == 'zz':
            w = math.sin(math.pi * x) ** 0.85 * 0.5 * (1 - 0.15 * x)
        else:
            w = (math.sin(math.pi * min(1, x * 1.12)) ** 0.7) * (1 - x * 0.35) * 0.58
        row = []
        for j in range(nv + 1):
            s = j / nv * 2 - 1                                    # -1..1 across
            y = s * w
            fold = -0.07 * abs(s) * w * 2                          # the halves lift a little off the midrib
            curl = -0.05 * x * x                                  # and the tip turns down
            ripple = 0.012 * math.sin(x * 23 + s * 3) * abs(s)     # a slight wave along the edge
            # the browser leaf: (x along, y across, z out of its face) -> Blender (x, -z, y)
            row.append(bm.verts.new((x, -(fold + curl + ripple), y)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (a / nu, b / nv)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    return me


def replace_leaves():
    """every leaf object gets the finer leaf of its kind, its material kept"""
    made = {}
    count = 0
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.data.materials:
            continue
        mat = o.data.materials[0]
        if not mat or not mat.name.startswith('leaf_'):
            continue
        kind = 'zz' if mat.name.startswith('leaf_zz') else 'heart'
        if mat.name not in made:
            me = leaf_mesh(kind, 'leaf-' + mat.name)
            me.materials.append(mat)
            made[mat.name] = me
        o.data = made[mat.name]
        count += 1
    return count


# ---- rounded edges ----------------------------------------------------------------------------
def round_edges(width=0.12, max_verts=400, max_size=120):
    """small solid things with hard corners (boxes: books, the shelf, frames, the desk's parts):
    their duplicate corner vertices merged, then a 3-segment bevel on edges sharper than 30°"""
    seen = set()
    n = 0
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.data in seen:
            continue
        me = o.data
        if len(me.vertices) > max_verts or max(o.dimensions) > max_size or min(o.dimensions) < 0.05:
            continue
        mname = me.materials[0].name if me.materials and me.materials[0] else ''
        if mname.startswith(('leaf', 'paper', 'note', 'stem')):
            continue
        seen.add(me)
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(me); bm.free()
        if hasattr(me, 'has_custom_normals') and me.has_custom_normals:
            me.normals_split_custom_set([(0, 0, 0)] * len(me.loops))
        for poly in me.polygons:
            poly.use_smooth = True
        for e in me.edges:
            e.use_edge_sharp = False
        mod = o.modifiers.new('round', 'BEVEL')
        mod.width = width
        mod.segments = 3
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(30)
        mod.harden_normals = True
        n += 1
    # objects sharing a mesh get the same modifier
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data in seen and 'round' not in o.modifiers:
            mod = o.modifiers.new('round', 'BEVEL')
            mod.width, mod.segments, mod.limit_method, mod.angle_limit, mod.harden_normals = width, 3, 'ANGLE', math.radians(30), True
    return n
