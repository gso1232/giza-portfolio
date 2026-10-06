// The 3D behind the window, as the reference runs its own: one sequence position S (their Theatre.js
// sequence, 0..27.47) set by the scroll section by section (main.js), and everything read at S from their
// timeline (timeline.js): the camera's place in their own camera clip (clone-tracks.json, 24 fps), the
// opening dolly, the pointer pivot, the sun, the sheet's reveal and wipe, the printout sliding across to
// his teammate and her red pen, the design-system sheet unrolling, the tablet's cover, the screen that
// rises where their building does (ych.js: the Yellow Crane Tower, on their building's clock), and the people.
// The room is theirs too, in size and place (tools/blender/set2.py), with only his things in it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lookUniforms, paint, createComposite } from './look.js';
import { buildOutside } from './outside.js';
import { buildSet } from './set.js';
import { buildYch } from './ych.js';
import { createExtras } from './extras.js';
import { at, CAMERA_CLIP, STATIC } from './timeline.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const range = (v, a, b) => clamp((v - a) / (b - a));
const sm = (t) => t * t * (3 - 2 * t);
const BUILDING_CLIP = 25.75;                       // their building_animation, seconds

export function createScene(canvas, { accent = '#b9693b', lit = '#f4d3b0', ink = '#3d2b15', start = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;           // (what three turns PCFSoft into at the first frame anyway: set so, the shaders compiled ahead match)
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const big = Math.min(screen.width, screen.height) >= 700;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);    // (theirs: 45, then a 50 mm lens on a 35 mm gauge)
  const U = lookUniforms();
  U.uDiffuse.value.set(STATIC.diffuseThreshold, STATIC.diffuseSmoothness * 4);
  const composite = createComposite(renderer);
  const edgeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.42 });
  let S = 0, letter = 0, rise = 0, clock = 0, dirty = true, W = 1, H = 1, warming = true, held = false, lastKey = '';

  // ---- out of their six windows: Cairo ----------------------------------------------------------------
  const outside = buildOutside({ ink });
  outside.group.position.set(0.07, 1.9, -2);      // (laid out for a window at x -2.25; theirs is at -3.08)
  scene.add(outside.group);

  // ---- the sun: theirs, moving as theirs does ---------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(big ? 4096 : 2048);
  Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 4, far: 30 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.004; sun.shadow.radius = 2;
  sun.target.position.set(...STATIC.sunTarget);
  scene.add(sun, sun.target);

  // ---- their camera ---------------------------------------------------------------------------------
  let camTrack = null, objTrack = null;
  const camAt = (time, pos, quat) => {
    const P = camTrack.p, Q = camTrack.q, n = P.length / 3;
    const f = clamp(time / CAMERA_CLIP) * (n - 1), i = Math.min(n - 2, Math.floor(f)), k = f - i;
    pos.set(lerp(P[i * 3], P[i * 3 + 3], k), lerp(P[i * 3 + 1], P[i * 3 + 4], k), lerp(P[i * 3 + 2], P[i * 3 + 5], k));
    const qa = new THREE.Quaternion(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]);
    const qb = new THREE.Quaternion(Q[i * 4 + 4], Q[i * 4 + 5], Q[i * 4 + 6], Q[i * 4 + 7]);
    quat.slerpQuaternions(qa, qb, k);
  };
  const trackAt = (rec, path, time) => {             // a node's track (translation 3 / rotation 4) at a time
    const tr = rec[path]; if (!tr) return null;
    const t = tr.t, v = tr.v, n = tr.n;
    let i = 0; while (i < t.length - 2 && time > t[i + 1]) i++;
    const k = clamp((time - t[i]) / Math.max(1e-6, t[i + 1] - t[i]));
    if (n === 4) {
      const qa = new THREE.Quaternion(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
      const qb = new THREE.Quaternion(v[i * 4 + 4], v[i * 4 + 5], v[i * 4 + 6], v[i * 4 + 7]);
      return new THREE.Quaternion().slerpQuaternions(qa, qb, k);
    }
    return V(lerp(v[i * 3], v[i * 3 + 3], k), lerp(v[i * 3 + 1], v[i * 3 + 4], k), lerp(v[i * 3 + 2], v[i * 3 + 5], k));
  };
  const mouse = [new THREE.Vector2(), new THREE.Vector2()], pointer = new THREE.Vector2();
  const euler = new THREE.Euler(), qtmp = new THREE.Quaternion();

  // ---- the room and what moves in it -----------------------------------------------------------------
  let set = null, stack = null, printout = null, roll = null, cover = null, marks = null, extras = null;
  const figs = {};
  // (decoded off the main thread before it is drawn or sent to the GPU: decoded there, each big one held a frame 0.3 s)
const loadImage = (src) => { const i = new Image(); i.src = src; return i.decode().then(() => i, () => null); };
  let waitQuiet = null;                         // (main.js: a moment when nothing on the first screen moves)
  let warmState = 'loading', warmDone = null;   // (loading, then 'quiet': waiting for that moment for its one slow draw)
  const warmed = new Promise((r) => { warmDone = r; });
  const ready = (async () => {
    if (start) await start;                     // (the first screen's signature written before the heavy work begins)
    const [built, phoneImg, tracks] = await Promise.all([
      buildSet({ U, renderer, edgeMat, name: 'set2' }),
      loadImage('./inside/work/live/duriza-phone.jpg'),
      fetch('./inside/clone-tracks.json').then((r) => r.json()),
    ]);
    set = built; camTrack = tracks.camera; objTrack = tracks;
    scene.add(set.group);
    // the site as a building, where their building rises (their floors stand on (-0.051, 0.758, 0.074))
    stack = await buildYch({ U, paint, edgeMat, palette: { lit, accent, ink } });
    scene.add(stack.root);
    // his marks on it: breakpoints, the inspector, auto layout, Lighthouse, tokens, the merged review (extras.js)
    extras = createExtras({ scene, camera, tower: stack, set, palette: { lit, accent, ink } });
    void phoneImg;
    // the printout under the tracing sheet (their plan sheet): his Home screen printed, which slides across
    printout = set.makePrintout();
    printout.position.set(-0.00308, 0.7645, -0.07973);
    scene.add(printout);
    marks = printout.userData.marks;
    // the design system's sheet, rolled up, that unrolls (their second sheet)
    roll = set.makeRoll();
    roll.position.set(0.3185, 0.7675, -0.1695);
    scene.add(roll);
    // the tablet's folio cover (their sketchbook's), hinged at its left edge
    cover = set.makeCover();
    scene.add(cover);
    // him and his teammate (tools/blender/figure.py, in their room)
    const load = (url) => new Promise((res) => new GLTFLoader().load(url, (g) => res(g), undefined, () => res(null)));
    // their three people's own motion on his three (figure.py --retarget): him, his teammate, his lead
    const [gh, gm, gl] = await Promise.all([load('./inside/him7.glb'), load('./inside/mate7.glb'), load('./inside/lead7.glb')]);
    const hullsDone = [];
    for (const [g, who] of [[gh, 'him'], [gm, 'mate'], [gl, 'lead']]) {
      if (!g) continue;
      const fig = g.scene; fig.name = who;
      fig.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
      await new Promise((r) => requestAnimationFrame(r));     // (a frame between the figures: the page keeps moving)
      hullsDone.push(styleFigure(fig, who));
      scene.add(fig);
      const mx = new THREE.AnimationMixer(fig);
      const acts = g.animations.map((c) => { const a = mx.clipAction(c); a.play(); a.paused = true; return a; });
      figs[who] = { fig, mx, acts, last: -1 };
    }
    await Promise.all(hullsDone);
    await warm();
    warming = false;
    dirty = true;
    warmState = 'done'; warmDone();
  })();

  // everything drawn once while the page loads, so nothing is compiled or uploaded the first time it shows up
  // mid-scroll (the building's first frame was a 370 ms stall, the letter's 250): every object shown, every
  // texture sent to the GPU, the scene and the letter's stage each rendered once with their shadows, then put back
  // (spread over frames, its shaders compiled off the main thread where the browser can: done in one go it held
  // the page still for 3.5 s, the signature's words frozen mid-turn)
  async function warm() {
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
    pose();
    const hidden = [];
    // (but not the lights: a light that is off counts in every shader's key, and shown here it had them all compiled
    // for two lights while the room has one; all of them were compiled again on the first frame)
    const dark = [];
    scene.traverse((o) => { if (o.isLight) { let on = o.visible; o.traverseAncestors((a) => { if (!a.visible) on = false; }); if (!on) dark.push([o, o.visible]); } });
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    for (const [l] of dark) l.visible = false;
    const seen = new Set(), texs = [];
    const up = (t) => { if (t?.isTexture && !seen.has(t)) { seen.add(t); texs.push(t); } };
    scene.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        for (const k in m) up(m[k]);
        for (const u of Object.values(m.userData?.uniforms ?? {})) up(u.value);
      }
    });
    for (const t of extras?.textures ?? []) up(t);
    for (let i = 0; i < texs.length; i++) { renderer.initTexture(texs[i]); await nextFrame(); }
    if (renderer.compileAsync) {
      // (compiled as they will be drawn: into the composite's target, linear; compiled for the screen they were all
      // compiled again on the first frame, the main thread held a second)
      renderer.setRenderTarget(composite.rt);
      await renderer.compileAsync(scene, camera); await renderer.compileAsync(stage, stageCam);
      // and the shadows' own shaders: each caster as the shadow pass draws it (its depth material, its side turned
      // round, its cut-out), under the scene's own lights
      const flip = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
      const casters = new THREE.Scene(), kinds = new Map();
      const point = []; scene.traverse((o) => { if (o.isLight && o.castShadow) point.push(!!o.isPointLight); });
      scene.traverse((o) => {
        if (!o.isMesh || !o.castShadow || Array.isArray(o.material) || !o.material) return;
        const m = o.material;
        for (const isPoint of new Set(point)) {
          const custom = isPoint ? o.customDistanceMaterial : o.customDepthMaterial;
          const side = m.shadowSide ?? flip[m.side];
          const k = `${isPoint}|${custom?.uuid ?? ''}|${side}|${!!m.map}|${!!m.alphaMap}|${m.alphaTest > 0}|${o.isSkinnedMesh}|${!!o.morphTargetInfluences}`;
          if (kinds.has(k)) continue;
          const d = custom ?? (isPoint ? new THREE.MeshDistanceMaterial() : new THREE.MeshDepthMaterial());
          if (!custom) { d.side = side; d.alphaTest = m.alphaTest; d.map = m.map ?? null; d.alphaMap = m.alphaMap ?? null; }   // (three hands every caster its map)
          const c = o.clone(false); c.material = d; kinds.set(k, c); casters.add(c);
        }
      });
      try { await renderer.compileAsync(casters, camera, scene); } catch { /* (then they compile on the first frame, as before) */ }
      renderer.setRenderTarget(null);
      await composite.compile();                  // (and the pass that puts it on the screen)
    }
    else { renderer.compile(scene, camera); renderer.compile(stage, stageCam); }
    await nextFrame();
    // the first full draw still compiles the shadows' shaders the slow way (a second, all at once): done while the
    // first screen's words hold still between their turns
    warmState = 'quiet';
    if (waitQuiet) await waitQuiet();
    scene.traverse((o) => { if (!o.visible && hidden.includes(o)) o.visible = true; });
    composite.render(scene, camera);
    poseStage();
    composite.render(stage, stageCam);
    for (const o of hidden) o.visible = false;
    for (const [l, v] of dark) l.visible = v;
    pose();
  }

  // ---- a figure in their style (as scene5: flat tones, ink glasses, an inked hull) ----------------------
  const values = (tex, f) => {
    const img = tex?.image;
    if (!img || !img.width) return null;
    const c = document.createElement('canvas'); c.width = Math.min(512, img.width); c.height = Math.round(c.width * img.height / img.width);
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const v = f((0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]) / 255) * 255; a[i] = a[i + 1] = a[i + 2] = v; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    return t;
  };
  const sm2 = (a, b, x) => sm(clamp((x - a) / (b - a)));
  // (pushed back in depth, so at a fold, an elbow, its inflated back never shows in front of the skin)
  const hullMat = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
  hullMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 hullNormal;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  { vec3 hn = hullNormal;\n  #ifdef USE_SKINNING\n  hn = (skinMatrix * vec4(hn, 0.0)).xyz;\n  #endif\n  vec4 hv = modelViewMatrix * vec4(transformed, 1.0); transformed += normalize(hn) * 0.0016 * max(0.25, -hv.z); }');
  };
  hullMat.customProgramCacheKey = () => 'hull6';
  const penEdge = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.85 });
  const curlEdge = new THREE.LineBasicMaterial({ color: '#8a6a52', transparent: true, opacity: 0.75 });
  // an inked shell for a rigid piece (his hair): its back faces pushed out a little, drawn in the ink
  const staticHull = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
  staticHull.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { vec4 hv = modelViewMatrix * vec4(transformed, 1.0); transformed += normalize(normal) * 0.0016 * max(0.25, -hv.z); }'); };
  staticHull.customProgramCacheKey = () => 'statichull';
  // the outline's own normals: each vertex's averaged with every vertex within 2 cm (a grid of cells finds
  // them), so at a fold (an elbow, a knuckle) the inked shell swells evenly instead of throwing a spike
  // (the work done in a worker, so the page keeps moving while the figures are made: in the page it held the
  // signature's turning words still for a second a figure)
  let hullWorker = null, hullId = 0;
  const hullJobs = new Map();
  function hullNormalsAsync(geo) {
    if (geo.getAttribute('hullNormal')) return Promise.resolve();
    try { hullWorker ??= new Worker(new URL('./hull-worker.js', import.meta.url), { type: 'module' }); }
    catch { smoothHullNormals(geo); return Promise.resolve(); }
    hullWorker.onmessage ??= (e) => { const j = hullJobs.get(e.data.id); hullJobs.delete(e.data.id); j?.(e.data.out); };
    const pa = geo.getAttribute('position'), na = geo.getAttribute('normal'), N = pa.count;
    const P = new Float32Array(N * 3), Nn = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { P[i * 3] = pa.getX(i); P[i * 3 + 1] = pa.getY(i); P[i * 3 + 2] = pa.getZ(i); Nn[i * 3] = na.getX(i); Nn[i * 3 + 1] = na.getY(i); Nn[i * 3 + 2] = na.getZ(i); }
    const id = ++hullId;
    return new Promise((ok) => {
      hullJobs.set(id, (out) => { geo.setAttribute('hullNormal', new THREE.BufferAttribute(out, 3)); ok(); });
      hullWorker.postMessage({ id, P, Nn }, [P.buffer, Nn.buffer]);
    });
  }
  function smoothHullNormals(geo) {
    if (geo.getAttribute('hullNormal')) return;
    // (numeric cell keys and the raw arrays: string keys made this 2 s a figure, all of it on the main thread)
    const pa = geo.getAttribute('position'), na = geo.getAttribute('normal'), N = pa.count, R = 0.02, R2 = R * R;
    const P = new Float32Array(N * 3), Nn = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { P[i * 3] = pa.getX(i); P[i * 3 + 1] = pa.getY(i); P[i * 3 + 2] = pa.getZ(i); Nn[i * 3] = na.getX(i); Nn[i * 3 + 1] = na.getY(i); Nn[i * 3 + 2] = na.getZ(i); }
    const key = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
    const cells = new Map();
    const C = new Int32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const cx = Math.floor(P[i * 3] / R), cy = Math.floor(P[i * 3 + 1] / R), cz = Math.floor(P[i * 3 + 2] / R);
      C[i * 3] = cx; C[i * 3 + 1] = cy; C[i * 3 + 2] = cz;
      const k = key(cx, cy, cz); let c = cells.get(k); if (!c) cells.set(k, (c = [])); c.push(i);
    }
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = C[i * 3], cy = C[i * 3 + 1], cz = C[i * 3 + 2];
      let sx = 0, sy = 0, sz = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const list = cells.get(key(cx + a, cy + b, cz + c)); if (!list) continue;
        for (let q = 0; q < list.length; q++) {
          const j = list[q] * 3, dx = P[j] - x, dy = P[j + 1] - y, dz = P[j + 2] - z;
          const d2 = dx * dx + dy * dy + dz * dz; if (d2 > R2) continue;
          const w = 1 - d2 / R2;
          sx += Nn[j] * w; sy += Nn[j + 1] * w; sz += Nn[j + 2] * w;
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
    }
    geo.setAttribute('hullNormal', new THREE.BufferAttribute(out, 3));
  }
  function styleFigure(fig, who = '') {
    const hulls = [];
    fig.traverse((o) => {
      if (!o.isMesh) return;
      const n = `${o.name} ${o.material?.name ?? ''}`.toLowerCase();
      const m = o.material;
      let solid = true;
      if (/eyelash|eyebrow/.test(n)) { o.visible = false; return; }
      // the pens: inked round as theirs is, or a light pencil vanishes on the paper
      // the people as the reference draws its own: flat tones, the sun and the shade doing all the drawing (no
      // texture's grain or patches); the hair dark for his likeness, cut out by its own picture's alpha
      if (/redpen/.test(n)) { o.material = paint({ ...U, uBase: { value: new THREE.Color('#d2553a') }, uShadow: { value: new THREE.Color('#7a2416') } }, { noise: 0.15 }); solid = false; o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), penEdge)); }
      else if (/pencil/.test(n)) { o.material = paint(U, { tint: 1, noise: 0.15, flat: true }); solid = false; o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), penEdge)); }
      else if (/high-poly|eyes/.test(n)) { o.material = paint(U, { tint: 1, noise: 0.1 }); solid = false; }
      else if (/glasses/.test(n)) o.material = paint(U, { tint: 0.04, noise: 0.1 });
      else if (/hair_solid/.test(n)) {
        // his hair: one dark mass of curls in the two tones (its bumps catch the light), inked round
        // (a colour, not a grey: the tint is linear, so 0.1 drew a 35% grey; this is a dark brown in both tones)
        o.material = paint(U, { tint: new THREE.Color(0.075, 0.05, 0.036), noise: 0 }); solid = false;
        const shell = new THREE.Mesh(o.geometry, staticHull); shell.renderOrder = -1; o.add(shell);
      }
      else if (/\bcap\b/.test(n)) {
        // his cap: a dark navy cloth, inked round like his hair (both sides drawn: its peak is a thin sheet)
        o.material = paint(U, { tint: new THREE.Color(0.07, 0.085, 0.12), noise: 0.08, side: THREE.DoubleSide }); solid = false;
        const shell = new THREE.Mesh(o.geometry, staticHull); shell.renderOrder = -1; o.add(shell);
      }
      else if (/afro|hair|ponytail|bob|bun/.test(n)) { o.material = paint(U, { map: values(m.map, () => 1) ?? m.map, tint: who === 'him' ? 0.2 : 0.9, alphaTest: 0.22, side: THREE.DoubleSide, noise: 0.15 }); solid = false; }
      // (the skin casts no shadow: under their low sun each finger's shadow ran out across the paper as a long
      // tooth, a fringe of them along the hand; the sleeve, the pen, the hair and the cap still cast theirs)
      else if (/skin|base|body|hand_/.test(n) && !/suit|shoe|cloth/.test(n)) { o.material = paint(U, { map: values(m.map, (v) => (v > 0.1 ? 1 : 0.11)), tint: who === 'him' ? 0.86 : 1, noise: 0 }); o.receiveShadow = false; o.castShadow = false; }
      else if (/shoe/.test(n)) o.material = paint(U, { tint: 0.5, noise: 0.12, side: m.side });
      // the outfit: jeans darker; the white tee lighter than his skin and its shade lifted (a white cloth in shadow
      // stays light), so the shirt reads as a shirt and not as his bare back
      else if (Array.isArray(o.material)) o.material = o.material.map((mm) => paint(U, { tint: /trousers/.test(mm.name) ? 0.58 : /tee/.test(mm.name) ? 1.18 : 1, soft: /tee/.test(mm.name) ? 0.5 : 0, noise: 0.12, side: mm.side }));
      else o.material = paint(U, { tint: /trousers/.test(m.name) ? 0.58 : /tee/.test(m.name) ? 1.18 : 1, soft: /tee/.test(m.name) ? 0.5 : 0, noise: 0.12, side: m.side });
      if (solid && o.isSkinnedMesh) hulls.push(o);
    });
    return Promise.all(hulls.map((o) => hullNormalsAsync(o.geometry).then(() => {
      const h = new THREE.SkinnedMesh(o.geometry, hullMat);
      h.bind(o.skeleton, o.bindMatrix);
      h.frustumCulled = false;
      o.parent.add(h);
      h.position.copy(o.position); h.quaternion.copy(o.quaternion); h.scale.copy(o.scale);
    })));
  }

  // ---- the letter's stage (kept from scene5): his logo's four shapes floating on the accent --------------
  const stage = new THREE.Scene();
  const stageCam = new THREE.PerspectiveCamera(36, 1, 0.1, 50); stageCam.position.set(0, 0, 6.2);
  const stageSun = new THREE.DirectionalLight(0xffffff, 1); stageSun.position.set(-3, 4, 5); stage.add(stageSun);
  const blocks = [];
  ['square', 'triangle', 'circle', 'slash'].forEach((s, i) => {
    const spots = [[-2.35, 1.15, -0.4, 0.5, 0.35], [2.3, 1.05, -0.2, -0.45, -0.3], [-2.2, -1.25, 0.1, 0.4, -0.5], [2.35, -1.2, -0.3, -0.35, 0.45]];
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#f3ece0'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = g.strokeStyle = '#3a2a22'; g.lineWidth = 46; g.lineJoin = 'round';
    if (s === 'square') g.fillRect(96, 96, 320, 320);
    if (s === 'triangle') { g.beginPath(); g.moveTo(256, 92); g.lineTo(424, 420); g.lineTo(88, 420); g.closePath(); g.fill(); }
    if (s === 'circle') { g.beginPath(); g.arc(256, 256, 150, 0, 7); g.stroke(); g.beginPath(); g.arc(256, 256, 64, 0, 7); g.fill(); }
    if (s === 'slash') { g.strokeRect(110, 110, 292, 292); g.beginPath(); g.moveTo(150, 362); g.lineTo(362, 150); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const face = paint(U, { map: t }), side = paint(U, { tint: 0.96 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.5), [side, side, side, side, face, side]);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: '#2a201b', transparent: true, opacity: 0.6 })));
    const [x, y, z, rx, ry] = spots[i];
    m.userData.home = { x, y, z, rx, ry };
    stage.add(m); blocks.push(m);
  });

  // ---- pose at S --------------------------------------------------------------------------------------
  const camPos = V(), camQuat = new THREE.Quaternion();
  function pose() {
    if (!camTrack) return;
    // the camera: their clip at the timeline's share of it, the opening dolly, the pointer pivot
    camAt(at('camera', S) * CAMERA_CLIP, camPos, camQuat);
    camera.position.copy(camPos); camera.quaternion.copy(camQuat);
    camera.translateZ(at('cameraZTranslate', S));
    const off = at('cameraPivotOffset', S), P = STATIC.pivot;
    camera.translateZ(-off);
    euler.set(mouse[0].y * P.angle[1] * P.strength, -mouse[0].x * P.angle[0] * P.strength, 0);
    camera.quaternion.multiply(qtmp.setFromEuler(euler));
    camera.translateZ(off);
    camera.updateMatrixWorld();
    // the sun
    sun.position.set(at('sunX', S), at('sunY', S), at('sunZ', S));
    if (!set) return;
    // the tracing sheet: the pointer shows the real design under the pencil (their radius 0.14, growing to
    // the whole sheet), then the sketch wipes into the clean drawing, then the grid
    const sheet = set.byName.get('sheet_flow')?.material;
    if (sheet) {
      const u = sheet.userData.uniforms;
      u.uDress.value = at('wipe', S);
      // the real drawing shows under the pointer only while it is over the sheet (as theirs: nothing by itself),
      // until their timeline grows it over the whole sheet
      const on = at('raycasting', S) > 0.5 || S < 9.3;
      const grow = sm(at('radius', S) > 0.14 ? (at('radius', S) - 0.14) / 0.575 : 0);
      void grow;                                        // (theirs grows it over the whole sheet; his colours stay under the pointer)
      hover.rTarget = (on && hover.over && hover.onSheet ? STATIC.reveal.radius : 0) * at('revealOn', S);
      u.uHitW.value.copy(hover.hit);
      u.uRadius.value = hover.r;
    }
    // the printout: their plan sheet's slide across to her (paper_action, 3.25 s) and her red pen on it
    if (printout && objTrack.paper) {
      const tt = at('paper', S) * 3.25;
      const p = trackAt(objTrack.paper, 'translation', tt), q = trackAt(objTrack.paper, 'rotation', tt);
      if (p) printout.position.copy(p);
      if (q) printout.quaternion.copy(q);
      const v = at('paperVideo', S);
      marks.draw(clamp(v / 0.5), clamp((v - 0.5) / 0.42), clamp((v - 0.92) / 0.08));
    }
    roll?.userData.pose(at('paperRoll', S));
    cover?.userData.pose(at('bookCover', S), at('bookSwatch', S));
    // the building, on their building's clock
    if (stack) stack.pose(at('building', S) * BUILDING_CLIP);
    extras?.update(S, at('building', S) * BUILDING_CLIP);
    // the people: each its clip at the timeline's share of it, shown when theirs is
    const share = { him: at('human1', S), mate: at('human2', S), lead: at('human3', S) };
    const vis = { him: 1, mate: at('human2Visible', S), lead: at('human3Visible', S) };
    for (const [who, F] of Object.entries(figs)) {
      F.fig.visible = vis[who] > 0.5;
      const t = share[who];
      if (F.last !== t) { F.last = t; for (const a of F.acts) a.time = t * a.getClip().duration; F.mx.update(0); }
    }
  }
  const hover = { hit: V(0, 0.77, 0.1), target: V(0, 0.77, 0.1), r: 0, rTarget: 0, moved: -10, over: false, onSheet: false };
  const ray = new THREE.Raycaster();

  function poseStage() {
    blocks.forEach((b, i) => {
      const h = b.userData.home;
      b.position.set(h.x, h.y + Math.sin(clock * 0.6 + i * 1.7) * 0.06 + letter * 0.5, h.z);
      b.rotation.set(h.rx + Math.sin(clock * 0.4 + i) * 0.05, h.ry + Math.sin(clock * 0.3 + i * 2) * 0.08 + letter * 0.2 * (i % 2 ? 1 : -1), 0);
    });
  }

  function resize(w, h) {
    W = w; H = h;
    renderer.setSize(w, h, false);
    composite.resize();
    camera.aspect = w / h;
    camera.setFocalLength(STATIC.focalLength);      // (their lens: 50 mm, so the view's height follows the aspect)
    stageCam.aspect = w / h; stageCam.updateProjectionMatrix();
    dirty = true;
  }

  let last = -1;
  let nightT = 0, nightTo = 0;
  const DAY = { a: new THREE.Color(accent), l: new THREE.Color(lit) }, NIGHT = { a: new THREE.Color('#231f33'), l: new THREE.Color('#4a4462') };
  const mixA = new THREE.Color(), mixL = new THREE.Color();
  function frame(dt) {
    clock += dt;
    // (nothing drawn while it is being warmed up, or while the first screen covers it all: a draw then would
    // compile a shader the slow way, in the middle of the signature's turn)
    if (warming || held) return false;
    if (Math.abs(nightTo - nightT) > 1e-3) {
      nightT += (nightTo - nightT) * Math.min(1, dt * 3.5);
      if (Math.abs(nightTo - nightT) < 2e-3) nightT = nightTo;
      setPalette(mixA.copy(DAY.a).lerp(NIGHT.a, nightT).getStyle(), mixL.copy(DAY.l).lerp(NIGHT.l, nightT).getStyle());
      stack?.night?.(nightT);
    }
    const nd = dt * 60;                              // (their lerps are per 60 fps frame)
    mouse[0].lerp(pointer, Math.min(1, STATIC.pivot.lerp1 * nd));
    mouse[1].lerp(pointer, Math.min(1, STATIC.pivot.lerp2 * nd));
    // the pointer on the sheet, its window following (theirs: a lerp of 0.15 a frame)
    if (set && (hover.rTarget > 0 || (hover.over && at('revealOn', S) > 0))) {
      if (hover.over) {
        ray.setFromCamera(pointer, camera);
        const s = set.byName.get('sheet_flow');
        const hit = s && ray.intersectObject(s, false)[0];
        hover.onSheet = !!hit;
        if (hit) hover.target.copy(hit.point);
      } else hover.onSheet = false;
    }
    hover.hit.lerp(hover.target, 1 - Math.pow(0.85, nd));
    hover.r += (hover.rTarget - hover.r) * (1 - Math.pow(0.9, nd));
    if (S < 4 || (S > 21 && S < 26)) outside.update(dt);
    // drawn only when something has moved: the story, the pointer's lean, the reveal, the night, the clouds over
    // Cairo, the letter's floating blocks (a still frame drawn again and again only heats the machine and steals
    // the frames a scroll needs)
    const live = S < 4 || (S > 21 && S < 26) || rise > 0 || letter > 0;
    const key = `${S}|${mouse[0].x.toFixed(5)}|${mouse[0].y.toFixed(5)}|${mouse[1].x.toFixed(5)}|${mouse[1].y.toFixed(5)}|${hover.r.toFixed(5)}|${hover.hit.x.toFixed(5)}|${hover.hit.z.toFixed(5)}|${nightT}`;
    if (!dirty && !live && key === lastKey) return false;
    lastKey = key; dirty = false;
    // into the letter as theirs goes: its stage rises from the bottom over the room, then is all there is
    if (rise > 0 || letter > 0) {
      composite.uniforms.uFade.value = 0;
      poseStage();
      const r = letter > 0 ? 1 : clamp(rise);
      if (r < 1) { pose(); composite.renderRise(scene, camera, stage, stageCam, r); }
      else composite.render(stage, stageCam);
    }
    else { composite.uniforms.uFade.value = 0; pose(); composite.render(scene, camera); }
    const moving = Math.abs(mouse[0].x - pointer.x) + Math.abs(mouse[0].y - pointer.y) > 1e-4 || hover.r > 0;
    return moving;
  }

  let clearStage = false;                                           // (the letter's stage over the page's own sky)
  function setPalette(a, l) {
    U.uShadow.value.set(a); U.uBase.value.set(l);
    outside.setPalette(a);
    stage.background = clearStage ? null : new THREE.Color(a);
    composite.uniforms.uFadeColor.value.set(a);
    scene.background = new THREE.Color(l);
    dirty = true;
  }
  setPalette(accent, lit);

  return {
    renderer, camera, scene, resize, frame, setPalette, ready,
    set u(v) { S = v; }, get u() { return S; },
    set letter(v) { letter = v; }, get letter() { return letter; },
    set rise(v) { rise = v; }, get rise() { return rise; },        // (the letter's stage rising over the room, 0..1)
    set hold(v) { if (held && !v) dirty = true; held = v; },         // (covered: nothing to draw)
    set waitQuiet(f) { waitQuiet = f; },
    get warmState() { return warmState; }, warmed,
    /** the letter's stage with no ground of its own: its blocks float over whatever is behind the canvas */
    set clearStage(v) { clearStage = v; stage.background = v ? null : U.uShadow.value.clone(); dirty = true; },
    pointer(x, y) { pointer.set(x, y); hover.over = true; extras?.pointer(x, y); },
    pointerOut() { hover.over = false; extras?.pointerOut(); },
    // the page's dark mode: the room in night tones (its pages, lit, stay bright)
    night(on) { nightTo = on ? 1 : 0; },
    /** the visitor's palette: the 3D's two tones by day (the night fades from them) */
    setDay(a, l) {
      DAY.a.set(a); DAY.l.set(l);
      setPalette(mixA.copy(DAY.a).lerp(NIGHT.a, nightT).getStyle(), mixL.copy(DAY.l).lerp(NIGHT.l, nightT).getStyle());
    },
    get isNight() { return nightTo > 0.5; },
    pour(a, l) { setPalette(a, l); },
    center() {},                                    // (their picture is not moved into the window: it fills the screen)
    view() {},
    replay() {},
    get stack() { return stack; },
  };
}
