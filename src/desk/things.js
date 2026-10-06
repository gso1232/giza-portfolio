import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The things on and around the desk of the photo (src/desk/ref/desk2-ref.webp),
// each at its real size in centimetres, standing on y = 0 at its own origin.
// One material per mesh throughout (the path tracer mis-maps material lists).

export const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); return o; };

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  return t;
}

export function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** a slab lying in xz, rounded in plan and at its edges, top at y = t */
function slab(w, d, t, r, bevel = 0.1) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, d - 2 * bevel, Math.max(0.05, r - bevel)), {
    depth: t - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 20,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

// a lit screen: its picture as light, under a glass that reflects the room a little
const glowMat = (map, gain = 1) => new THREE.MeshPhysicalMaterial({ color: '#000', emissive: '#fff', emissiveMap: map, emissiveIntensity: gain, roughness: 0.12, clearcoat: 0.35, clearcoatRoughness: 0.08 });

// ---- the laptop: a 16" space-grey laptop, 35.79 x 24.59 x 1.62 --------------------------------------------
/**
 * @param screenMap the page on its screen (16:10)
 * @param lidAngle  degrees from the base, as tools/desk2-fit.py found it
 */
export function laptop({ screenMap, lidAngle = 104 } = {}) {
  const BW = 35.79, BD = 24.59, BT = 1.62, LT = 0.72, LH = 23.9;
  const g = new THREE.Group();
  g.name = 'laptop';
  // silver, bead-blasted anodised aluminium (the user: "more modern"): the lighter finish reads as
  // a current laptop in the warm light, where the space grey went a dull dark slab
  const alu = new THREE.MeshPhysicalMaterial({ color: '#c9cbce', metalness: 1, roughness: 0.36 });
  alu.name = 'aluminium';
  const dark = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.55, name: 'keycap' });
  const well = new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.6, name: 'kbwell' });
  const slot = new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.7, name: 'port' });
  // origin: the base's back-left corner on the desk; x along the hinge, z toward the user
  const base = new THREE.Mesh(slab(BW, BD, BT, 0.9, 0.3), alu);
  base.position.set(BW / 2, 0, BD / 2);
  g.add(base);
  // the thumb notch in the front edge
  const notch = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: '#b9bbbe', metalness: 1, roughness: 0.3 }));
  notch.position.set(BW / 2, BT - 0.25, BD - 0.2);
  g.add(notch);
  // the keyboard well, the keys (one merged mesh), the touch bar
  const kbW = 28.2, kbD = 11.4, kz = 2.2;
  const wellM = new THREE.Mesh(new THREE.PlaneGeometry(kbW + 0.5, kbD + 0.5).rotateX(-Math.PI / 2), well);
  wellM.position.set(BW / 2, BT + 0.003, kz + kbD / 2);
  g.add(wellM);
  const rows = [[1, 14], [1, 13, 1.5], [1.5, 12, 1], [1.8, 11, 1.7], [2.3, 10, 2.3], [1, 1, 1, 1.3, 5.5, 1.3, 1, 3]];
  const U = kbW / 14.6, keyGeos = [];
  rows.forEach((row, ri) => {
    // row: [first key width, count of 1u keys, last key width] (or explicit widths for the bottom row)
    const widths = ri < 5 ? [row[0], ...Array(row[1]).fill(1), ...(row[2] ? [row[2]] : [])] : row;
    const total = widths.reduce((a, b) => a + b, 0);
    let x = BW / 2 - (total * U) / 2;
    const z = kz + 0.2 + (ri === 0 ? 0.55 : 1.3 + (ri - 0.5) * U);
    const depth = ri === 0 ? 0.9 : U - 0.28;
    for (const w of widths) {
      const k = new RoundedBoxGeometry(w * U - 0.28, 0.14, depth, 2, 0.08);
      k.translate(x + (w * U) / 2, BT + 0.07, z);
      keyGeos.push(k);
      x += w * U;
    }
  });
  const keys = new THREE.Mesh(mergeGeometries(keyGeos.map((k) => (k.index ? k.toNonIndexed() : k))), dark);
  g.add(keys);
  // speaker grilles either side of the keys
  const grille = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, map: canvasTex(64, 512, (c) => {
    c.fillStyle = '#c9cbce'; c.fillRect(0, 0, 64, 512);             // (the silver body's)
    c.fillStyle = '#1c1c1e';
    for (let y = 4; y < 512; y += 7) for (let x = 4 + ((y / 7) % 2) * 3; x < 64; x += 7) { c.beginPath(); c.arc(x, y, 1.5, 0, 7); c.fill(); }
  }) });
  for (const sx of [(BW - kbW) / 4 - 0.1, BW - (BW - kbW) / 4 + 0.1]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry((BW - kbW) / 2 - 1.1, kbD).rotateX(-Math.PI / 2), grille);
    s.position.set(sx, BT + 0.003, kz + kbD / 2);
    g.add(s);
  }
  // the trackpad
  // the trackpad: a slab of glass in the body's own silver, a hair smoother
  const pad = new THREE.Mesh(slab(16, 10, 0.02, 0.7, 0.005), new THREE.MeshPhysicalMaterial({ color: '#c3c5c8', metalness: 1, roughness: 0.24, name: 'trackpad' }));
  pad.position.set(BW / 2, BT - 0.012, BD - 1.2 - 5);
  g.add(pad);
  // the lid, hinged at the back edge, leaning back to lidAngle
  const lid = new THREE.Group();
  lid.name = 'lid';
  lid.position.set(0, BT - 0.1, 0.25);
  lid.rotation.x = -((lidAngle - 90) * Math.PI) / 180;
  g.add(lid);
  const shellG = slab(BW, LH, LT, 0.9, 0.2);
  shellG.rotateX(Math.PI / 2);                  // stand up: height along y, thickness along -z
  const shell = new THREE.Mesh(shellG, alu);
  shell.position.set(BW / 2, LH / 2, -LT - 0.01);            // the lid's back: its thickness behind the screen face
  lid.add(shell);
  const face = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(BW - 0.2, LH - 0.2, 0.8), 12), new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.12, clearcoat: 1 }));
  face.position.set(BW / 2, LH / 2, 0.004);
  lid.add(face);
  const DW = 34.5, DH = DW / 1.6;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), screenMap ? glowMat(screenMap, 1.35) : face.material);
  disp.name = 'display';
  disp.position.set(BW / 2, LH - 0.75 - DH / 2, 0.008);
  lid.add(disp);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, BW - 7, 24).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.4, metalness: 0.4 }));
  hinge.position.set(BW / 2, BT - 0.2, 0.3);
  g.add(hinge);
  // the ports in its sides: MagSafe and two Thunderbolt on the left; Thunderbolt, HDMI and the
  // SD slot on the right (the charger goes into the right-hand Thunderbolt, 5 cm from the back)
  const port = (side, z, w, h) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.2, h, w, 2, Math.min(h, w) / 2.2), slot);
    m.position.set(side < 0 ? 0.04 : BW - 0.04, BT / 2, z);
    g.add(m);
  };
  port(-1, 3.2, 1.6, 0.42); port(-1, 5.6, 0.95, 0.34); port(-1, 7.0, 0.95, 0.34);
  port(1, 5.0, 0.95, 0.34); port(1, 7.4, 1.5, 0.5); port(1, 10.2, 2.4, 0.2);
  return shadowed(g);
}

