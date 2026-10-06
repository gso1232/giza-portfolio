"""
The desk, rendered in Blender's Cycles: the room exactly as desk.html builds it (exported by
__d.exportScene() to blender/desk-scene.glb, in centimetres), lit by a low golden sun and the
sky through the window in the left wall, seen through the site's camera.

  blender -b --factory-startup -P tools/blender/desk.py -- --glb blender/desk-scene.glb
          --info blender/desk-info.json --out <file.png> [--w 1920] [--h 900] [--samples 256]
          [--view wide] [--sun 5] [--sky 0.25] [--exposure 0] [--device OPTIX|CUDA]

The glTF comes in with Blender's Z up (x, -z, y of the room's axes) and a unit per centimetre;
everything made here (lamps, camera) is placed in those same units.
"""
import json, math, sys, time
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, d=None, cast=str):
    return cast(argv[argv.index(k) + 1]) if k in argv else d

GLB, INFO, OUT = arg('--glb'), arg('--info'), arg('--out')
W, H = arg('--w', 1920, int), arg('--h', 900, int)
SAMPLES = arg('--samples', 256, int)
VIEW = arg('--view', 'wide')
SUN = arg('--sun', 5.0, float)
SKY = arg('--sky', 0.25, float)
EXPOSURE = arg('--exposure', 0.0, float)
DEVICE = arg('--device', 'CUDA')
HAZE = arg('--haze', 0.00022, float)                        # the air's density per cm (0: none)
DUST = arg('--dust', 9000, int)                             # motes (0: none)
STEAM = arg('--steam', 1.0, float)                          # the steam's density (0: none)
FSTOP = arg('--fstop', 4.0, float)                          # the lens (0: all sharp)
PHASE = arg('--phase', 0.0, float)                          # the moment in the loop
DUST_SAMPLES = arg('--dust-samples', 128, int)
BORDER = arg('--border', None)                              # 'x0,y0,x1,y1' (0..1, y up): render only that part, for a quick look
info = json.load(open(INFO))
t0 = time.time()

def B(v):
    """a point or direction of the room (x, y up, z out of the wall) in Blender's axes"""
    return Vector((v[0], -v[2], v[1]))

# ---- the scene ---------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
# the picture frame's glass stays out, as in the browser's trace (a sheet of glass in front of
# the print would only lay the window's reflection over it)
for o in list(bpy.data.objects):
    if o.name.startswith('frameGlass'):
        bpy.data.objects.remove(o, do_unlink=True)

# ---- what the glTF can't carry: finer leaves, real surfaces, rounded edges (tools/blender/looks.py)
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import looks, air
print('leaves', looks.replace_leaves(), 'materials', looks.upgrade_materials(), 'rounded', looks.round_edges(), flush=True)

# ---- light: a low sun through the window, the sky's light through the same opening -----------
sun_dir = B(info['sun']).normalized()                     # the way the light travels
sd = bpy.data.lights.new('sun', 'SUN')
sd.energy = SUN
sd.angle = math.radians(0.53)                             # the sun's own disc: its shadows' soft edges
sd.color = tuple(float(c) for c in arg('--sun-color', '1,0.42,0.14').split(','))   # late afternoon (the browser render's '#ffb36e' x its warm balance)
sun = bpy.data.objects.new('sun', sd)
sun.matrix_world = (sun_dir.to_track_quat('-Z', 'Y')).to_matrix().to_4x4()
scene.collection.objects.link(sun)

world = bpy.data.worlds.new('sky')
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = next(n for n in wn.nodes if n.type == 'BACKGROUND')
sky = wn.nodes.new('ShaderNodeTexSky')
for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'HOSEK_WILKIE'):
    try:
        sky.sky_type = t
        break
    except TypeError:
        continue
to_sun = -sun_dir
try:
    sky.sun_disc = False                                   # the sun lamp is the sun
    sky.sun_elevation = math.asin(max(-1, min(1, to_sun.z)))
    sky.sun_rotation = math.atan2(to_sun.x, -to_sun.y)     # (the sky's azimuth, as a sun lamp's Z rotation)
except AttributeError:
    pass
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = SKY

# the window: a portal, so the sky's light is looked for through the opening
w = info['room']['window']
left = info['room']['left']
portal_d = bpy.data.lights.new('window', 'AREA')
portal_d.shape = 'RECTANGLE'
portal_d.size = (w['z1'] - w['z0'])                         # along the wall
portal_d.size_y = (w['y1'] - w['y0'])
for attr in ('is_portal',):
    if hasattr(portal_d, attr):
        setattr(portal_d, attr, True)
if hasattr(portal_d, 'cycles') and hasattr(portal_d.cycles, 'is_portal'):
    portal_d.cycles.is_portal = True
portal = bpy.data.objects.new('window', portal_d)
c = B((left + 0.5, (w['y0'] + w['y1']) / 2, (w['z0'] + w['z1']) / 2))
# the area light shines along its -Z, into the room (+x); its X runs along the wall, its Y up
rot = Matrix(((0, -1, 0), (0, 0, 1), (-1, 0, 0))).transposed()
portal.matrix_world = Matrix.Translation(c) @ rot.to_4x4()
scene.collection.objects.link(portal)

