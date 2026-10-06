"""A figure's glb made light for the site, nothing it draws changed (scene6.js styleFigure):
 - only the pictures the site reads stay: the skin's (its scalp is read from it) and the hair cards' (their cut-out);
   every other texture (the clothes', normal, roughness and occlusion maps) goes: the site draws all else in flat tones
 - a mesh whose material keeps no picture loses its UVs
 - the kept pictures re-encoded (JPEG for the skin, PNG for the hair's alpha), at most --max px on a side
 - the bone weights as normalised bytes (core glTF), each vertex's four still summing to one

  python tools/slim_glb.py <in.glb> <out.glb> [--max 1024]
"""
import io, json, re, struct, sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 1024
KEEP = re.compile(r'skin|hair|afro|ponytail|bob|bun|short', re.I)

b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
J = json.loads(b[20:20 + jl])
o = 20 + jl
bl = struct.unpack('<I', b[o:o + 4])[0]
BIN = b[o + 8:o + 8 + bl]
views = J['bufferViews']
data = [BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

# 1) the textures the site reads
for m in J.get('materials', []):
    keep = bool(KEEP.search(m.get('name', '')))
    for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
        m.pop(k, None)
    pbr = m.get('pbrMetallicRoughness', {})
    pbr.pop('metallicRoughnessTexture', None)
    if not keep:
        pbr.pop('baseColorTexture', None)
    m.get('extensions', {}).pop('KHR_materials_specular', None)
has_tex = [('baseColorTexture' in m.get('pbrMetallicRoughness', {})) for m in J.get('materials', [])]
# 2) no UVs where no picture is read
for me in J.get('meshes', []):
    for p in me['primitives']:
        if p.get('material') is not None and not has_tex[p['material']]:
            for k in [k for k in p['attributes'] if k.startswith('TEXCOORD')]:
                del p['attributes'][k]
# 3) the weights as normalised bytes
acc = J['accessors']
for me in J.get('meshes', []):
    for p in me['primitives']:
        i = p['attributes'].get('WEIGHTS_0')
        if i is None or acc[i]['componentType'] != 5126:
            continue
        a = acc[i]; v = views[a['bufferView']]
        arr = np.frombuffer(data[a['bufferView']], np.float32, count=a['count'] * 4, offset=a.get('byteOffset', 0)).reshape(-1, 4)
        if v.get('byteStride') not in (None, 16):
            continue
        s = arr.sum(1, keepdims=True); s[s == 0] = 1
        q = np.floor(arr / s * 255 + 0.5).astype(np.int32)
        d = 255 - q.sum(1)                                     # (the rounding's remainder onto each vertex's largest)
        q[np.arange(len(q)), q.argmax(1)] += d
        views.append({'buffer': 0, 'byteLength': q.size, 'target': 34962})
        data.append(np.clip(q, 0, 255).astype(np.uint8).tobytes())
        new = {'bufferView': len(views) - 1, 'componentType': 5121, 'normalized': True, 'count': a['count'], 'type': 'VEC4'}
        acc.append(new)
        p['attributes']['WEIGHTS_0'] = len(acc) - 1
# 4) the pictures still read, re-encoded
used_tex = {m['pbrMetallicRoughness']['baseColorTexture']['index'] for m in J.get('materials', []) if 'baseColorTexture' in m.get('pbrMetallicRoughness', {})}
used_img = {J['textures'][t]['source'] for t in used_tex}
for ii in used_img:
    im = J['images'][ii]
    pic = Image.open(io.BytesIO(data[im['bufferView']]))
    alpha = pic.mode in ('RGBA', 'LA') and np.asarray(pic.convert('RGBA'))[..., 3].min() < 255
    if max(pic.size) > MAX:
        k = MAX / max(pic.size)
        pic = pic.resize((round(pic.width * k), round(pic.height * k)), Image.LANCZOS)
    out = io.BytesIO()
    if alpha:
        pic.convert('RGBA').save(out, 'PNG', optimize=True); im['mimeType'] = 'image/png'
    else:
        pic.convert('RGB').save(out, 'JPEG', quality=90, optimize=True); im['mimeType'] = 'image/jpeg'
    data[im['bufferView']] = out.getvalue()
    views[im['bufferView']]['byteLength'] = len(data[im['bufferView']])
# 5) what nothing points at any more goes, and the rest is packed again
tex_map = {t: n for n, t in enumerate(sorted(used_tex))}
img_map = {ii: n for n, ii in enumerate(sorted(used_img))}
J['textures'] = [dict(J['textures'][t], source=img_map[J['textures'][t]['source']]) for t in sorted(used_tex)]
J['images'] = [J['images'][ii] for ii in sorted(used_img)]
for m in J.get('materials', []):
    t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if t:
        t['index'] = tex_map[t['index']]
used_acc = set()
for me in J.get('meshes', []):
    for p in me['primitives']:
        used_acc |= set(p['attributes'].values())
        if 'indices' in p: used_acc.add(p['indices'])
        for t in p.get('targets', []): used_acc |= set(t.values())
for sk in J.get('skins', []):
    if 'inverseBindMatrices' in sk: used_acc.add(sk['inverseBindMatrices'])
for an in J.get('animations', []):
    for s in an['samplers']: used_acc |= {s['input'], s['output']}
acc_map = {a: n for n, a in enumerate(sorted(used_acc))}
J['accessors'] = [acc[a] for a in sorted(used_acc)]
for me in J.get('meshes', []):
    for p in me['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
        p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p.get('targets', [])] or p.pop('targets', None) or []
        if not p['targets']: p.pop('targets')
for sk in J.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
for an in J.get('animations', []):
    for s in an['samplers']: s['input'], s['output'] = acc_map[s['input']], acc_map[s['output']]
used_v = {a['bufferView'] for a in J['accessors'] if 'bufferView' in a} | {im['bufferView'] for im in J['images']}
v_map = {v: n for n, v in enumerate(sorted(used_v))}
out_bin, new_views = bytearray(), []
for v in sorted(used_v):
    while len(out_bin) % 4: out_bin.append(0)
    nv = {k: x for k, x in views[v].items() if k != 'byteOffset'}
    nv['byteOffset'] = len(out_bin); nv['byteLength'] = len(data[v])
    out_bin += data[v]; new_views.append(nv)
while len(out_bin) % 4: out_bin.append(0)
for a in J['accessors']:
    if 'bufferView' in a: a['bufferView'] = v_map[a['bufferView']]
for im in J['images']: im['bufferView'] = v_map[im['bufferView']]
J['bufferViews'] = new_views
J['buffers'] = [{'byteLength': len(out_bin)}]
js = json.dumps(J, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out_bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out_bin), 0x004E4942) + bytes(out_bin)
open(dst, 'wb').write(glb)
print(f'{src}: {len(b) / 1e6:.2f} MB -> {len(glb) / 1e6:.2f} MB; pictures kept {len(J["images"])}')