// ---- paper, sticky notes, prints ----------------------------------------------------------------------
/** a flat sheet of paper with a picture on it, facing +z, optionally torn along some edges */
export function sheet(w, h, map, { torn = [], color = '#ffffff', rough = 0.95, seed = 1, curl = 0.15 } = {}) {
  const r = rng(seed);
  const pts = [];
  const edge = (x0, y0, x1, y1, rag) => {
    const n = rag ? 28 : 1;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const j = rag ? (r() - 0.5) * 0.35 : 0;
      const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny);
      pts.push(new THREE.Vector2(x0 + (x1 - x0) * t + (nx / L) * j, y0 + (y1 - y0) * t + (ny / L) * j));
    }
  };
  edge(-w / 2, -h / 2, w / 2, -h / 2, torn.includes('bottom'));
  edge(w / 2, -h / 2, w / 2, h / 2, torn.includes('right'));
  edge(w / 2, h / 2, -w / 2, h / 2, torn.includes('top'));
  edge(-w / 2, h / 2, -w / 2, -h / 2, torn.includes('left'));
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
  // UVs from position, and a faint curl away from the wall at the corners
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, x / w + 0.5, y / h + 0.5);
    p.setZ(i, curl * ((Math.abs(x) / (w / 2)) ** 3 + (Math.abs(y) / (h / 2)) ** 3) * 0.5);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, map, roughness: rough, side: THREE.DoubleSide, name: 'paper' }));
  return shadowed(m);
}

/** a sticky note, 7.6 cm square, a handwritten list on it; its top edge stuck, the rest lifting a little */
export function stickyNote(color, title, lines, { seed = 3 } = {}) {
  const map = canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(0,0,0,0.05)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.04)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f1d33';
    g.font = '700 84px Caveat, cursive';
    g.textAlign = 'center';
    g.fillText(title, W / 2, 104);
    g.beginPath(); g.moveTo(W / 2 - g.measureText(title).width / 2, 122); g.lineTo(W / 2 + g.measureText(title).width / 2, 122);
    g.strokeStyle = '#1f1d33'; g.lineWidth = 5; g.stroke();
    g.textAlign = 'left';
    g.font = '700 64px Caveat, cursive';
    lines.forEach((t, i) => g.fillText(t, 36, 214 + i * 92));
  });
  const geo = new THREE.PlaneGeometry(7.6, 7.6, 12, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = (3.8 - p.getY(i)) / 7.6;            // 0 at the sticky strip, 1 at the bottom
    p.setZ(i, 0.05 + 0.35 * v * v);
  }
  geo.computeVertexNormals();
  return shadowed(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide, name: 'note' })));
}

/** a picture frame: thin black moulding, a white mat, the picture, glass; standing on its foot, leaning back */
export function frame(w, h, map, { moulding = 1.1, depth = 1.6, mat = 3.5, color = '#141414', lean = 0.12, glass = true } = {}) {
  const g = new THREE.Group();
  const f = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const bar = (bw, bh, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, depth), wood); m.position.set(x, y, depth / 2); f.add(m); };
  bar(w, moulding, 0, h - moulding / 2);
  bar(w, moulding, 0, moulding / 2);
  bar(moulding, h - 2 * moulding, -w / 2 + moulding / 2, h / 2);
  bar(moulding, h - 2 * moulding, w / 2 - moulding / 2, h / 2);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, h - 0.4, 0.3), new THREE.MeshStandardMaterial({ color: '#5a4c3e', roughness: 0.9 }));
  back.position.set(0, h / 2, 0.15);
  f.add(back);
  const matM = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * moulding, h - 2 * moulding), new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.95 }));
  matM.position.set(0, h / 2, depth - 0.45);
  f.add(matM);
  const pw = w - 2 * moulding - 2 * mat, ph = h - 2 * moulding - 2 * mat;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
  pic.name = 'picture';
  pic.position.set(0, h / 2, depth - 0.44);
  f.add(pic);
  if (glass) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * moulding, h - 2 * moulding), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 1, thickness: 0.2, ior: 1.5, transparent: true, opacity: 0.12 }));
    gl.name = 'frameGlass';
    gl.position.set(0, h / 2, depth - 0.25);
    f.add(gl);
  }
  f.rotation.x = -lean;
  g.add(f);
  return shadowed(g);
}

/** a small glass frame with thin black edges and a pressed flower between the panes */
export function glassFrame(w = 7.5, h = 9.2, map = null) {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4, metalness: 0.3 });
  const t = 0.35, d = 0.9;
  const bar = (bw, bh, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), black); m.position.set(x, y, 0); g.add(m); };
  bar(w, t, 0, h - t / 2); bar(w, t, 0, t / 2); bar(t, h, -w / 2 + t / 2, h / 2); bar(t, h, w / 2 - t / 2, h / 2);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * t, h - 2 * t, 0.5), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, transmission: 1, thickness: 0.5, ior: 1.5 }));
  glass.position.set(0, h / 2, 0);
  g.add(glass);
  if (map) {
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.62, h * 0.62), new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
    pic.position.set(0, h / 2, 0.01);
    g.add(pic);
  }
  // a little foot behind, so it stands
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h * 0.7, 6), black);
  foot.position.set(0, h * 0.33, -1.6);
  foot.rotation.x = 0.35;
  g.add(foot);
  g.rotation.x = -0.08;
  return shadowed(g);
}

// ---- books ------------------------------------------------------------------------------------------------
/** books lying flat, spines toward +z, bottom first: [{ w, d, t, color }] */
const pageEdges = canvasTex(256, 64, (g, W, H) => {
  g.fillStyle = '#f1ebdd'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(120,105,85,${0.05 + ((y * 7) % 5) * 0.02})`; g.fillRect(0, y, W, 1); }
});
export function bookStack(list, seed = 7) {
  const r = rng(seed);
  const g = new THREE.Group();
  let y = 0;
  for (const b of list) {
    const bk = new THREE.Group();
    const cover = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7, name: 'bookcover' });
    const paper = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, map: pageEdges, name: 'pages' });
    // the page block sits back from the boards' edges (a hardback's squares), so the covers read
    // as two dark lines with the pages' white between them
    const board_t = 0.3, square = 0.35;
    // (from `square` inside the boards' fore-edge back to just short of the spine)
    const block = new THREE.Mesh(new THREE.BoxGeometry(b.w - 2 * square, b.t - 2 * board_t, b.d - square - 0.5), paper);
    block.position.set(0, b.t / 2, (square - 0.5) / 2);
    bk.add(block);
    for (const yy of [board_t / 2, b.t - board_t / 2]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(b.w, board_t, b.d), cover);
      board.position.y = yy;
      bk.add(board);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.t, 0.3), cover);
    spine.position.set(0, b.t / 2, b.d / 2 - 0.15);
    bk.add(spine);
    bk.position.set((r() - 0.5) * 1.2, y, (r() - 0.5) * 1.0);
    bk.rotation.y = (r() - 0.5) * 0.08 + (b.turn ?? 0);          // turn: a book laid the other way round (a real stack is mixed)
    g.add(bk);
    y += b.t;
  }
  return shadowed(g);
}

// ---- pots, the mug, the jar -------------------------------------------------------------------------------
export function pot({ r0 = 5.2, r1 = 6.2, h = 12, color = '#f3f1ec' } = {}) {
  const prof = [[0, 0], [r0, 0], [r0 + 0.2, 0.3], [r1, h - 0.4], [r1 + 0.1, h], [r1 - 0.6, h], [r1 - 0.7, h - 1.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), Object.assign(new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.3 }), { name: 'ceramic' })));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r1 - 0.7, 48).rotateX(-Math.PI / 2), Object.assign(new THREE.MeshStandardMaterial({ color: '#2b2119', roughness: 1 }), { name: 'soil' }));
  soil.position.y = h - 1.5;
  g.add(soil);
  g.userData.top = h - 1.5;
  return shadowed(g);
}

/** a woven rattan basket planter */
export function basket({ r0 = 4.6, r1 = 5.6, h = 12 } = {}) {
  const map = canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#a07e52'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
      const o = (y / 16) % 2 ? 8 : 0;
      const gr = g.createLinearGradient(x + o, y, x + o + 16, y + 16);
      gr.addColorStop(0, '#c9a979'); gr.addColorStop(0.5, '#dcc093'); gr.addColorStop(1, '#8a6a42');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x + o + 8, y + 8, 7.5, 6, 0.6, 0, 7); g.fill();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  const prof = [[0, 0], [r0, 0], [r1, h], [r1 - 0.5, h], [r1 - 0.6, h - 1]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), Object.assign(new THREE.MeshStandardMaterial({ map, roughness: 0.9 }), { name: 'basket' })));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r1 - 0.6, 32).rotateX(-Math.PI / 2), Object.assign(new THREE.MeshStandardMaterial({ color: '#2b2119', roughness: 1 }), { name: 'soil' }));
  soil.position.y = h - 1;
  g.add(soil);
  g.userData.top = h - 1;
  return shadowed(g);
}

/** a stoneware mug, speckled cream with a darker rim, on a round cork coaster */
export function mugOnCoaster() {
  const g = new THREE.Group();
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.5, 64), Object.assign(new THREE.MeshStandardMaterial({ color: '#b08157', roughness: 0.85 }), { name: 'cork' }));
  coaster.position.y = 0.25;
  g.add(coaster);
  const speck = canvasTex(512, 256, (c, W, H) => {
    c.fillStyle = '#e9e3d8'; c.fillRect(0, 0, W, H);
    const r = rng(12);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,70,55,${0.2 + r() * 0.4})`; c.beginPath(); c.arc(r() * W, r() * H, 0.6 + r() * 1.1, 0, 7); c.fill(); }
    c.fillStyle = '#6d5a4a'; c.fillRect(0, 0, W, 10);
  });
  const prof = [[0, 0.1], [4.3, 0.1], [4.6, 0.6], [4.7, 9.4], [4.55, 9.5], [4.25, 9.4], [4.15, 0.9], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), Object.assign(new THREE.MeshPhysicalMaterial({ map: speck, roughness: 0.55, clearcoat: 0.4 }), { name: 'mug' }));
  body.position.y = 0.5;
  g.add(body);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(4.14, 48).rotateX(-Math.PI / 2), Object.assign(new THREE.MeshPhysicalMaterial({ color: '#4a2a14', roughness: 0.05 }), { name: 'tea' }));
  tea.position.y = 0.5 + 7.8;
  g.add(tea);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.45, 12, 32, Math.PI * 1.25), new THREE.MeshPhysicalMaterial({ color: '#e9e3d8', roughness: 0.55, clearcoat: 0.4 }));
  handle.rotation.z = -Math.PI * 0.62;
  handle.position.set(4.7, 5.4, 0);
  g.add(handle);
  return shadowed(g);
}

