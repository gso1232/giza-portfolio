"""
The desk room built in Blender, once, for any render of it (a still, the loop, the dive):
the glTF from desk.html, its surfaces made real (looks.py), the low sun and the sky through the
window, a camera, the air (air.py), Cycles set up. Units: a Blender unit is a centimetre.

  S = build(glb=..., info=..., view='wide', w=1920, h=900, ...)
  S.pose(view_dict)          put the camera at a view (pos, fwd, up, vfov in the room's axes)
  S.sway(phase)              the plants at a moment of the loop, as desk.html's sway() has them
  S.render(path, border=None, samples=..., denoise=True, only=None, alpha=False)
"""
import json, math, os, sys, time
import bpy
from mathutils import Matrix, Vector, Quaternion, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import looks, air

TAU = math.tau
C4 = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))    # the room's axes -> Blender's


def B(v):
    return Vector((v[0], -v[2], v[1]))


def hash1(i):
    x = math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


class Scene:
    pass


def build(glb, info, view='wide', w=1920, h=900, sun=12.0, sky=0.3, sun_color=(1, 0.4, 0.13), haze=0.00012,
          dust=9000, steam=3.5, fstop=4.0, phase=0.0, device='CUDA', samples=256, cards=True):
    S = Scene()
    t0 = time.time()
    S.info = info = json.load(open(info)) if isinstance(info, str) else info
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S.scene = scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=glb)
    for o in list(bpy.data.objects):
        if o.name.startswith('frameGlass'):
            bpy.data.objects.remove(o, do_unlink=True)
    looks.replace_leaves(); looks.upgrade_materials(); looks.round_edges()

    # the sun, the sky, the window's portal
    sun_dir = B(info['sun']).normalized()
    sd = bpy.data.lights.new('sun', 'SUN')
    sd.energy, sd.angle, sd.color = sun, math.radians(0.53), tuple(sun_color)
    so = bpy.data.objects.new('sun', sd)
    so.matrix_world = sun_dir.to_track_quat('-Z', 'Y').to_matrix().to_4x4()
    scene.collection.objects.link(so)
    world = bpy.data.worlds.new('sky'); scene.world = world; world.use_nodes = True
    wn = world.node_tree
    bg = next(n for n in wn.nodes if n.type == 'BACKGROUND')
    sk = wn.nodes.new('ShaderNodeTexSky')
    for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'HOSEK_WILKIE'):
        try:
            sk.sky_type = t; break
        except TypeError:
            continue
    to_sun = -sun_dir
    try:
        sk.sun_disc = False
        sk.sun_elevation = math.asin(max(-1, min(1, to_sun.z)))
        sk.sun_rotation = math.atan2(to_sun.x, -to_sun.y)
    except AttributeError:
        pass
    wn.links.new(sk.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = sky
    win, left = info['room']['window'], info['room']['left']
    pd = bpy.data.lights.new('window', 'AREA')
    pd.shape, pd.size, pd.size_y = 'RECTANGLE', win['z1'] - win['z0'], win['y1'] - win['y0']
    if hasattr(pd, 'is_portal'): pd.is_portal = True
    if hasattr(pd, 'cycles') and hasattr(pd.cycles, 'is_portal'): pd.cycles.is_portal = True
    po = bpy.data.objects.new('window', pd)
    po.matrix_world = Matrix.Translation(B((left + 0.5, (win['y0'] + win['y1']) / 2, (win['z0'] + win['z1']) / 2))) @ Matrix(((0, -1, 0), (0, 0, 1), (-1, 0, 0))).transposed().to_4x4()
    scene.collection.objects.link(po)

    # the camera
    cd = bpy.data.cameras.new('cam')
    cd.sensor_fit = 'VERTICAL'; cd.clip_start, cd.clip_end = 1, 5000; cd.lens_unit = 'FOV'
    S.cam = cam = bpy.data.objects.new('cam', cd)
    scene.collection.objects.link(cam); scene.camera = cam
    scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 0.01
    S.fstop = fstop

    def pose(v):
        cd.angle_y = math.radians(v['vfov'])
        f = B(v['fwd']).normalized(); u = B(v['up']).normalized()
        x = f.cross(u).normalized(); y = x.cross(f).normalized()
        cam.matrix_world = Matrix.Translation(B(v['pos'])) @ Matrix((x, y, -f)).transposed().to_4x4()
        if fstop > 0:
            cd.dof.use_dof = True
            cd.dof.focus_distance = (B(info['focus']) - cam.matrix_world.translation).length
            cd.dof.aperture_fstop = fstop / 100          # (Cycles' aperture is in metres; a unit here is a cm)
            cd.dof.aperture_blades, cd.dof.aperture_rotation = 7, math.radians(12)
    S.pose = pose
    pose(info['views'][view])

    # Cycles
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = device
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == device
    scene.cycles.device = 'GPU'
    cy = scene.cycles
    cy.samples = samples
    cy.use_adaptive_sampling, cy.adaptive_threshold = True, 0.01
    cy.use_denoising = True
    cy.denoiser, cy.denoising_input_passes = 'OPENIMAGEDENOISE', 'RGB_ALBEDO_NORMAL'
    cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces, cy.transmission_bounces = 12, 6, 6, 12
    cy.sample_clamp_indirect, cy.blur_glossy, cy.volume_bounces = 10, 1.0, 1
    cy.use_auto_tile = False                    # (tiles go through a file in TEMP, and a full disk lost the 4K's posters)
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = w, h, 100
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.exr_codec = 'ZIP'

    # the air
    S.haze = air.haze(info['room'], haze) if haze > 0 else None
    S.steam_gain = steam
    S.steam = air.steam(info['mug'], phase, steam) if steam > 0 else None
    S.dust = air.dust(cam, dust, phase) if dust > 0 else None

    # the candle: its flame is seen (and seen through the glass, and in reflections) but lights
    # nothing itself and casts no shadow; a small warm point light just above the wick does the
    # lighting (a light is sampled cleanly, a tiny glowing mesh is not)
    S.flame = next((o for o in bpy.data.objects if o.name.split('.')[0] == 'flame' and o.type == 'MESH'), None)
    S.candle_light = None
    if S.flame:
        S.flame.visible_diffuse = False
        S.flame.visible_shadow = False
        S.flame_rest = (S.flame.matrix_world.copy(), S.flame.scale.copy(), S.flame.rotation_euler.copy())
        ld = bpy.data.lights.new('candle', 'POINT')
        ld.color = (1.0, 0.6, 0.28)
        ld.shadow_soft_size = 0.5
        S.candle_power = 0.0006                      # (watts in a scene of centimetres: a candle's glow)
        ld.energy = S.candle_power
        S.candle_light = bpy.data.objects.new('candle', ld)
        S.candle_light.location = S.flame.matrix_world @ Vector((0, 0, 0.9))
        scene.collection.objects.link(S.candle_light)

    def flicker(phase):
        """the flame at a moment of the loop: it breathes, leans and trembles, a whole number of
        times round the loop (so the loop loops), and its light with it"""
        if not S.flame:
            return
        s = lambda k, o: math.sin(TAU * (k * phase + o))
        tall = 1 + 0.08 * s(9, 0.1) + 0.05 * s(14, 0.37) + 0.03 * s(23, 0.71)
        wide = 1 - 0.04 * s(9, 0.1) + 0.03 * s(17, 0.52)
        _, sc0, rot0 = S.flame_rest
        S.flame.scale = (sc0.x * wide, sc0.y * wide, sc0.z * tall)
        S.flame.rotation_euler = (rot0.x + 0.05 * s(5, 0.2) + 0.02 * s(19, 0.8), rot0.y + 0.04 * s(7, 0.6), rot0.z)
        glow = 0.88 + 0.08 * s(9, 0.1) + 0.05 * s(14, 0.37) + 0.03 * s(23, 0.71)
        S.candle_light.data.energy = S.candle_power * glow
        m = S.flame.active_material
        em = m.node_tree.nodes.get('flame_emission') if m else None
        if em:
            em.inputs['Strength'].default_value = 45 * glow
    S.flicker = flicker

    # two framed prints on the wall, his choice (2026-10-02): the Yellow Crane Tower's front, drawn for his site, in
    # the shade on the left, and a picture of Cairo in the sun on the right. Thin black frames off the wall, glass
    # over them, each picture a card (poster_zleft, poster_zright) like the rest. (cm, Blender's axes: the wall is
    # y = 0, the desk's top z = 0; the camera sees the wall from x -150 to 88, up to z 74)
    def framed(key, cx, cz, pw, aspect, F=2.2, D=2.4):
        import bmesh
        ph = pw / aspect
        x0, x1, z0, z1 = cx - pw / 2, cx + pw / 2, cz - ph / 2, cz + ph / 2
        black = bpy.data.materials.get('frame_black') or bpy.data.materials.new('frame_black')
        black.use_nodes = True
        pb = next(n for n in black.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        pb.inputs['Base Color'].default_value = (0.018, 0.016, 0.015, 1); pb.inputs['Roughness'].default_value = 0.45
        def box(name, a0, a1, b0, b1, c0, c1):
            bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
            for v in bm.verts:
                v.co = Vector(((a0 + a1) / 2 + v.co.x * (a1 - a0), (b0 + b1) / 2 + v.co.y * (b1 - b0), (c0 + c1) / 2 + v.co.z * (c1 - c0)))
            me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(black)
            bpy.context.scene.collection.objects.link(bpy.data.objects.new(name, me))
        box(f'frame_{key}_l', x0 - F, x0, -D, 0, z0 - F, z1 + F); box(f'frame_{key}_r', x1, x1 + F, -D, 0, z0 - F, z1 + F)
        box(f'frame_{key}_b', x0, x1, -D, 0, z0 - F, z0); box(f'frame_{key}_t', x0, x1, -D, 0, z1, z1 + F)
        box(f'frame_{key}_back', x0, x1, -0.6, 0, z0, z1)
        me = bpy.data.meshes.new(f'poster_{key}')
        Y = -0.8
        me.from_pydata([(x0, Y, z0), (x1, Y, z0), (x1, Y, z1), (x0, Y, z1)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new()
        for li, (u, v) in zip(range(4), [(0, 1), (1, 1), (1, 0), (0, 0)]):     # (v from the top, as the glTF's are)
            uv.data[li].uv = (u, v)
        m = bpy.data.materials.new(f'poster_{key}'); m.use_nodes = True
        next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Roughness'].default_value = 0.75
        me.materials.append(m)
        bpy.context.scene.collection.objects.link(bpy.data.objects.new(f'poster_{key}', me))
        gl = bpy.data.materials.get('frame_glass') or bpy.data.materials.new('frame_glass')
        gl.use_nodes = True
        pg = next(n for n in gl.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        pg.inputs['Roughness'].default_value = 0.04; pg.inputs['Transmission Weight'].default_value = 1.0; pg.inputs['Alpha'].default_value = 0.12
        mg = bpy.data.meshes.new(f'glass_{key}'); Yg = -1.6
        mg.from_pydata([(x0, Yg, z0), (x1, Yg, z0), (x1, Yg, z1), (x0, Yg, z1)], [], [(0, 1, 2, 3)]); mg.materials.append(gl)
        bpy.context.scene.collection.objects.link(bpy.data.objects.new(f'glass_{key}', mg))
    if os.environ.get('DESK_FRAMES', '1') != '0':
        zl = [float(v) for v in os.environ.get('DESK_ZLEFT', '-50.5,58,13').split(',')]     # (centre x, centre z, picture width)
        framed('zleft', zl[0], zl[1], zl[2], 500 / 840)
        framed('zright', 71.0, 44.5, 21.0, 0.8)

    # the pictures the user will swap (poster_<key>): rendered as plain white paper, their pictures
    # put back afterwards by tools/blender/cards.py from render_cards()'s map of them
    S.posters = sorted((o for o in bpy.data.objects if o.name.startswith('poster_') and o.type == 'MESH'), key=lambda o: o.name)
    S.card_white = 0.85
    if cards:
        for o in S.posters:
            for m in o.data.materials:
                p = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.node_tree else None
                if p:
                    for l in list(p.inputs['Base Color'].links):
                        m.node_tree.links.remove(l)
                    p.inputs['Base Color'].default_value = (S.card_white,) * 3 + (1,)

    def render_cards(path, border=None):
        """where each picture lies in the frame: R, G its own u, v; B its number / 16 (1..: S.posters
        in order); A how much of the pixel it covers. Everything else holds out; no denoising."""
        saved = []
        for i, o in enumerate(S.posters, 1):
            m = bpy.data.materials.new(f'card{i}')
            m.use_nodes = True
            nt = m.node_tree
            for n in list(nt.nodes):
                nt.nodes.remove(n)
            uv = nt.nodes.new('ShaderNodeUVMap')
            sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs['UV'], sep.inputs[0])
            comb = nt.nodes.new('ShaderNodeCombineColor')
            nt.links.new(sep.outputs['X'], comb.inputs['Red']); nt.links.new(sep.outputs['Y'], comb.inputs['Green'])
            comb.inputs['Blue'].default_value = i / 16
            em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(comb.outputs[0], em.inputs['Color'])
            out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], out.inputs['Surface'])
            saved.append((o, list(o.data.materials)))
            for k in range(len(o.data.materials)):
                o.data.materials[k] = m
        vt = scene.view_settings.view_transform
        scene.view_settings.view_transform = 'Standard'
        fs = scene.render.filter_size
        scene.render.filter_size = 1.0
        render(path, border=border, samples=16, denoise=False, only=None, alpha=True,
               hide=[x for x in (S.haze, S.steam, S.dust) if x], hold=[x for x in scene.objects if x.type == 'MESH' and x not in S.posters])
        scene.view_settings.view_transform = vt
        scene.render.filter_size = fs
        for o, mats in saved:
            for k, m in enumerate(mats):
                o.data.materials[k] = m
    S.render_cards = lambda path, border=None: render_cards(path, border)

    # the plants, for sway(): pl_<key>_<lean>_<flutter> and its leaves lf_<key>_<i>[_r]
    import re
    S.plants = []
    for o in bpy.data.objects:
        mp = re.match(r'^pl_([a-z0-9]+)_([0-9.]+)_([0-9.]+)', o.name)      # (the lean has a decimal point)
        if mp:
            key, lean, flutter = mp.group(1), mp.group(2), mp.group(3)
            leaves = []
            for c in o.children_recursive:
                ml = re.match(r'^lf_([a-z0-9]+)_(\d+)(_r)?', c.name)
                if ml:
                    c.rotation_mode = 'QUATERNION'
                    leaves.append((c, int(ml.group(2)), bool(ml.group(3)), c.rotation_quaternion.copy()))
            S.plants.append((o, key, float(lean), float(flutter), o.matrix_world.copy(), leaves))

    def sway(phase):
        for o, key, lean, flutter, rest, leaves in S.plants:
            px = rest.translation.x                               # the room's x (Blender's x is the same)
            xn = (px + 100) / 200
            gust = 0.6 + 0.4 * math.sin(TAU * (phase - xn * 0.5))
            rz = -lean * gust * math.sin(TAU * (2 * phase - xn))
            rx = lean * 0.5 * gust * math.sin(TAU * (3 * phase + 0.25))
            # desk.html turns the plant about its own origin in the room's axes (Euler XYZ, y = 0)
            turn = C4 @ (Euler((rx, 0, rz), 'XYZ').to_matrix().to_4x4()) @ C4.inverted()
            o.matrix_world = Matrix.Translation(rest.translation) @ turn @ Matrix.Translation(-rest.translation) @ rest
            deg = math.radians(flutter)
            for c, i, resting, q0 in leaves:
                if resting:
                    continue
                a, b = hash1(i + xn * 97), hash1(i * 3.1 + xn * 57)
                k = 3 + math.floor(hash1(i * 7.7 + xn) * 3)
                pitch = deg * gust * (0.7 * math.sin(TAU * (k * phase + a)) + 0.3 * math.sin(TAU * ((k + 2) * phase + b)))
                roll = deg * 1.3 * gust * math.sin(TAU * ((k + 1) * phase + b))
                # (the leaf's own width axis, the browser's y, is Blender's local z; its midrib x stays x)
                c.rotation_quaternion = q0 @ Quaternion((0, 0, 1), pitch) @ Quaternion((1, 0, 0), roll)
    S.sway = sway

    def set_steam(phase):
        if S.steam is not None:
            m = S.steam.active_material
            bpy.data.objects.remove(S.steam, do_unlink=True)
            if m: bpy.data.materials.remove(m)
        S.steam = air.steam(info['mug'], phase, S.steam_gain) if S.steam_gain > 0 else None
    S.set_steam = set_steam

    def region(objs, pad=24, along_sun=0.0):
        """the part of the frame (pixels, x0 y0 x1 y1, rows from the top) where these objects are,
        and, if along_sun, where their shadows fall that far along the sun's light"""
        from bpy_extras.object_utils import world_to_camera_view
        pts = []
        for o in objs:
            for c in [o] + list(o.children_recursive):
                if c.type != 'MESH':
                    continue
                for corner in c.bound_box:
                    p = c.matrix_world @ Vector(corner)
                    pts.append(p)
                    if along_sun:
                        # to where its shadow lands on the wall (Blender y = 0) or the desk (z = 0)
                        tw = (0 - p.y) / sun_dir.y if sun_dir.y else 1e9
                        td = (0 - p.z) / sun_dir.z if sun_dir.z else 1e9
                        t = min(v for v in (tw, td, along_sun) if v > 0)
                        pts.append(p + sun_dir * t)
        xs, ys = [], []
        for p in pts:
            v = world_to_camera_view(scene, cam, p)
            if v.z > 0:
                xs.append(v.x * w); ys.append((1 - v.y) * h)
        x0, x1 = max(0, min(xs) - pad), min(w, max(xs) + pad)
        y0, y1 = max(0, min(ys) - pad), min(h, max(ys) + pad)
        return int(x0) // 2 * 2, int(y0) // 2 * 2, min(w, int(x1 + 1) // 2 * 2), min(h, int(y1 + 1) // 2 * 2)
    S.region = region

    def render(path, border=None, samples=None, denoise=True, only=None, alpha=False, hide=(), hold=()):
        """render to <path>.exr and <path>.npy (float16, rows top down; RGBA when alpha). border:
        pixels (x0, y0, x1, y1), rows from the top. only: the one object seen (the rest hold out);
        hold: objects held out. Then the GPU rests for S.rest times as long as the render took (the
        user: not 100% for hours)."""
        import numpy as np
        t_start = time.time()
        r = scene.render
        if border:
            x0, y0, x1, y1 = border
            r.use_border, r.use_crop_to_border = True, True
            # (half a pixel in, so Blender's rounding lands on exactly these pixels)
            r.border_min_x, r.border_max_x = (x0 + 0.5) / w, (x1 + 0.5) / w
            r.border_min_y, r.border_max_y = (h - y1 + 0.5) / h, (h - y0 + 0.5) / h
        else:
            r.use_border = False
        cy.samples = samples or cy.samples
        cy.use_denoising = denoise
        cy.use_adaptive_sampling = denoise
        r.film_transparent = alpha or only is not None
        held, hidden = [], []
        if only is not None:
            hold = [o for o in scene.objects if o.type == 'MESH' and o is not only]
        for o in hold:
            if not o.hide_render and not o.is_holdout:
                o.is_holdout = True; held.append(o)
        for o in hide:
            if o is not None and not o.hide_render:
                o.hide_render = True; hidden.append(o)
        r.filepath = path + '.exr'
        bpy.ops.render.render(write_still=True)
        for o in held: o.is_holdout = False
        for o in hidden: o.hide_render = False
        img = bpy.data.images.load(path + '.exr')
        iw, ih = img.size
        a = np.empty(iw * ih * 4, np.float32)
        img.pixels.foreach_get(a)
        a = a.reshape(ih, iw, 4)[::-1]
        np.save(path + '.npy', (a if alpha or only is not None else a[..., :3]).astype(np.float16))
        bpy.data.images.remove(img)
        os.remove(path + '.exr')
        if S.rest > 0:
            time.sleep((time.time() - t_start) * S.rest)
    S.render = render
    S.rest = 0.0
    print(f'built in {time.time() - t0:.1f} s', flush=True)
    return S
