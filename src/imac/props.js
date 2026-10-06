import * as THREE from 'three';
import { SHOT } from './set.js';

// What sits on the shelf beside the machine, so the first frame says who
// this is: a software engineer who designs and animates. On the left a
// sketchbook of wireframes leaning on the wall and a mug printed with </>; on
// the right a tablet with a curve being drawn on it, the site itself on a phone
// on a stand, a cup of pencils, the tablet's pen, and above them
// a TO DO / DOING / DONE board of sticky notes. Real sizes, in centimetres;
// everything drawn here, textures included (the phone shows the studio site
// as it looks on a phone).

const WALL = SHOT.wallZ;

function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  return t;
}

/** A pencil line that wobbles a little, drawn twice like a real sketch. */
function sketchLine(g, pts, rnd, width = 3) {
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = (rnd() - 0.5) * 2.2, jy = (rnd() - 0.5) * 2.2;
      if (i === 0) g.moveTo(x + jx, y + jy); else g.lineTo(x + jx, y + jy);
    });
    g.lineWidth = width * (pass ? 0.6 : 1);
    g.stroke();
  }
}

function seeded(s) { return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** The page: a website wireframe in pencil, with a few notes in the margin. */
function wireframeTexture() {
  return canvasTex(1024, 1448, (g, W, H) => {
    g.fillStyle = '#F7F4EC';
    g.fillRect(0, 0, W, H);
    // faint dot grid of a designer's notebook
    g.fillStyle = 'rgba(80, 80, 90, 0.16)';
    for (let y = 40; y < H; y += 36) for (let x = 40; x < W; x += 36) g.fillRect(x, y, 3, 3);
    const r = seeded(11);
    g.strokeStyle = 'rgba(52, 52, 58, 0.85)';
    g.lineCap = 'round';
    const rect = (x, y, w, h, lw = 3.4) => sketchLine(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], r, lw);
    // browser window
    const L = 110, T = 170, Wd = 800;
    rect(L, T, Wd, 1080, 4);
    sketchLine(g, [[L, T + 60], [L + Wd, T + 60]], r);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(L + 36 + i * 32, T + 30, 10, 0, Math.PI * 2); g.stroke(); }
    rect(L + 150, T + 16, 480, 28, 2.6);
    // nav: logo and links
    rect(L + 40, T + 100, 120, 40);
    for (let i = 0; i < 4; i++) sketchLine(g, [[L + 440 + i * 90, T + 122], [L + 500 + i * 90, T + 122]], r, 3);
    // hero: an image box with its cross, a headline, a button
    rect(L + 40, T + 180, 720, 330);
    sketchLine(g, [[L + 40, T + 180], [L + 760, T + 510]], r, 2.4);
    sketchLine(g, [[L + 760, T + 180], [L + 40, T + 510]], r, 2.4);
    for (let i = 0; i < 2; i++) sketchLine(g, [[L + 80, T + 560 + i * 44], [L + 560 - i * 160, T + 560 + i * 44]], r, 7);
    rect(L + 80, T + 660, 190, 60);
    g.font = '600 30px "Segoe Print", "Comic Sans MS", cursive';
    g.fillStyle = 'rgba(52, 52, 58, 0.85)';
    g.fillText('CTA', L + 145, T + 700);
    // three cards
    for (let i = 0; i < 3; i++) {
      const x = L + 40 + i * 245;
      rect(x, T + 780, 220, 250);
      sketchLine(g, [[x + 20, T + 950], [x + 190, T + 950]], r, 3);
      sketchLine(g, [[x + 20, T + 985], [x + 150, T + 985]], r, 3);
      g.beginPath(); g.arc(x + 110, T + 860, 46, 0, Math.PI * 2); g.stroke();
    }
    // notes and arrows in the margin, in yellow highlighter and pencil
    g.fillStyle = 'rgba(253, 202, 61, 0.55)';
    g.fillRect(L + 560, T + 1110, 250, 44);
    g.fillStyle = 'rgba(52, 52, 58, 0.9)';
    g.font = '600 34px "Segoe Print", "Comic Sans MS", cursive';
    g.fillText('grid: 12 col', L + 570, T + 1145);
    g.fillText('hero v2', L + 40, 110);
    sketchLine(g, [[L + 210, 100], [L + 330, 150], [L + 300, T + 30]], r, 3);
    g.save();
    g.translate(L + 830, T + 420);
    g.rotate(Math.PI / 2);
    g.fillText('24px', -40, 0);
    g.restore();
    sketchLine(g, [[L + 820, T + 180], [L + 820, T + 510]], r, 2);
    sketchLine(g, [[L + 808, T + 180], [L + 832, T + 180]], r, 2);
    sketchLine(g, [[L + 808, T + 510], [L + 832, T + 510]], r, 2);
  });
}