/** a clear glass jar with water, a plant's stems standing in it */
export function glassJar({ r = 3.3, h = 8.5 } = {}) {
  const prof = [[0, 0], [r - 0.3, 0], [r, 0.4], [r, h - 1.6], [r - 0.7, h - 0.7], [r - 0.7, h], [r - 0.9, h], [r - 0.9, h - 0.7], [r - 0.2, h - 1.6], [r - 0.2, 0.6], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 1, thickness: 0.3, ior: 1.5, attenuationColor: '#dfe9e0', attenuationDistance: 20 })));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.25, r - 0.25, h * 0.55, 48), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.0, transmission: 1, thickness: 5, ior: 1.33, attenuationColor: '#c9dcc4', attenuationDistance: 12 }));
  water.position.y = 0.6 + (h * 0.55) / 2;
  g.add(water);
  g.userData.top = h;
  return shadowed(g);
}

// ---- plants ----------------------------------------------------------------------------------------------
function leafGeometry(shape = 'oval', segs = 8) {
  const g = new THREE.PlaneGeometry(1, 1, segs, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + 0.5, y = p.getY(i);            // x: 0 at the stalk, 1 at the tip
    let w;
    if (shape === 'heart') w = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 0.7 * (1 - x * 0.35) * 1.15;
    else if (shape === 'blade') w = (1 - x) ** 0.6 * Math.min(1, x * 8);
    else w = Math.sin(Math.PI * x) ** 0.85;
    p.setXYZ(i, x, y * w, -0.06 * (y * 2) ** 2 * w - 0.04 * Math.sin(Math.PI * x));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A plant: stems from the soil, each leaning out, carrying leaves.
 * kind 'zz': upright stems with pairs of glossy oval leaflets (Zamioculcas);
 * 'pothos': short trailing stems with heart leaves; 'blades': long thin arching leaves.
 */
export function plant(kind, { seed = 5, stems = 7, height = 30, spread = 0.35, leafSize = 4.5, wall = null } = {}) {
  // wall: the z of the wall behind, in the plant's own coordinates. A plant against a wall grows
  // along it: its stems lean out sideways rather than into it, and a leaf that would reach into
  // it turns out to the room (the user saw leaves vanish into the wall)
  const toWall = (s) => (wall !== null && s < 0 ? s * 0.3 : s);
  const r = rng(seed);
  const g = new THREE.Group();
  const green = kind === 'zz' ? '#1f4a1c' : kind === 'pothos' ? '#2e6a26' : '#3f7a2e';
  const leafMat = new THREE.MeshPhysicalMaterial({ color: green, roughness: kind === 'zz' ? 0.25 : 0.45, clearcoat: kind === 'zz' ? 0.7 : 0.2, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#3d5a24', roughness: 0.6 });
  const leafG = leafGeometry(kind === 'pothos' ? 'heart' : kind === 'blades' ? 'blade' : 'oval');
  const leaves = [];
  const addLeaf = (at, dir, size, twist = 0, width = 0.42) => {
    if (wall !== null) {
      const d = dir.clone().normalize();
      if (at.z + d.z * size < wall + 0.8 + size * width * 0.6) { dir = d.setZ(Math.abs(d.z) + 0.35).normalize(); }
    }
    const m = new THREE.Mesh(leafG, leafMat);
    m.scale.set(size, size * width, size);
    m.position.copy(at);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    m.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), twist));
    g.add(m);
    leaves.push(m);
  };
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + r() * 0.6;
    const lean = spread * (0.4 + r() * 0.8);
    const H = height * (0.55 + r() * 0.45);
    if (kind === 'blades') {
      // one long leaf per 'stem', arching out and down
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        pts.push(new THREE.Vector3(Math.cos(a) * t * H * lean * 1.2, H * (t - 0.35 * t * t * lean * 2), Math.sin(a) * t * H * lean * 1.2));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const n = 24, w = 0.9 + r() * 0.5;
      const pos = [], idx = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n, c = curve.getPoint(t), tan = curve.getTangent(t);
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(w * (1 - t) ** 0.7 * 0.5);
        pos.push(c.x - side.x, c.y - side.y, c.z - side.z, c.x + side.x, c.y + side.y, c.z + side.z);
        if (k < n) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      bg.setIndex(idx);
      bg.computeVertexNormals();
      const m = new THREE.Mesh(bg, leafMat);
      g.add(m);
      leaves.push(m);
      continue;
    }
    const sa = toWall(Math.sin(a));
    const dir = new THREE.Vector3(Math.cos(a) * lean, 1, sa * lean).normalize();
    // stems rise, then arch outward (more so for the leaning ones)
    const out = new THREE.Vector3(Math.cos(a), 0, sa).multiplyScalar(H * lean * 0.3);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(H * 0.55), dir.clone().multiplyScalar(H).add(out).add(new THREE.Vector3(0, -H * lean * 0.08, 0)));
    const stem = new THREE.TubeGeometry(curve, 16, kind === 'zz' ? 0.5 : 0.15, 8);
    if (kind === 'zz') {
      // a ZZ's stalk is swollen at the soil and thins to the tip
      const p = stem.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i <= 16; i++) {
        curve.getPoint(i / 16, c);
        const k = 1 - 0.62 * (i / 16) ** 0.8;
        for (let j = 0; j <= 8; j++) { const n = i * 9 + j; v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c); p.setXYZ(n, v.x, v.y, v.z); }
      }
      stem.computeVertexNormals();
    }
    g.add(new THREE.Mesh(stem, stemMat));
    if (kind === 'zz') {
      // leaflets in opposite pairs along the upper two thirds, smaller toward the tip, pointing
      // up along the stalk the way a ZZ's do (not out flat)
      const pairs = 5 + Math.floor(r() * 3);
      for (let k = 0; k < pairs; k++) {
        const t = 0.35 + (k / pairs) * 0.62;
        const at = curve.getPoint(t), tan = curve.getTangent(t);
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(Math.cos(a + 1.3), 0, Math.sin(a + 1.3))).normalize();
        const size = leafSize * (1.05 - 0.35 * (k / pairs));
        for (const sgn of [-1, 1]) addLeaf(at, side.clone().multiplyScalar(sgn).add(tan.clone().multiplyScalar(1.1)).setY(0.25 + tan.y * 0.6), size, sgn * 0.25, 0.42);
      }
      addLeaf(curve.getPoint(1), curve.getTangent(1), leafSize * 0.6, 0, 0.45);
    } else {
      // pothos: a leaf at the end of each stem and one or two along it
      for (const t of [0.55, 1]) {
        const at = curve.getPoint(t);
        const out = new THREE.Vector3(Math.cos(a), -0.2 - r() * 0.3, Math.sin(a));
        addLeaf(at, out, leafSize * (0.8 + r() * 0.4), (r() - 0.5) * 0.8, 1.0);
      }
    }
  }
  g.userData.leaves = leaves;
  return shadowed(g);
}

