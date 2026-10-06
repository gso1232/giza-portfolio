// What rises off his sheet where the reference's building rises: the Yellow Crane Tower (黄鹤楼, Wuhan), for
// the Egyptian Chinese University he studies at (tools/blender/ych.py: their place, size and motion, frame
// for frame). Its storeys are his site's sections: the ground storey the Hero, then About, his work (the
// third storey is the gallery the top two storeys and the crown lift off: five projects on stands, re-laid two to a row after the red
// pen), Contact under the crown. Until the last section it is drawn in the room's two tones, as theirs is;
// then, storey by storey from the ground, it takes its own colours (yellow roofs, red columns, teal rafters)
// and the panels between its columns take his real pages (their facades).
//
// pose(b): b is their building clip's time (0..25.75 s).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SANS = '"Geist Sans", Geist, system-ui, sans-serif', HAND = '"Architects Daughter", "Segoe Print", cursive';
const SERIF_CN = '"Noto Serif SC", "Songti SC", "SimSun", "STSong", "Microsoft YaHei", serif';
// (decoded off the main thread before it is drawn or sent to the GPU: decoded there, each big one held a frame 0.3 s)
const loadImage = (src) => { const i = new Image(); i.src = src; return i.decode().then(() => i, () => null); };
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function cover(g, img, x, y, w, h, fx = 0.5, fy = 0) {
  if (!img) { g.fillStyle = '#c9b8a2'; g.fillRect(x, y, w, h); return; }
  const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
  g.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, x, y, w, h);
}