function sketchbook() {
  const g = new THREE.Group();
  const w = 21, h = 29.7; // A4, portrait
  const cover = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.4, 0.5), new THREE.MeshPhysicalMaterial({ color: '#1F1F22', roughness: 0.7 }));
  cover.position.set(0, h / 2, -0.35);
  g.add(cover);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.4, 0.25), new THREE.MeshPhysicalMaterial({ color: '#EDE9DF', roughness: 0.9 }));
  pages.position.set(0, h / 2 - 0.2, 0);
  g.add(pages);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, h - 0.9), new THREE.MeshPhysicalMaterial({ map: wireframeTexture(), roughness: 0.92 }));
  page.position.set(0, h / 2 - 0.3, 0.13);
  g.add(page);
  // the spiral along the top
  const wire = new THREE.MeshPhysicalMaterial({ color: '#9A9AA0', metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 17; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 16), wire);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-w / 2 + 1.2 + i * ((w - 2.4) / 16), h + 0.05, -0.1);
    g.add(ring);
  }
  return g;
}

function mug() {
  const g = new THREE.Group();
  const logo = canvasTex(1024, 256, (c, W, H) => {
    c.fillStyle = '#FAFAF7';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#26262B';
    c.font = '700 150px "Consolas", "Courier New", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // the front of the mug is the middle of the wrap
    c.fillText('</>', W * 0.5, H * 0.52);
    c.fillStyle = '#FDCA3D';
    c.fillRect(W * 0.5 - 150, H * 0.84, 300, 10);
  });
  logo.wrapS = THREE.RepeatWrapping;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 9.5, 48, 1, true),
    new THREE.MeshPhysicalMaterial({ map: logo, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide })
  );
  body.position.y = 4.75;
  body.rotation.y = Math.PI; // the cylinder's u = 0.5 faces -z; this turns the print to the camera
  g.add(body);
  const ceramic = new THREE.MeshPhysicalMaterial({ color: '#FAFAF7', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.7, 0.5, 48), ceramic);
  bottom.position.y = 0.25;
  g.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.18, 10, 48), ceramic);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 9.5;
  g.add(rim);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(3.8, 40), new THREE.MeshPhysicalMaterial({ color: '#2B1A10', roughness: 0.15 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 8.3;
  g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.55, 12, 32, Math.PI * 1.15), ceramic);
  handle.position.set(-4.4, 5, 0);
  handle.rotation.z = Math.PI / 2 + 0.3;
  g.add(handle);
  return g;
}

function pencil(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 15, 6), new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.6 }));
  body.position.y = 7.5;
  g.add(body);
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.6, 6), new THREE.MeshPhysicalMaterial({ color: '#E8C99A', roughness: 0.8 }));
  wood.position.y = 15.8;
  g.add(wood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), new THREE.MeshPhysicalMaterial({ color: '#2A2A2E', roughness: 0.4, metalness: 0.3 }));
  lead.position.y = 16.6;
  g.add(lead);
  return g;
}

function pencilCup() {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.4, 10, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: '#3B3F46', roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }));
  cup.position.y = 5;
  g.add(cup);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.4, 40), cup.material);
  base.position.y = 0.2;
  g.add(base);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(3.58, 0.12, 8, 40), cup.material);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 10;
  g.add(lip);
  const cols = ['#F2C230', '#2F6B8F', '#C8442F'];
  cols.forEach((c, i) => {
    const p = pencil(c);
    p.position.set(-1.4 + i * 1.3, 0.5, (i - 1) * 0.9);
    p.rotation.z = (i - 1) * 0.16;
    p.rotation.x = (i % 2 ? 0.08 : -0.1);
    g.add(p);
  });
  return g;
}

// ---- the right-hand corner: the phone, the tablet, the board ------------------------