/**
 * A pothos trailing from a small pot: vines going out over the pot's rim and
 * hanging down (for a shelf), heart leaves along them, alternate, smaller toward
 * the tips. Its leaves are listed in userData.leaves for the breeze.
 */
export function trailingPlant({ seed = 8, vines = 7, drop = 34, leafSize = 3.6, front = new THREE.Vector3(0, 0, 1), floor = null, wall = -Infinity, arc = [0, Math.PI * 2], pot = null } = {}) {
  // pot: { r0, r1, h } the planter below it (its rim 1 above the plant's origin): a leaf hanging
  // down its side stays outside it
  // arc: the directions (angles round y, from +x toward +z) its vines may go
  // floor(x, z): the height of what it stands on at a point (its own coordinates), or -Infinity
  // past its edge; a vine lies along it and falls only over the edge, and the leaves on it lie
  // flat. wall: the z of the wall behind, which no vine goes into
  const ground = floor ?? (() => -Infinity);
  // a leaf that would cut into the board or the wall is moved clear, the shortest way out
  // (up onto the board, or out past its front, or past either end, and off the wall)
  const settle = (m) => {
    if (!floor && wall === -Infinity && !pot) return;
    m.updateMatrix();
    const a = m.geometry.attributes.position, v = new THREE.Vector3();
    const push = { y: 0, z: 0, x: 0, nx: 0 };
    let wallPush = 0;
    for (let k = 0; k < a.count; k++) {
      v.fromBufferAttribute(a, k).applyMatrix4(m.matrix);
      wallPush = Math.max(wallPush, wall + 0.3 - v.z);
      const f = ground(v.x, v.z);
      if (f === -Infinity || v.y > f + 0.1 || v.y < f - 2.7) continue;   // not in the board
      push.y = Math.max(push.y, f + 0.1 - v.y);
      for (const [key, sign] of [['z', 1], ['x', 1], ['nx', -1]]) {
        const c = key === 'z' ? v.z : v.x;
        let d = 0.1;                                                        // how far to go to leave the board this way
        for (let s = 0.2; s < 40; s += 0.2) if (ground(key === 'z' ? v.x : v.x + sign * s, key === 'z' ? c + s : v.z) === -Infinity) { d = s + 0.1; break; }
        push[key] = Math.max(push[key], d);
      }
    }
    const [best] = Object.entries(push).filter(([, d]) => d > 0).sort((p, q) => p[1] - q[1]);
    if (best) { if (best[0] === 'y') m.position.y += best[1]; else if (best[0] === 'z') m.position.z += best[1]; else m.position.x += best[0] === 'x' ? best[1] : -best[1]; }
    if (wallPush > 0) m.position.z += wallPush;
    if (pot) {
      // out of the planter's side, straight away from its axis
      m.updateMatrix();
      let out = 0;
      const c = new THREE.Vector3().setFromMatrixPosition(m.matrix).setY(0);
      for (let k = 0; k < a.count; k++) {
        v.fromBufferAttribute(a, k).applyMatrix4(m.matrix);
        const rim = pot.rim ?? 1;                                       // the rim, above the plant's origin
        if (v.y > rim + 0.2 || v.y < rim - pot.h) continue;
        const rr = pot.r0 + ((v.y - (rim - pot.h)) / pot.h) * (pot.r1 - pot.r0) + 0.3;
        out = Math.max(out, rr - Math.hypot(v.x, v.z));
      }
      if (out > 0 && c.lengthSq() > 1e-6) m.position.addScaledVector(c.normalize(), out);
    }
  };
  const r = rng(seed);
  const g = new THREE.Group();
  const leafMat = new THREE.MeshPhysicalMaterial({ color: '#2f6a27', roughness: 0.42, clearcoat: 0.3, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4f6b2e', roughness: 0.6 });
  const leafG = leafGeometry('heart');
  const leaves = [];
  for (let v = 0; v < vines; v++) {
    const span = arc[1] - arc[0];
    const a = span >= Math.PI * 2 - 1e-6 ? (v / vines) * Math.PI * 2 + r() * 0.5 : arc[0] + ((v + 0.5) / vines) * span + (r() - 0.5) * 0.25;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    // the vines toward the front fall furthest, the back ones stay short, over the rim
    const toFront = Math.max(0, out.dot(front));
    const len = drop * (0.35 + 0.75 * toFront) * (0.7 + r() * 0.5);
    const pts = [new THREE.Vector3(0, 0, 0), out.clone().multiplyScalar(4).setY(2.5), out.clone().multiplyScalar(7.5).setY(0.5)];
    const n = 6;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      pts.push(out.clone().multiplyScalar(8.5 + t * 3 + (r() - 0.5) * 2).add(new THREE.Vector3((r() - 0.5) * 2, -t * len, (r() - 0.5) * 2)));
    }
    for (const p of pts) { p.z = Math.max(p.z, wall + 1.2); p.y = Math.max(p.y, ground(p.x, p.z) + 0.25); }
    let curve = new THREE.CatmullRomCurve3(pts);
    if (floor) {
      // the smooth curve can cut the board's edge between a point on it and the next one
      // below: follow it closely and keep it on the board until it is past the edge
      const dense = curve.getPoints(96);
      for (const p of dense) { const f = ground(p.x, p.z); if (f > -Infinity && p.y < f + 0.25 && p.y > f - 2.8) p.y = f + 0.25; }
      curve = new THREE.CatmullRomCurve3(dense);
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, floor ? 120 : 48, 0.12, 5), stemMat));
    const count = Math.round(4 + (len / 2.8));
    for (let k = 1; k <= count; k++) {
      const t = k / (count + 1);
      const at = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0));
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize().multiplyScalar(k % 2 ? 1 : -1);
      const dir = side.clone().add(out.clone().multiplyScalar(0.6)).add(new THREE.Vector3(0, -0.35, 0)).normalize();
      const m = new THREE.Mesh(leafG, leafMat);
      const s = leafSize * (1.05 - 0.4 * t) * (0.85 + r() * 0.3);
      m.scale.set(s, s, s);
      m.position.copy(at);
      const twist = (r() - 0.5) * 1.2 + (k % 2 ? 0.5 : -0.5);
      if (at.z < wall + s * 1.3 && dir.z < 0.2) { dir.z = Math.abs(dir.z) + 0.3; dir.normalize(); }   // near the wall: it grows out into the room
      const f = ground(at.x, at.z);
      if (at.y < f + s * 0.6) {
        // resting on the shelf: flat on it, its tip along the vine's side, a little above the board
        const x = new THREE.Vector3(dir.x, 0, dir.z).normalize(), z = new THREE.Vector3(0, 1, 0), y = new THREE.Vector3().crossVectors(z, x);
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        m.position.y = f + 0.45;
        m.userData.resting = true;                                         // a breeze doesn't lift it
      } else m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), twist));
      settle(m);
      g.add(m);
      leaves.push(m);
    }
  }
  // a few leaves up on the pot itself
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2;
    const m = new THREE.Mesh(leafG, leafMat);
    const s = leafSize * (0.9 + r() * 0.3);
    m.scale.set(s, s, s);
    m.position.set(Math.cos(a) * 2, 1, Math.sin(a) * 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(Math.cos(a), 0.8, Math.sin(a)).normalize());
    g.add(m);
    leaves.push(m);
  }
  g.userData.leaves = leaves;
  return shadowed(g);
}