# ---- the camera: the site's -------------------------------------------------------------------
v = info['views'][VIEW]
cd = bpy.data.cameras.new('cam')
cd.sensor_fit = 'VERTICAL'
cd.angle_y = math.radians(v['vfov'])
cd.clip_start, cd.clip_end = 1, 5000
cam = bpy.data.objects.new('cam', cd)
f = B(v['fwd']).normalized(); u = B(v['up']).normalized()
x = f.cross(u).normalized(); y = x.cross(f).normalized()
cam.matrix_world = Matrix.Translation(B(v['pos'])) @ Matrix((x, y, -f)).transposed().to_4x4()
scene.collection.objects.link(cam)
scene.camera = cam
# the lens: focused on the laptop's screen; the scene is in centimetres, so Blender is told so
# (the aperture is worked out in the scene's units)
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 0.01
if FSTOP > 0:
    cd.dof.use_dof = True
    cd.dof.focus_distance = (B(info['focus']) - cam.matrix_world.translation).length
    # Cycles sizes the aperture in metres whatever the unit scale says, and a unit here is a
    # centimetre: the f-number goes in a hundredth as big for a real lens's blur
    cd.dof.aperture_fstop = FSTOP / 100
    cd.dof.aperture_blades = 7
    cd.dof.aperture_rotation = math.radians(12)
cd.lens_unit = 'FOV'

# ---- the air (tools/blender/air.py) -----------------------------------------------------------
scene.render.resolution_x, scene.render.resolution_y = W, H    # (the motes are spread over this frame)
haze_o = air.haze(info['room'], HAZE) if HAZE > 0 else None
steam_o = air.steam(info['mug'], PHASE, STEAM) if STEAM > 0 else None
dust_o = air.dust(cam, DUST, PHASE) if DUST > 0 else None
if dust_o:
    dust_o.hide_render = True                                  # it comes in its own pass, below

# ---- Cycles -----------------------------------------------------------------------------------
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for dt in (DEVICE, 'CUDA'):
    try:
        prefs.compute_device_type = dt
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == dt]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == dt
            scene.cycles.device = 'GPU'
            print('device', dt, [d.name for d in gpus], flush=True)
            break
    except TypeError:
        continue
cy = scene.cycles
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.01
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
except TypeError:
    pass
cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces, cy.transmission_bounces = 12, 6, 6, 12
cy.sample_clamp_indirect = 10
cy.blur_glossy = 1.0
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
if BORDER:
    x0, y0, x1, y1 = (float(v) for v in BORDER.split(','))
    scene.render.use_border, scene.render.use_crop_to_border = True, True
    scene.render.border_min_x, scene.render.border_min_y, scene.render.border_max_x, scene.render.border_max_y = x0, y0, x1, y1
vs = scene.view_settings
for t in ('Khronos PBR Neutral', 'AgX', 'Filmic'):
    try:
        vs.view_transform = t
        break
    except TypeError:
        continue
vs.exposure = EXPOSURE
cy.volume_bounces = 1
# linear light out (the finishing, tools/blender/finish.py, adds the dust and tone maps)
scene.render.image_settings.file_format = 'OPEN_EXR'
scene.render.image_settings.color_depth = '16'
scene.render.image_settings.exr_codec = 'ZIP'
base = OUT.rsplit('.', 1)[0]
scene.render.filepath = base + '-main.exr'
import numpy as np
def to_npy(exr):
    """the saved EXR as a float16 .npy beside it (rows top down, RGB): the system's OpenCV has no
    EXR reader, so tools/blender/finish.py reads these"""
    img = bpy.data.images.load(exr)
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    np.save(exr[:-4] + '.npy', a.reshape(h, w, 4)[::-1, :, :3].astype(np.float16))
    bpy.data.images.remove(img)

print(f'scene ready in {time.time() - t0:.1f} s', flush=True)
bpy.ops.render.render(write_still=True)
to_npy(base + '-main.exr')
print(f'RENDERED main in {time.time() - t0:.1f} s', flush=True)

# the dust on its own: everything else a holdout (it still hides motes behind it and casts
# its shadows on them), no denoising (it would take tiny bright motes for noise)
if dust_o:
    dust_o.hide_render = False
    for o in scene.objects:
        if o.type == 'MESH' and o is not dust_o:
            o.is_holdout = True
    for o in (haze_o, steam_o):
        if o:
            o.hide_render = True
    scene.render.film_transparent = True
    cy.use_denoising = False
    cy.samples = DUST_SAMPLES
    cy.use_adaptive_sampling = False
    scene.render.filepath = base + '-dust.exr'
    bpy.ops.render.render(write_still=True)
    to_npy(base + '-dust.exr')
    print(f'RENDERED dust in {time.time() - t0:.1f} s', flush=True)
print('DONE', flush=True)