/** A rounded slab (a phone, a tablet): a rounded rectangle extruded, its edge softened. */
function slab(w, h, d, r, material, bevel = 0.12) {
  const s = new THREE.Shape();
  const x = -w / 2 + bevel, y = -h / 2 + bevel, W = w - bevel * 2, H = h - bevel * 2, R = Math.max(0.01, r - bevel);
  s.moveTo(x + R, y);
  s.lineTo(x + W - R, y); s.quadraticCurveTo(x + W, y, x + W, y + R);
  s.lineTo(x + W, y + H - R); s.quadraticCurveTo(x + W, y + H, x + W - R, y + H);
  s.lineTo(x + R, y + H); s.quadraticCurveTo(x, y + H, x, y + H - R);
  s.lineTo(x, y + R); s.quadraticCurveTo(x, y, x + R, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  return new THREE.Mesh(geo, material);
}

/** A flat rounded rectangle with 0..1 UVs across it, for a screen. */
function screenPlane(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(s, 12);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  return geo;
}

/** A screen's glass: the picture glows a little, as a phone's does in a lit room. */
function screenMaterial(map, glow) {
  return new THREE.MeshPhysicalMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: glow, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
}

/** The phone's screen: the site itself, on a phone, with its bar and menu. */
function phoneScreenTexture() {
  // the studio site on a phone: its hero picture (the window, the pyramids at
  // sunset), the name, the trades, the way in, and the first two projects
  return canvasTex(780, 1688, (g, W, H) => {
    g.fillStyle = '#F2EEE6'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2F2B29';
    g.font = '600 40px "Segoe UI", system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('9:41', 70, 62);
    g.fillStyle = '#0B0B0C';
    g.beginPath(); g.roundRect(W / 2 - 110, 26, 220, 66, 33); g.fill();
    g.fillStyle = '#2F2B29';
    g.beginPath(); g.roundRect(W - 132, 48, 62, 28, 8); g.fill();
    for (let i = 0; i < 4; i++) g.fillRect(W - 238 + i * 16, 72 - i * 7, 10, 8 + i * 7);
    // the hero picture
    const hx = 40, hy = 140, hw = W - 80, hh = 640;
    g.save();
    g.beginPath(); g.roundRect(hx, hy, hw, hh, 40); g.clip();
    const sky = g.createLinearGradient(0, hy, 0, hy + hh);
    sky.addColorStop(0, '#9fc4e8'); sky.addColorStop(0.55, '#f3d9b0'); sky.addColorStop(1, '#e9b27a');
    g.fillStyle = sky; g.fillRect(hx, hy, hw, hh);
    g.fillStyle = '#ffe6a8'; g.beginPath(); g.arc(hx + hw * 0.2, hy + hh * 0.52, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b98f5c';
    g.beginPath(); g.moveTo(hx + hw * 0.34, hy + hh * 0.74); g.lineTo(hx + hw * 0.5, hy + hh * 0.5); g.lineTo(hx + hw * 0.66, hy + hh * 0.74); g.fill();
    g.fillStyle = '#a57f50';
    g.beginPath(); g.moveTo(hx + hw * 0.58, hy + hh * 0.74); g.lineTo(hx + hw * 0.72, hy + hh * 0.55); g.lineTo(hx + hw * 0.86, hy + hh * 0.74); g.fill();
    g.fillStyle = '#8a6a4a'; g.fillRect(hx, hy + hh * 0.74, hw, hh * 0.26);
    g.fillStyle = '#1d1c1b';
    for (const f of [0.33, 0.66]) g.fillRect(hx + hw * f - 5, hy, 10, hh);
    g.fillRect(hx, hy + hh * 0.3, hw, 10);
    g.restore();
    // the name and the trades
    g.fillStyle = '#2F2B29';
    g.font = '800 72px "Segoe UI", system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
    g.fillText('Mohamed', 44, 900);
    g.fillText('Samy', 44, 976);
    g.fillStyle = '#6e675e';
    g.font = '500 32px "Segoe UI", system-ui, sans-serif';
    g.fillText('Software Engineer · UI/UX · Web', 46, 1032);
    // the way in
    g.fillStyle = '#FFD54F';
    g.beginPath(); g.roundRect(44, 1072, 400, 92, 46); g.fill();
    g.fillStyle = '#2F2B29';
    g.font = '700 34px "Segoe UI", system-ui, sans-serif';
    g.fillText('Enter the studio  →', 84, 1130);
    // two project cards
    [['Ganeeh', '#e8c07a'], ['Hawa', '#9cc7e0']].forEach(([t, c], i) => {
      const x = 44 + i * ((W - 104) / 2 + 16), w = (W - 104) / 2;
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x, 1210, w, 360, 30); g.fill();
      g.fillStyle = c; g.beginPath(); g.roundRect(x + 18, 1228, w - 36, 230, 20); g.fill();
      g.fillStyle = '#2F2B29'; g.font = '700 32px "Segoe UI", system-ui, sans-serif'; g.fillText(t, x + 24, 1512);
      g.fillStyle = '#a39c90'; g.fillRect(x + 24, 1532, w * 0.5, 8);
    });
    g.fillStyle = 'rgba(20,20,18,0.75)';
    g.beginPath(); g.roundRect(W / 2 - 140, H - 36, 280, 12, 6); g.fill();
  });
}

/** A phone on a small aluminium stand, showing the site as it looks on a phone. */
function phoneOnStand({ screenMap = null } = {}) {
  const g = new THREE.Group();
  const alu = new THREE.MeshPhysicalMaterial({ color: '#C9CCD0', metalness: 1, roughness: 0.32 });
  const lean = 0.3; // back from upright
  // the stand: a base, a back leaning at the phone's angle, a lip it rests on
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.5, 8.6), alu);
  base.position.set(0, 0.25, 0);
  g.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(6.4, 10.5, 0.45), alu);
  back.position.set(0, 0.5 + Math.cos(lean) * 5.25, -1.4 - Math.sin(lean) * 5.25);
  back.rotation.x = -lean;
  g.add(back);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.3, 0.5), alu);
  lip.position.set(0, 1.1, 3.3);
  g.add(lip);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.12, 1.8), new THREE.MeshPhysicalMaterial({ color: '#2A2B2E', roughness: 0.8 }));
  pad.position.set(0, 0.56, 2.3);
  g.add(pad);
  // the phone leans back on it, its foot against the lip
  const phone = new THREE.Group();
  phone.position.set(0, 0.62, 2.6);
  phone.rotation.x = -lean;
  g.add(phone);
  const W = 7.15, H = 14.7, D = 0.82;
  const body = slab(W, H, D, 1.05, new THREE.MeshPhysicalMaterial({ color: '#3A3C40', metalness: 0.85, roughness: 0.3 }), 0.2);
  body.position.set(0, H / 2, 0);
  phone.add(body);
  const glass = new THREE.Mesh(screenPlane(W - 0.18, H - 0.18, 0.95), new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }));
  glass.position.set(0, H / 2, D / 2 + 0.005);
  phone.add(glass);
  const screen = new THREE.Mesh(screenPlane(W - 0.62, H - 0.62, 0.8), screenMaterial(screenMap ?? phoneScreenTexture(), 0.55));
  screen.position.set(0, H / 2, D / 2 + 0.012);
  phone.add(screen);
  return g;
}