/** a floating oak shelf, its fixing hidden, the top at y = 0 */
export function floatingShelf({ w = 50, d = 18, t = 2.6 } = {}) {
  const oak = canvasTex(1024, 128, (c, W, H) => {
    c.fillStyle = '#c9a57a'; c.fillRect(0, 0, W, H);
    const r = rng(23);
    for (let i = 0; i < 180; i++) {
      const y = r() * H;
      c.strokeStyle = r() < 0.6 ? `rgba(120,80,45,${0.05 + r() * 0.08})` : `rgba(255,235,205,${0.05 + r() * 0.06})`;
      c.lineWidth = 0.5 + r() * 1.8;
      c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) c.lineTo(x, y + Math.sin(x / (120 + r() * 60) + i) * 2);
      c.stroke();
    }
  });
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 2, 0.25), new THREE.MeshPhysicalMaterial({ map: oak, roughness: 0.5, clearcoat: 0.15 }));
  m.position.set(0, -t / 2, d / 2);
  const g = new THREE.Group();
  g.add(m);
  return shadowed(g);
}

/** a book's spine: its title along it (read top to bottom) and the author, set in type of my own */
function spineTex(b) {
  const S = 44;                                           // px per cm
  const w = Math.round(b.t * S), h = Math.round(b.h * S);
  return canvasTex(w, h, (g) => {
    g.fillStyle = b.color; g.fillRect(0, 0, w, h);
    // a faint wear along the spine's edges
    const e = g.createLinearGradient(0, 0, w, 0);
    e.addColorStop(0, 'rgba(0,0,0,0.18)'); e.addColorStop(0.12, 'rgba(0,0,0,0)'); e.addColorStop(0.88, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = e; g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, 0);
    g.rotate(Math.PI / 2);
    g.fillStyle = b.ink;
    g.textBaseline = 'middle';
    const fit = (text, font, max) => { let size = parseFloat(font); g.font = font; while (g.measureText(text).width > max && size > 8) { size -= 1; g.font = font.replace(/\d+px/, size + 'px'); } };
    // the title in the top two thirds, the author at the foot, never touching
    fit(b.title, `${b.weight ?? 700} ${Math.round(w * 0.36)}px ${b.font ?? 'Poppins'}`, h * 0.6);
    g.fillText(b.title, h * 0.06, 0);
    fit(b.author, `500 ${Math.round(w * 0.2)}px Poppins`, h * 0.24);
    const aw = g.measureText(b.author).width;
    g.globalAlpha = 0.8;
    g.fillText(b.author, h * 0.95 - aw, 0);
    g.restore();
  });
}

/** books standing in a row on a shelf, spines to +z: [{ h, t, d, color, ink, title, author }] left to right */
export function bookRow(list, { lean = 0 } = {}) {
  const g = new THREE.Group();
  let x = 0;
  list.forEach((b, i) => {
    const bk = new THREE.Group();
    const cover = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.62 });
    const paper = new THREE.MeshStandardMaterial({ color: '#efe8da', roughness: 0.95 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(b.t - 0.3, b.h - 0.4, b.d - 0.3), paper);
    block.position.set(0, b.h / 2, -0.15);
    bk.add(block);
    for (const sx of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, b.h, b.d), cover);
      board.position.set((sx * (b.t - 0.15)) / 2, b.h / 2, 0);
      bk.add(board);
    }
    const spine = new THREE.Mesh(new THREE.PlaneGeometry(b.t, b.h), new THREE.MeshStandardMaterial({ map: spineTex(b), roughness: 0.55 }));
    spine.position.set(0, b.h / 2, b.d / 2 + 0.01);
    bk.add(spine);
    const last = i === list.length - 1;
    if (last && lean) {
      bk.rotation.z = -lean;
      bk.position.set(x + b.t / 2 + Math.sin(lean) * b.h * 0.5, 0, 0);
    } else bk.position.set(x + b.t / 2, 0, 0);
    g.add(bk);
    x += b.t + 0.15;
  });
  return shadowed(g);
}

/**
 * An open sketchbook (a croquis), lying flat: two pages of how he builds a site, in
 * pencil and a fine black pen: the home page's wireframe, the flow between pages,
 * component sketches, notes and a snippet of the code. w x d is the open spread.
 */