export const PROJECTS = {
  duriza: { name: 'Duriza', img: 'duriza' },
  synergy: { name: 'Synergy', img: 'synergy' },
  sondos: { name: 'Sondos', img: 'sondos' },
  adham: { name: 'Adham', img: 'adham-paper' },
  ganeeh: { name: 'Ganeeh', img: 'monopoly-eg' },
};
// what each storey's panels show when the real facades go on: by storey (its motion group) and face
const PAGES = {
  1: { '+x': 'hero', '+z': 'hero', '-x': 'hero', '-z': 'hero' },
  3: { '+x': 'about', '+z': 'tools', '-x': 'about', '-z': 'tools' },
  6: { '+x': 'duriza', '+z': 'synergy', '-x': 'sondos', '-z': 'adham' },
  7: { '+x': 'ganeeh', '+z': 'duriza', '-x': 'synergy', '-z': 'sondos' },
  8: { '+x': 'contact', '+z': 'contact', '-x': 'contact', '-z': 'contact' },
};
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export async function buildYch({ U, paint, edgeMat, palette = { lit: '#f4d3b0', accent: '#b9693b', ink: '#3d2b15' }, name = 'ych' }) {
  const [gltf, info, hero, ...shots] = await Promise.all([
    new GLTFLoader().loadAsync(`./inside/${name}.glb`),
    fetch(`./inside/${name}-info.json`).then((r) => r.json()),
    loadImage('./inside/hero-real.jpg'),
    ...Object.values(PROJECTS).map((p) => loadImage(`./inside/work/live/${p.img}-desk.jpg`)),
    document.fonts?.load(`400 30px ${HAND}`).catch(() => {}),
  ]);
  const img = {}; Object.keys(PROJECTS).forEach((k, i) => { img[k] = shots[i]; });
  const root = gltf.scene;

  // ---- his pages, for the panels ------------------------------------------------------------------------
  const page = (g, x, y, w, h, kind, j) => {
    if (img[kind]) { cover(g, img[kind], x, y, w, h, (j % 4) / 3, (j % 3) * 0.05); return; }
    if (kind === 'hero') { cover(g, hero, x, y, w, h, (j % 4) / 3, 0.3); return; }
    g.fillStyle = kind === 'contact' ? palette.accent : '#f6efe4'; g.fillRect(x, y, w, h);
    g.fillStyle = kind === 'contact' ? '#fbf3e8' : palette.ink;
    const lines = {
      about: [['About', 0.2, 0.3], ['Samy', 0.16, 0.55], ['ECU', 0.14, 0.78]],
      tools: [['Figma', 0.15, 0.35], ['three.js', 0.15, 0.6], ['Blender', 0.15, 0.85]],
      contact: [['Say', 0.2, 0.4], ['hello', 0.2, 0.65]],
    }[kind] || [];
    g.textAlign = 'left';
    for (const [t, s, yy] of lines) { g.font = `600 ${Math.round(h * s)}px ${SANS}`; g.fillText(t, x + w * 0.08, y + h * yy); }
  };
  const A = info.atlas, CW = 96, CH = 128;                // (a panel is taller than wide)
  const atlas = canvasTex(A.cols * CW, A.rows * CH, (g) => {
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, A.cols * CW, A.rows * CH);
    info.cells.forEach(([k, face, j], i) => {
      const x = (i % A.cols) * CW, y = Math.floor(i / A.cols) * CH;
      page(g, x, y, CW, CH, PAGES[k]?.[face] ?? 'hero', j);
    });
  });
  // the lattice before: red frames round panels of fretwork, as the tower's doors are
  const lattice = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#b8a596'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#7d6253'; g.lineWidth = 7;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * W / 6, 0); g.lineTo(i * W / 6, H); g.stroke(); g.beginPath(); g.moveTo(0, i * H / 6); g.lineTo(W, i * H / 6); g.stroke(); }
    g.lineWidth = 14; g.strokeRect(0, 0, W, H);
  });
  // the plaques: 黄鹤楼 in gold on deep blue, a gold frame (read right to left, as the real one is)
  const plaque = canvasTex(1024, 360, (g, W, H) => {
    g.fillStyle = '#1f2f4d'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d9b25a'; g.lineWidth = 26; g.strokeRect(13, 13, W - 26, H - 26);
    g.fillStyle = '#e8c56b'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 230px ${SERIF_CN}`;
    ['楼', '鹤', '黄'].forEach((c, i) => g.fillText(c, W * (0.22 + i * 0.28), H * 0.53));
  });
  const text = (w, h, t, { bg = '#f6efe4', fg = palette.ink, size = 0.58 } = {}) => canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${Math.round(h * size)}px ${SANS}`; g.fillText(t, w / 2, h * 0.54);
  });

  // ---- materials: two tones now, its own colours later (each mesh's materials, by storey) ------------------
  const winMats = {}, colourMats = {};
  const named = {};
  root.traverse((o) => {
    named[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const n = o.name;
    let p = o; while (p && !/^floor_\d$/.test(p.name)) p = p.parent;
    const k = p ? +p.name.split('_')[1] : -1;
    // his work, in the fourth storey: lit as it is shown (the storey's walls would shade it from the low sun)
    let gp = o; while (gp && gp.name !== 'gallery') gp = gp.parent;
    const inGallery = !!gp;
    if (inGallery) { o.receiveShadow = false; o.castShadow = false; }
    let m = null, lines = true;
    if (/^win_\d/.test(n)) {
      m = paint(U, { map: lattice, dress: true, flat: true, noise: 0.25 });
      m.userData.uniforms.tDress.value = atlas;
      m.userData.uniforms.uEdge.value.set('#fbf3e8');
      m.userData.lit = new THREE.MeshBasicMaterial({ map: atlas });    // (its pages lit, at night)
      m.userData.mesh = o;
      (winMats[k] ??= []).push(m);
      o.castShadow = false; lines = false;
    } else if (/^scr_card/.test(n)) {
      const pj = n.split('_')[2];
      m = paint(U, { map: canvasTex(640, 400, (g, W, H) => cover(g, img[pj], 0, 0, W, H)), flat: true, noise: 0.25 });
      lines = false;
    } else if (/^lbl_card/.test(n)) {
      m = paint(U, { map: text(512, 110, PROJECTS[n.split('_')[2]].name), flat: true, noise: 0.25 });
      lines = false;
    } else if (/^plaque/.test(n)) {
      m = paint(U, { map: plaque, flat: true, noise: 0.2 }); lines = false;
    } else {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((mm) => {
        const real = mm.color.clone();
        const grey = new THREE.Color().setScalar(Math.min(1, 0.35 + lum(real) * 0.95));
        const pm = paint(U, { tint: grey.clone(), noise: 0.6, flat: inGallery });
        pm.userData.tone = { grey, real };
        if (k >= 0) (colourMats[k] ??= []).push(pm);
        return pm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    }
    if (m) o.material = m;
    if (lines) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 40), edgeMat));
    o.frustumCulled = false;
  });

  // ---- their motion --------------------------------------------------------------------------------------
  const mixer = new THREE.AnimationMixer(root);
  const acts = gltf.animations.map((c) => { const a = mixer.clipAction(c); a.play(); a.paused = true; return a; });
  const groups = info.groups.map((k) => named[`floor_${k}`]).filter(Boolean);
  const cards = Object.values(named).filter((o) => /^card[AB]_[a-z]+$/.test(o.name));
  const facade = named.facade;
  const order = [0, 1, 3, 6, 7, 8];                       // (the storeys from the ground up)
  // the top two storeys as they lift off: carried on, the same way, out of the shot (hovering beside the tower they
  // still crossed his work in the gallery as they went): their way off it, LID_K times as far
  const LID_K = 3;
  const lids = [named.floor_7, named.floor_8].filter(Boolean);
  for (const a of acts) a.time = 0;
  mixer.update(0);
  const rest = lids.map((o) => o.position.clone());
  let last = -1, nightOn = false;
  function pose(b) {
    if (b === last) return;
    last = b;
    for (const a of acts) a.time = Math.min(b, a.getClip().duration);
    mixer.update(0);
    lids.forEach((o, i) => o.position.sub(rest[i]).multiplyScalar(LID_K).add(rest[i]));
    root.visible = b > 0.02;
    for (const f of groups) f.visible = f.scale.x > 0.002;
    for (const c of cards) c.visible = c.scale.y > 0.02;
    // the real tower, storey by storey from the ground, on their facade clock
    const v = facade ? Math.min(1, facade.scale.x) : 0;
    order.forEach((k, i) => {
      const t = Math.min(1, Math.max(0, v * 1.5 - i * 0.08));
      for (const m of colourMats[k] ?? []) m.color.copy(m.userData.tone.grey).lerp(m.userData.tone.real, t);
      for (const m of winMats[k] ?? []) {
        m.userData.uniforms.uDress.value = Math.min(1, Math.max(0, (t - 0.1) / 0.8));
        if (nightOn) m.userData.mesh.material = m.userData.uniforms.uDress.value > 0.5 ? m.userData.lit : m;
      }
    });
  }
  pose(0);
  // at night (the page's dark mode), the panels that show his pages glow: drawn unlit, in their own colours
  function night(t) {
    const on = t > 0.5;
    if (on === nightOn) return;
    nightOn = on;
    for (const ms of Object.values(winMats)) for (const m of ms) {
      const o = m.userData.mesh;
      o.material = on && m.userData.uniforms.uDress.value > 0.5 ? m.userData.lit : m;
    }
  }
  return { root, pose, info, named, night };
}