/** The tablet's screen: a design tool of our own, a curve being drawn with the pen. */
function tabletScreenTexture() {
  return canvasTex(2048, 1568, (g, W, H) => {
    g.fillStyle = '#1B1D22';
    g.fillRect(0, 0, W, H);
    // the top bar: the file, the zoom, a share button
    g.fillStyle = '#23262D';
    g.fillRect(0, 0, W, 96);
    g.fillStyle = '#E8E6E0';
    g.font = '600 34px "Segoe UI", system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('portfolio  /  hero-motion', 150, 48);
    g.fillStyle = '#8B8F99';
    g.fillText('100%', W - 420, 48);
    g.fillStyle = '#FBE435';
    g.beginPath(); g.roundRect(W - 260, 22, 210, 52, 26); g.fill();
    g.fillStyle = '#2F2B29';
    g.font = '700 30px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Share', W - 155, 49);
    g.textAlign = 'left';
    // the tools down the left, the pen chosen
    g.fillStyle = '#23262D';
    g.fillRect(0, 96, 110, H - 96);
    ['move', 'pen', 'rect', 'ellipse', 'text', 'hand'].forEach((t, i) => {
      const y = 170 + i * 110;
      if (t === 'pen') { g.fillStyle = '#FBE435'; g.beginPath(); g.roundRect(18, y - 38, 74, 76, 16); g.fill(); }
      g.strokeStyle = t === 'pen' ? '#2F2B29' : '#C9CCD3';
      g.lineWidth = 5;
      g.beginPath();
      if (t === 'move') { g.moveTo(40, y - 20); g.lineTo(40, y + 22); g.lineTo(52, y + 10); g.lineTo(62, y + 28); g.lineTo(70, y + 24); g.lineTo(60, y + 6); g.lineTo(76, y + 6); g.closePath(); }
      if (t === 'pen') { g.moveTo(55, y + 26); g.lineTo(40, y - 6); g.lineTo(55, y - 26); g.lineTo(70, y - 6); g.closePath(); g.moveTo(55, y - 8); g.lineTo(55, y + 26); }
      if (t === 'rect') g.rect(34, y - 22, 42, 44);
      if (t === 'ellipse') g.arc(55, y, 23, 0, Math.PI * 2);
      if (t === 'text') { g.moveTo(34, y - 22); g.lineTo(76, y - 22); g.moveTo(55, y - 22); g.lineTo(55, y + 24); }
      if (t === 'hand') { g.arc(55, y + 6, 18, Math.PI, 0); g.moveTo(37, y + 6); g.lineTo(37, y - 16); g.moveTo(73, y + 6); g.lineTo(73, y - 16); }
      g.stroke();
    });
    // the layers down the right
    const LX = W - 440;
    g.fillStyle = '#23262D';
    g.fillRect(LX, 96, 440, H - 96);
    g.fillStyle = '#8B8F99';
    g.font = '600 28px "Segoe UI", system-ui, sans-serif';
    g.fillText('LAYERS', LX + 36, 150);
    ['curve', 'anchor · in', 'anchor · out', 'button', 'headline', 'hero'].forEach((t, i) => {
      const y = 220 + i * 78;
      if (i === 0) { g.fillStyle = 'rgba(251,228,53,0.16)'; g.fillRect(LX + 12, y - 34, 416, 68); }
      g.fillStyle = i === 0 ? '#FBE435' : '#D6D8DE';
      g.font = '500 30px "Segoe UI", system-ui, sans-serif';
      g.fillText(t, LX + 84, y);
      g.strokeStyle = i === 0 ? '#FBE435' : '#8B8F99';
      g.lineWidth = 3;
      g.strokeRect(LX + 36, y - 14, 28, 28);
    });
    // the easing panel under the layers
    g.fillStyle = '#8B8F99';
    g.font = '600 28px "Segoe UI", system-ui, sans-serif';
    g.fillText('EASING', LX + 36, 760);
    g.strokeStyle = '#3A3E48'; g.lineWidth = 3;
    g.strokeRect(LX + 36, 800, 360, 360);
    g.strokeStyle = '#6EC5FF'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(LX + 36, 1160); g.lineTo(LX + 160, 1160); g.moveTo(LX + 396, 800); g.lineTo(LX + 272, 800); g.stroke();
    g.strokeStyle = '#FBE435'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(LX + 36, 1160); g.bezierCurveTo(LX + 160, 1160, LX + 272, 800, LX + 396, 800); g.stroke();
    g.fillStyle = '#FBE435';
    g.font = '600 26px "Consolas", monospace';
    g.fillText('ease-in-out  0.6s', LX + 36, 1220);
    // the artboard, and on it the curve being drawn with the pen
    const AX = 200, AY = 170, AW = LX - 290, AH = H - 270;
    g.fillStyle = '#F4F1EA';
    g.fillRect(AX, AY, AW, AH);
    g.fillStyle = '#8B8F99';
    g.font = '500 26px "Segoe UI", system-ui, sans-serif';
    g.fillText('Hero — 1440', AX, AY - 26);
    g.fillStyle = '#E4DFD2';
    for (let y = AY + 40; y < AY + AH; y += 60) for (let x = AX + 40; x < AX + AW; x += 60) g.fillRect(x, y, 4, 4);
    const P = [[AX + 150, AY + AH - 260], [AX + 560, AY + AH - 260], [AX + AW - 560, AY + 280], [AX + AW - 150, AY + 280]];
    g.strokeStyle = '#2F2B29'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...P[0]); g.bezierCurveTo(...P[1], ...P[2], ...P[3]); g.stroke();
    g.strokeStyle = '#1F8FE0'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.moveTo(...P[3]); g.lineTo(...P[2]); g.stroke();
    for (const [x, y] of [P[1], P[2]]) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); g.stroke(); }
    for (const [x, y] of [P[0], P[3]]) { g.fillStyle = '#FFFFFF'; g.fillRect(x - 18, y - 18, 36, 36); g.strokeRect(x - 18, y - 18, 36, 36); }
    // a yellow ball riding it, and the headline and button laid out under it
    g.fillStyle = '#FBE435';
    g.beginPath(); g.arc(AX + AW / 2, AY + AH / 2 - 10, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2F2B29';
    g.font = '800 88px "Segoe UI", system-ui, sans-serif';
    g.fillText('Design that moves.', AX + 150, AY + AH - 120);
  });
}