export function openSketchbook({ w = 42, d = 29.7 } = {}) {
  const g = new THREE.Group();
  const page = (side) => canvasTex(1400, 1980, (c, W, H) => {
    c.fillStyle = '#f7f4ec'; c.fillRect(0, 0, W, H);
    const r = rng(side === 'L' ? 41 : 43);
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(120,105,85,${r() * 0.035})`; c.fillRect(r() * W, r() * H, 2, 2); }
    // the shade toward the spine
    const gr = side === 'L' ? c.createLinearGradient(W, 0, W - 140, 0) : c.createLinearGradient(0, 0, 140, 0);
    gr.addColorStop(0, 'rgba(80,65,50,0.12)'); gr.addColorStop(1, 'rgba(80,65,50,0)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const pencil = (a = 0.95, wdt = 6) => { c.strokeStyle = `rgba(30,28,34,${a})`; c.lineWidth = wdt; c.lineCap = 'round'; c.lineJoin = 'round'; };
    const ln = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0 + (r() - 0.5) * 3, y0 + (r() - 0.5) * 3); c.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 6, (y0 + y1) / 2 + (r() - 0.5) * 6, x1 + (r() - 0.5) * 3, y1 + (r() - 0.5) * 3); c.stroke(); };
    const box = (x, y, w, h) => { ln(x, y, x + w, y); ln(x + w, y, x + w, y + h); ln(x + w, y + h, x, y + h); ln(x, y + h, x, y); };
    const cross = (x, y, w, h) => { box(x, y, w, h); ln(x, y, x + w, y + h); ln(x + w, y, x, y + h); };
    const txt = (s, x, y, size = 44, ink = '#1c1a30', weight = 700) => { c.fillStyle = ink; c.font = `${weight} ${Math.round(size * 1.3)}px Caveat, cursive`; c.fillText(s, x, y); };
    const arrow = (x0, y0, x1, y1) => { ln(x0, y0, x1, y1); const a = Math.atan2(y1 - y0, x1 - x0); ln(x1, y1, x1 - 22 * Math.cos(a - 0.4), y1 - 22 * Math.sin(a - 0.4)); ln(x1, y1, x1 - 22 * Math.cos(a + 0.4), y1 - 22 * Math.sin(a + 0.4)); };
    if (side === 'L') {
      txt('portfolio v3 — home', 150, 170, 64, '#26243a', 700);
      pencil(0.3, 3); for (let x = 150; x <= 1250; x += 92) ln(x, 230, x, 1260);         // the 12-column grid, faint
      pencil();
      box(150, 230, 1100, 1030);                                     // the page
      ln(150, 320, 1250, 320); txt('logo', 180, 290, 40); txt('work  about  contact', 820, 290, 40);
      cross(210, 380, 980, 430);                                     // hero: the desk render
      txt('hero = the desk (4K render, live)', 260, 870, 46, '#b0332a');
      for (let i = 0; i < 3; i++) cross(210 + i * 340, 920, 300, 240);   // project cards
      txt('cards → hover lifts, 200ms', 220, 1220, 40);
      // the flow, below
      txt('flow', 150, 1400, 60, '#26243a', 700);
      const nodes = [['home', 170], ['dive into screen', 450], ['work', 860], ['case study', 1060]];
      nodes.forEach(([s, x], i) => { box(x - 20, 1450, s.length * 22 + 40, 90); txt(s, x, 1510, 42); if (i) arrow(nodes[i - 1][1] + nodes[i - 1][0].length * 22 + 30, 1495, x - 30, 1495); });
      txt('scroll = camera moves in, no page reloads', 170, 1660, 44);
      txt('test on a real phone!', 170, 1740, 44, '#b0332a');
    } else {
      txt('components', 150, 170, 60, '#26243a', 700);
      pencil();
      // buttons
      c.beginPath(); c.roundRect(170, 230, 300, 90, 45); c.stroke(); txt('primary', 250, 290, 40);
      c.beginPath(); c.roundRect(520, 230, 300, 90, 45); c.stroke(); txt('ghost', 610, 290, 40);
      // a card
      box(170, 380, 420, 420); cross(200, 410, 360, 220); ln(200, 680, 520, 680); ln(200, 730, 440, 730);
      txt('card', 620, 420, 44);
      // a phone
      c.beginPath(); c.roundRect(900, 360, 300, 600, 40); c.stroke(); cross(930, 440, 240, 200); ln(930, 690, 1150, 690); ln(930, 740, 1080, 740);
      c.beginPath(); c.roundRect(960, 860, 180, 60, 30); c.stroke(); txt('mobile first', 900, 1020, 42);
      // type scale
      txt('type: 64 / 40 / 24 / 16', 170, 900, 44);
      txt('space: 8 · 16 · 24 · 48', 170, 970, 44);
      // a snippet of the code, in pen
      c.fillStyle = '#12141c'; c.font = '600 44px "JetBrains Mono", monospace';
      ['const stage = createStage(canvas, {', '  unlit, lit, leaves,', '});', 'screen.place(scene.screen);', 'onScroll(() => dive(t));'].forEach((s, i) => c.fillText(s, 170, 1180 + i * 58));
      txt('perf: 60fps, LCP < 2s', 170, 1560, 46, '#b0332a');
      txt('a11y: contrast, focus, alt', 170, 1640, 46);
      txt('ship it', 1000, 1800, 70, '#26243a', 700);
      pencil(0.95, 7); ln(990, 1830, 1260, 1822);
    }
  });
  const cover = new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.7 });
  const board = new THREE.Mesh(slab(w + 1.2, d + 1.0, 0.35, 0.4, 0.08), cover);
  g.add(board);
  for (const [side, sx] of [['L', -1], ['R', 1]]) {
    // each half: a block of pages, its top a little domed toward the spine
    const pw = w / 2 - 0.3;
    const geo = new THREE.PlaneGeometry(pw, d, 16, 1).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    // u: 0 at the spine, 1 at the outer edge. The page rises out of the gutter and lies nearly
    // flat, always above its block of pages (it sank into it before, and the drawings looked cut)
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / pw + 0.5; const u = sx < 0 ? 1 - x : x; p.setY(i, 1.22 + 0.4 * Math.sin(Math.min(1, u * 4) * Math.PI / 2) - 0.08 * u); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: page(side), roughness: 0.92 }));
    m.position.set(sx * (pw / 2 + 0.3), 0, 0);
    g.add(m);
    const block = new THREE.Mesh(new THREE.BoxGeometry(pw, 1.1, d - 0.2), new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.95 }));
    block.position.set(sx * (pw / 2 + 0.3), 0.65, 0);
    g.add(block);
  }
  // the spiral down the middle
  const wire = new THREE.MeshStandardMaterial({ color: '#8f949b', metalness: 1, roughness: 0.3 });
  const ring = new THREE.TorusGeometry(0.7, 0.07, 8, 24).rotateY(Math.PI / 2);
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(ring, wire);
    m.rotation.x = Math.PI / 2;
    m.position.set(0, 1.25, -d / 2 + 0.8 + i * ((d - 1.6) / 29));
    g.add(m);
  }
  return shadowed(g);
}

// ---- the phone, the notebook, pens --------------------------------------------------------------------
export function phone(screenMap = null) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(slab(7.81, 16.08, 0.78, 1.1, 0.2), new THREE.MeshPhysicalMaterial({ color: '#1b1c1f', metalness: 0.7, roughness: 0.3 }));
  g.add(body);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(7.65, 15.9, 1.05), 12).rotateX(-Math.PI / 2), screenMap ? glowMat(screenMap, 0.2) : new THREE.MeshPhysicalMaterial({ color: '#060607', roughness: 0.05, clearcoat: 1 }));
  glass.position.y = 0.79;
  g.add(glass);
  return shadowed(g);
}

export function notebook({ w = 17, d = 23, t = 1.4 } = {}) {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(slab(w, d, t, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 }));
  g.add(cover);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.6, t + 0.05, d + 0.05), new THREE.MeshStandardMaterial({ color: '#2d2d2f', roughness: 0.6 }));
  band.position.set(w / 2 - 2, t / 2, 0);
  g.add(band);
  return shadowed(g);
}

export function pen(color = '#b3262a', len = 14) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 16).rotateZ(Math.PI / 2), m);
  body.position.y = 0.45;
  g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 16).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9c9c9', metalness: 1, roughness: 0.3 }));
  tip.position.set(len / 2 + 0.6, 0.45, 0);
  g.add(tip);
  return shadowed(g);
}

// ---- an engineer's drawing tools: a drafting pencil, a fineliner, a steel rule ---------------------------
const steel = () => new THREE.MeshPhysicalMaterial({ color: '#b9bcc0', metalness: 1, roughness: 0.28 });
/** lathe a profile [[r, x]...] along +x (0 = the back end), lying on the desk */
function turned(profile, mat, segs = 24) {
  const geo = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r, x)), segs).rotateZ(-Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}
/** a 0.5 mm drafting pencil: a matt black hexagonal metal barrel, a knurled grip, a steel cone and sleeve, a clip */
export function draftingPencil() {
  const g = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: '#17181a', metalness: 0.6, roughness: 0.45 });
  const R = 0.42;
  // the barrel: hexagonal (6 segments), so it can't roll off the desk
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 9.8, 6).rotateZ(-Math.PI / 2), black);
  barrel.position.x = 1.2 + 4.9;                                    // from the cap to the grip
  g.add(barrel);
  // the back: a steel push button and a black cap
  g.add(turned([[0, 0], [0.3, 0], [0.33, 0.1], [0.33, 1.2], [0, 1.2]], steel()));
  // the knurled grip: rings of steel with dark grooves
  const grip = new THREE.Group();
  const knurl = steel();
  for (let i = 0; i < 36; i++) {
    // fine knurling: steel lands with narrow dark grooves between them
    const ring = turned([[R * 0.9, 0], [R * 0.97, 0.02], [R * 0.97, 0.08], [R * 0.9, 0.1]], knurl, 20);
    ring.position.x = 11 + i * 0.1;
    grip.add(ring);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, 3.6, 20).rotateZ(-Math.PI / 2), black);
  core.position.x = 12.8;
  grip.add(core);
  g.add(grip);
  // the cone, the long thin sleeve and a lead
  const cone = turned([[R, 0], [0.12, 1.3], [0.06, 1.35], [0.06, 1.35]], steel());
  cone.position.x = 14.6;
  g.add(cone);
  const sleeve = turned([[0.055, 0], [0.05, 0.4], [0, 0.4]], steel(), 12);
  sleeve.position.x = 15.9;
  g.add(sleeve);
  // the clip along the top
  const clip = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.28), steel());
  clip.position.set(3.2, R + 0.12, 0);
  g.add(clip);
  g.children.forEach((c) => (c.position.y += R));
  return shadowed(g);
}
/** a 0.3 fineliner: a black barrel and cap end, a grey grip, a thin steel tube tip */
export function fineliner() {
  const g = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: '#0f0f10', roughness: 0.35, clearcoat: 0.6 });
  const grey = new THREE.MeshStandardMaterial({ color: '#5e6064', roughness: 0.6 });
  const body = turned([[0, 0], [0.42, 0.05], [0.44, 0.6], [0.44, 11.5], [0.4, 11.6], [0, 11.6]], black);
  g.add(body);
  const grip = turned([[0.4, 0], [0.42, 0.2], [0.42, 1.6], [0.3, 2.4], [0.12, 2.6], [0, 2.6]], grey);
  grip.position.x = 11.6;
  g.add(grip);
  const tube = turned([[0.045, 0], [0.04, 0.5], [0, 0.5]], steel(), 12);
  tube.position.x = 14.2;
  g.add(tube);
  // a ring of grey on the cap end, where the cap sits when it's posted
  const band = turned([[0.45, 0], [0.45, 0.3], [0, 0.3]], grey);
  band.position.x = 1.2;
  g.add(band);
  g.children.forEach((c) => (c.position.y += 0.44));
  return shadowed(g);
}
/** a 15 cm stainless steel rule: brushed, with engraved millimetre marks and numbers */
export function steelRule(len = 15) {
  const marks = canvasTex(2048, 128, (c, W, H) => {
    c.fillStyle = '#c6c9cc'; c.fillRect(0, 0, W, H);
    const r = rng(33);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${r() < 0.5 ? 255 : 90},${r() < 0.5 ? 255 : 95},${r() < 0.5 ? 255 : 100},0.06)`; c.fillRect(r() * W, r() * H, 40 + r() * 200, 1); }
    c.fillStyle = '#2b2d30';
    const mm = (W - 40) / (len * 10 + 4);
    for (let i = 0; i <= len * 10; i++) {
      const x = 20 + (i + 2) * mm, h = i % 10 === 0 ? 46 : i % 5 === 0 ? 32 : 20;
      c.fillRect(x, 0, 2, h);
      if (i % 10 === 0 && i) { c.font = '600 26px Poppins'; c.fillText(String(i / 10), x + 4, 78); }
    }
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.05, 1.8), [steel(), steel(), new THREE.MeshPhysicalMaterial({ map: marks, metalness: 1, roughness: 0.3 }), steel(), steel(), steel()]);
  m.position.y = 0.025;
  const g = new THREE.Group();
  g.add(m);
  return shadowed(g);
}