/** A tablet leaning on the wall with its pen beside it: design and motion. */
function tablet() {
  const g = new THREE.Group();
  const W = 28.06, H = 21.49, D = 0.64;
  const body = slab(W, H, D, 1.1, new THREE.MeshPhysicalMaterial({ color: '#56585E', metalness: 0.9, roughness: 0.34 }), 0.16);
  body.position.set(0, H / 2, 0);
  g.add(body);
  const glass = new THREE.Mesh(screenPlane(W - 0.14, H - 0.14, 1.0), new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }));
  glass.position.set(0, H / 2, D / 2 + 0.005);
  g.add(glass);
  const screen = new THREE.Mesh(screenPlane(W - 1.6, H - 1.6, 0.7), screenMaterial(tabletScreenTexture(), 0.5));
  screen.position.set(0, H / 2, D / 2 + 0.012);
  g.add(screen);
  return g;
}

/** The tablet's pen: white, round with one flat side, lying on the shelf. */
function stylus() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: '#F4F4F2', roughness: 0.32, clearcoat: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 15.2, 28), white);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 28), white);
  cone.rotation.z = -Math.PI / 2;
  cone.position.x = 8.4;
  g.add(cone);
  const nib = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshPhysicalMaterial({ color: '#D9D9D6', roughness: 0.6 }));
  nib.position.x = 9.2;
  g.add(nib);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.12, 28), new THREE.MeshPhysicalMaterial({ color: '#B9B9B5', metalness: 0.9, roughness: 0.25 }));
  band.rotation.z = Math.PI / 2;
  band.position.x = -6.4;
  g.add(band);
  g.position.y = 0.45;
  return g;
}

// ---- the board: sticky notes on the wall, TO DO / DOING / DONE ------------------------

const NOTES = [
  { col: 0, text: ['hero', 'animation'], color: '#FFE66D', sketch: 'curve' },
  { col: 0, text: ['dark mode'], color: '#FF9FB2', sketch: 'moon' },
  { col: 1, text: ['4K render'], color: '#8FD6EA', sketch: 'blocks' },
  { col: 1, text: ['a11y pass'], color: '#FFE66D', sketch: 'check' },
  { col: 2, text: ['deploy'], color: '#B8E986', sketch: 'tick' },
  { col: 2, text: ['fix bug', '#12'], color: '#FFE66D', strike: true },
];
const HAND = '"Ink Free", "Segoe Print", "Comic Sans MS", cursive';

function noteTexture(n, seed) {
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = n.color;
    g.fillRect(0, 0, W, H);
    // the glue strip along the top is a touch darker; the paper has a faint fibre
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(0, 0, W, 70);
    const r = seeded(seed);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 2, 2); }
    g.fillStyle = '#26262B';
    g.strokeStyle = '#26262B';
    g.font = `700 ${n.text.length > 1 ? 82 : 92}px ${HAND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    n.text.forEach((t, i) => g.fillText(t, W / 2 + (r() - 0.5) * 12, (n.text.length > 1 ? 170 : 200) + i * 92));
    g.lineWidth = 9;
    g.lineCap = 'round';
    if (n.strike) { g.beginPath(); g.moveTo(90, 222); g.lineTo(430, 206); g.stroke(); }
    g.lineWidth = 7;
    g.beginPath();
    if (n.sketch === 'curve') { g.moveTo(120, 410); g.bezierCurveTo(250, 410, 270, 320, 400, 320); g.stroke(); g.strokeRect(108, 398, 24, 24); g.strokeRect(388, 308, 24, 24); }
    if (n.sketch === 'moon') { g.arc(256, 370, 70, 0.9, 5.4); g.quadraticCurveTo(250, 380, 300, 425); g.stroke(); }
    if (n.sketch === 'blocks') { for (const [x, h] of [[170, 90], [230, 140], [290, 70], [350, 120]]) g.strokeRect(x, 440 - h, 44, h); }
    if (n.sketch === 'check') { g.rect(150, 340, 70, 70); g.moveTo(250, 375); g.lineTo(390, 375); g.stroke(); }
    if (n.sketch === 'tick') { g.moveTo(180, 360); g.lineTo(240, 420); g.lineTo(360, 300); g.stroke(); }
  });
}

function tapeTexture(label) {
  return canvasTex(512, 128, (g, W, H) => {
    g.fillStyle = '#E8DDC0';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(120,100,60,0.08)';
    for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H);
    g.fillStyle = '#26262B';
    g.font = `700 76px ${HAND}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, W / 2, H / 2 + 4);
  });
}