// ---- the chair: a mid-century desk chair seen from behind, as in the photo --------------------------------------
// a thick curved backrest band upholstered in charcoal fabric, rounded all round, and
// behind it (toward the camera) the bent walnut plywood frame that carries it: a
// strip 9 cm wide screwed to the band's back and curving down to the seat
export function chairBack({ width = 58, height = 15, radius = 30, thick = 4.6, frameAt = 0.72, frameDrop = 44, floorY = -69 } = {}) {
  const g = new THREE.Group();
  const arc = width / radius;
  const fabricMap = canvasTex(512, 128, (c, W, H) => {
    c.fillStyle = '#26292a'; c.fillRect(0, 0, W, H);
    const r = rng(31);
    for (let i = 0; i < 9000; i++) { const v = 25 + r() * 30; c.fillStyle = `rgba(${v},${v + 2},${v + 3},0.55)`; c.fillRect(r() * W, r() * H, 1.5, 1.5); }
  });
  fabricMap.wrapS = fabricMap.wrapT = THREE.RepeatWrapping;
  fabricMap.repeat.set(6, 2);
  const fabric = new THREE.MeshStandardMaterial({ color: '#ffffff', map: fabricMap, roughness: 0.97 });
  const walnut = new THREE.MeshPhysicalMaterial({ color: '#50301b', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  fabric.name = 'fabric'; walnut.name = 'walnut';                  // (Blender gives them a real weave and grain)
  // the band: a rounded-rectangle section swept round the curve
  const R0 = radius - thick / 2, R1 = radius + thick / 2, h2 = height / 2, cr = Math.min(thick / 2, 2.1);
  const prof = [];
  const corner = (cx, cy, a0) => { for (let i = 0; i <= 10; i++) { const a = a0 + (i / 10) * (Math.PI / 2); prof.push(new THREE.Vector2(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr)); } };
  corner(R1 - cr, -h2 + cr, -Math.PI / 2);
  corner(R1 - cr, h2 - cr, 0);
  corner(R0 + cr, h2 - cr, Math.PI / 2);
  corner(R0 + cr, -h2 + cr, Math.PI);
  prof.push(prof[0].clone());
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96, -arc / 2, arc), fabric));
  // its ends, rounded off
  for (const s of [-1, 1]) {
    const t = (s * arc) / 2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fabric);
    cap.scale.set(thick / 2, h2 - 0.3, thick / 2);
    cap.position.set(Math.sin(t) * radius, 0, Math.cos(t) * radius);
    g.add(cap);
  }
  // the walnut frame behind the band, one each side: a curved plywood strip, its top edge
  // just under the band's top, bending back and down to the seat's back corner
  const t0 = (arc / 2) * frameAt;
  const stripW = 10 / radius;
  const sprof = [];
  const Rw = R1 + 0.8;
  for (let i = 0; i <= 24; i++) {
    const v = i / 24;                                          // 0 at the top, 1 at the bottom
    const y = h2 - 2.5 - v * (frameDrop);
    const inward = -10 * Math.sin(v * Math.PI * 0.5) ** 2;     // curls in under the band toward the seat, as a bent shell does
    sprof.push(new THREE.Vector2(Rw + inward, y));
  }
  for (let i = 24; i >= 0; i--) sprof.push(new THREE.Vector2(sprof[i].x + 1.3, sprof[i].y));
  sprof.push(sprof[0].clone());
  const steelMat = new THREE.MeshStandardMaterial({ color: '#bdbdbd', metalness: 1, roughness: 0.3 });
  steelMat.name = 'screw';
  for (const side of [1, -1]) {
    const ts = side * t0;
    g.add(new THREE.Mesh(new THREE.LatheGeometry(sprof, 16, ts - stripW / 2, stripW), walnut));
    // two screws through it into the band
    for (const dt of [-stripW * 0.25, stripW * 0.25]) {
      const t = ts + dt;
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 16).rotateX(Math.PI / 2), steelMat);
      sc.position.set(Math.sin(t) * (Rw + 1.4), h2 - 5 + (dt > 0 ? 0.8 : 0), Math.cos(t) * (Rw + 1.4));
      sc.rotation.y = t;
      g.add(sc);
    }
  }
  // the lathe's middle is at +z: shift it to the origin; the concave side faces -z, the desk
  g.children.forEach((c) => (c.position.z -= radius));

  // the rest of the chair, below the desk's edge (a phone's taller frame sees it): the seat,
  // a walnut plywood shell with a charcoal cushion on it, where the strips come down, and four
  // tapered walnut legs, splayed a little, down to the floor
  const stripBottom = h2 - 2.5 - frameDrop;                    // the strips end at the seat's back corners
  const seatTop = stripBottom + 1.5, seatW = 2 * Math.sin(t0) * (Rw - 10) + 8, seatD = 44;
  const zBack = Math.cos(t0) * (Rw - 10) - radius - 2;        // the strips' feet, in these coordinates
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(seatW - 1, 5, seatD - 1, 4, 2.2), fabric);
  cushion.position.set(0, seatTop - 2.5, zBack - seatD / 2 + 3);
  cushion.name = 'seatCushion';
  g.add(cushion);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(seatW, 1.6, seatD, 3, 0.7), walnut);
  shell.position.set(0, seatTop - 5.8, zBack - seatD / 2 + 3);
  shell.name = 'seatShell';
  g.add(shell);
  const legTop = seatTop - 6.6, legLen = legTop - floorY;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const top = new THREE.Vector3(sx * (seatW / 2 - 4), legTop, shell.position.z + sz * (seatD / 2 - 4));
    const foot = top.clone().add(new THREE.Vector3(sx * 3.5, -legLen, sz * 4));
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.0, top.distanceTo(foot), 20), walnut);
    leg.position.copy(top).add(foot).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    leg.name = 'chairLeg';
    g.add(leg);
  }
  return shadowed(g);
}