/** One note: a square of paper stuck at the top, its lower edge lifting off the wall. */
function note(map, size = 7.6) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (size / 2 - pos.getY(i)) / size; // 0 at the glued top, 1 at the bottom
    pos.setZ(i, Math.max(0, t - 0.35) ** 2 * 1.6);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, roughness: 0.85, side: THREE.DoubleSide }));
}

function stickyBoard() {
  const g = new THREE.Group();
  const cols = ['TO DO', 'DOING', 'DONE'];
  const colW = 9.6, top = 0;
  const r = seeded(29);
  cols.forEach((label, c) => {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), new THREE.MeshPhysicalMaterial({ map: tapeTexture(label), roughness: 0.8 }));
    tape.position.set(c * colW, top, 0.02);
    tape.rotation.z = (r() - 0.5) * 0.06;
    g.add(tape);
  });
  const perCol = [0, 0, 0];
  NOTES.forEach((n, i) => {
    const k = perCol[n.col]++;
    const m = note(noteTexture(n, 40 + i));
    m.position.set(n.col * colW + (r() - 0.5) * 0.8, top - 5.6 - k * 8.6, 0.04 + i * 0.004);
    m.rotation.z = (r() - 0.5) * 0.12;
    g.add(m);
  });
  return g;
}

export function buildProps() {
  const group = new THREE.Group();
  // left: the designer's corner
  const book = sketchbook();
  // leaning back on the wall, far enough off it that no corner passes behind it
  // (it did: turned and leaning, its top right corner went into the wall and vanished)
  book.position.set(-40, 0, WALL + 7.6);
  book.rotation.x = -0.17;
  book.rotation.y = 0.07;
  group.add(book);
  const m = mug();
  m.position.set(-30, 0, 9);
  m.rotation.y = 0.25;
  group.add(m);
  // right: the engineer's corner, the one who ships it: the tablet with a curve on
  // it leaning on the wall, the site on a phone, the pencils, the board above
  const tab = tablet();
  tab.position.set(46.5, 0, WALL + 8.8);
  tab.rotation.x = -0.24;
  tab.rotation.y = -0.06;
  group.add(tab);
  const pen = stylus();
  pen.position.set(41, 0, 18);
  pen.rotation.y = 0.3;
  group.add(pen);
  const cup = pencilCup();
  // the pencils stand in the free corner at the left: in front of the tablet they hid half of it
  cup.position.set(-50.5, 0, -6);
  group.add(cup);
  const phone = phoneOnStand();
  phone.position.set(21.5, 0, 12);
  phone.rotation.y = -0.14;
  group.add(phone);
  const board = stickyBoard();
  board.position.set(30.5, 44, WALL + 0.02);
  group.add(board);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    // three-gpu-pathtracer maps each geometry group's materialIndex into the
    // mesh's material list; a box or cylinder carries groups 0..5 even with one
    // material, and the stray indices land on other materials across the set
    if (!Array.isArray(o.material)) o.geometry.clearGroups();
  });
  return group;
}

// reused by the desk scene (src/desk-render.js): the same things, placed there
export { sketchbook, mug, pencilCup, tablet, stylus, phoneOnStand, stickyBoard };