/** a white fluffy throw, bunched: a few squashed spheres with a fleecy texture */
export function throwBlanket(seed = 4) {
  const r = rng(seed);
  const map = canvasTex(256, 256, (c, W, H) => {
    c.fillStyle = '#f3f1ec'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 4000; i++) { const v = 215 + r() * 40; c.fillStyle = `rgba(${v},${v},${v - 4},0.5)`; c.beginPath(); c.arc(r() * W, r() * H, 1 + r() * 2.5, 0, 7); c.fill(); }
  });
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 1 });
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(8 + r() * 5, 24, 16), mat);
    m.scale.set(1, 0.55 + r() * 0.3, 0.9);
    m.position.set((r() - 0.5) * 18, i * 4, (r() - 0.5) * 12);
    g.add(m);
  }
  return shadowed(g);
}

/**
 * A charging cable: a soft white USB-C lead through the given points (it rests on whatever the
 * points rest on), a moulded plug with its strain relief at the first point, facing `into`.
 */
export function cable(points, { radius = 0.19, into = new THREE.Vector3(1, 0, 0) } = {}) {
  const g = new THREE.Group();
  const rubber = new THREE.MeshStandardMaterial({ color: '#ecebe7', roughness: 0.55, name: 'cable' });
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(64, points.length * 24), radius, 10), rubber));
  // the plug: a rounded body, a thinner relief behind it, the metal shell going into the port
  const d = into.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.62, 0.95, 3, 0.25), rubber);
  body.position.copy(points[0]).addScaledVector(d, -1.0);
  body.quaternion.copy(q);
  const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 1.1, 16).rotateZ(Math.PI / 2), rubber);
  relief.position.copy(points[0]).addScaledVector(d, -2.4);
  relief.quaternion.copy(q);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.26, 0.84, 2, 0.1), new THREE.MeshStandardMaterial({ color: '#c8c9cb', metalness: 1, roughness: 0.3 }));
  shell.position.copy(points[0]).addScaledVector(d, 0.2);
  shell.quaternion.copy(q);
  g.add(body, relief, shell);
  return shadowed(g);
}

/** a strip of washi tape: thin paper tape, a little see-through, its short ends torn */
export function washi(w = 5, h = 1.6, color = '#cfe3d6', seed = 1) {
  const r = rng(seed);
  const shape = new THREE.Shape();
  const n = 7;
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  for (let i = 1; i < n; i++) shape.lineTo(w / 2 + (r() - 0.5) * 0.25, -h / 2 + (i / n) * h);   // torn ends
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  for (let i = n - 1; i > 0; i--) shape.lineTo(-w / 2 + (r() - 0.5) * 0.25, -h / 2 + (i / n) * h);
  shape.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity: 0.82, side: THREE.DoubleSide, name: 'washi' }));
  return m;
}

/**
 * A candle in an amber glass tumbler, lit (the user's "cozy"): thick amber glass, cream wax a
 * little down from the rim, a black wick, and its flame (named 'flame', for Blender to light the
 * room from and to flicker in the loop). 7.2 cm across, 8 tall.
 */
export function candleJar({ r = 3.6, h = 8 } = {}) {
  const g = new THREE.Group();
  const prof = [[0, 0], [r - 0.3, 0], [r, 0.35], [r, h - 0.2], [r - 0.12, h], [r - 0.32, h], [r - 0.32, 0.55], [0, 0.55]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transmission: 1, thickness: 0.3, ior: 1.5, attenuationColor: '#c9782a', attenuationDistance: 0.9, name: 'amber' }));
  g.add(glass);
  const waxH = h - 1.8;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.34, r - 0.34, waxH - 0.55, 64), new THREE.MeshPhysicalMaterial({ color: '#efe4cf', roughness: 0.55, name: 'wax' }));
  wax.position.y = 0.55 + (waxH - 0.55) / 2;
  g.add(wax);
  // the melt pool: a slight dip round the wick
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#e8d9bd', roughness: 0.08, name: 'wax' }));
  pool.position.y = waxH + 0.01;
  g.add(pool);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.9, name: 'wick' }));
  wick.position.set(0, waxH + 0.4, 0);
  wick.rotation.z = 0.12;
  g.add(wick);
  // the flame: a teardrop, blue-white at its root to deep orange at its tip (Blender shades it)
  const fp = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; fp.push(new THREE.Vector2(0.32 * Math.sin(Math.PI * t ** 0.62) * (1 - 0.15 * t), 2.2 * t)); }
  const flame = new THREE.Mesh(new THREE.LatheGeometry(fp, 24), new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffb45a', emissiveIntensity: 6, name: 'flame' }));
  flame.position.set(0.1, waxH + 0.75, 0);
  flame.name = 'flame';
  g.add(flame);
  g.userData.flameAt = new THREE.Vector3(0.1, waxH + 1.55, 0);
  return shadowed(g);
}

/**
 * Fairy lights: a fine copper wire hung in swags between the given points (each swag sagging
 * `sag` below the straight line), a warm little bulb every `step` along it (named 'bulb').
 */
export function fairyLights(points, { sag = 3.5, step = 3.4, seed = 5 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const path = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    for (let k = 0; k < 16; k++) {
      const t = k / 16;
      const p = a.clone().lerp(b, t);
      p.y -= sag * 4 * t * (1 - t) * (0.8 + r() * 0.4);
      path.push(p);
    }
  }
  path.push(points[points.length - 1].clone());
  const curve = new THREE.CatmullRomCurve3(path);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, path.length * 3, 0.035, 5), new THREE.MeshStandardMaterial({ color: '#8a5a33', metalness: 0.8, roughness: 0.4, name: 'wire' }));
  g.add(wire);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffb36a', emissiveIntensity: 5, name: 'bulb' });
  const n = Math.floor(curve.getLength() / step);
  for (let i = 1; i < n; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), bulbMat);
    b.position.copy(curve.getPointAt(i / n));
    b.position.y -= 0.2;
    b.name = 'bulb';
    g.add(b);
  }
  return g;
}

/** a black wire basket */
export function wireBasket({ w = 30, d = 22, h = 18 } = {}) {
  const g = new THREE.Group();
  const wire = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4, metalness: 0.6 });
  const rod = (a, b) => {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6), wire);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 10) { rod(V(x, 0, d / 2), V(x, h, d / 2)); rod(V(x, 0, -d / 2), V(x, h, -d / 2)); }
  for (let z = -d / 2; z <= d / 2 + 0.01; z += d / 7) { rod(V(w / 2, 0, z), V(w / 2, h, z)); rod(V(-w / 2, 0, z), V(-w / 2, h, z)); }
  for (const y of [0.1, h]) { rod(V(-w / 2, y, d / 2), V(w / 2, y, d / 2)); rod(V(-w / 2, y, -d / 2), V(w / 2, y, -d / 2)); rod(V(w / 2, y, -d / 2), V(w / 2, y, d / 2)); rod(V(-w / 2, y, -d / 2), V(-w / 2, y, d / 2)); }
  return shadowed(g);
}
