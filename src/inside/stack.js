// What rises out of his notebook, in place of the reference's building: the Home screen of Duriza (his
// real project) standing up off the page as its layers, the exploded view a UI engineer knows from Xcode's
// and Figma's 3D: the background at the back, then the pictures, the surfaces, the type, the controls, the
// sticky nav, and the floating WhatsApp button in front (its z-index is how far forward it stands). Each
// layer is a pane of glass with an outline; each element is a block on it, its face the element itself.
//
// pose({ grow, stand, explode, layout, look, reflow, collapse, panes }):
//   grow     0..1  from the sketch's size to the model's
//   stand    0..1  up off the page, about the screen's bottom edge
//   explode  0..1  the layers apart
//   layout   0..3  the three layouts tried, A (his sketch's) -> B -> C -> A again
//   look     0..4  wireframe (0), components (1: the design system), the real design (2), dark mode (3),
//                  the real one again (4); between two, the next wipes in from the left
//   reflow   0..1  the cards from one column to two (his teammate's note)
//   collapse 0..1  the layers together again: one screen
//   panes    0..1  the glass panes shown
import * as THREE from 'three';

const SW = 390, SH = 844;                     // the screen, in its own points
const LAYER = { bg: 0, hero: 1, img: 1, banner: 2, card: 2, text: 3, button: 4, nav: 5, fab: 6 };
const THICK = { bg: 6, hero: 12, img: 8, banner: 4, card: 5, text: 3, button: 8, nav: 9, fab: 14 };   // mm
const GAP = 0.026;                            // between two layers, apart (m, at the model's size)

// the elements and where each is in the three layouts (A: his sketch; B: a shorter hero; C: a split
// hero), and in A after the review (two columns)
const R = (x, y, w, h) => ({ x, y, w, h });
const ELEMENTS = [
  { id: 'bg', kind: 'bg', A: R(0, 0, 390, 844) },
  { id: 'banner', kind: 'banner', A: R(0, 44, 390, 30), C: R(0, 0, 390, 30) },
  { id: 'nav', kind: 'nav', A: R(0, 74, 390, 56), C: R(0, 788, 390, 56) },
  { id: 'hero', kind: 'hero', A: R(0, 130, 390, 330), B: R(0, 130, 390, 210), C: R(195, 30, 195, 330) },
  { id: 'tagline', kind: 'tagline', A: R(28, 330, 230, 34), B: R(24, 352, 250, 34), C: R(20, 120, 165, 70) },
  { id: 'shop', kind: 'button', A: R(110, 398, 170, 46), B: R(24, 398, 160, 46), C: R(20, 220, 160, 46) },
  { id: 'title', kind: 'title', A: R(20, 482, 140, 26), B: R(20, 462, 140, 26), C: R(20, 380, 140, 26) },
  ...[0, 1].flatMap((i) => {
    const y = 520 + i * 164, yB = 500 + i * 164, yC = 420 + i * 164;
    const x2 = 16 + i * 187;                  // two columns, after the review
    return [
      { id: `card${i}`, kind: 'card', A: R(16, y, 358, 150), B: R(16, yB, 358, 150), C: R(16, yC, 358, 150), A2: R(x2, 520, 171, 262) },
      { id: `img${i}`, kind: 'img', n: i, A: R(28, y + 12, 126, 126), B: R(28, yB + 12, 126, 126), C: R(28, yC + 12, 126, 126), A2: R(x2 + 10, 530, 151, 140) },
      { id: `name${i}`, kind: 'name', n: i, A: R(170, y + 26, 180, 18), B: R(170, yB + 26, 180, 18), C: R(170, yC + 26, 180, 18), A2: R(x2 + 10, 684, 150, 18) },
      { id: `price${i}`, kind: 'price', n: i, A: R(170, y + 92, 110, 20), B: R(170, yB + 92, 110, 20), C: R(170, yC + 92, 110, 20), A2: R(x2 + 10, 712, 100, 20) },
      { id: `add${i}`, kind: 'add', A: R(296, y + 108, 66, 30), B: R(296, yB + 108, 66, 30), C: R(296, yC + 108, 66, 30), A2: R(x2 + 96, 742, 66, 30) },
    ];
  }),
  { id: 'fab', kind: 'fab', A: R(318, 770, 56, 56), C: R(318, 712, 56, 56) },
];
const rectOf = (e, k) => e[k] ?? e.A;
const layerOf = (e) => LAYER[e.kind] ?? LAYER.text;
const thickOf = (e) => (THICK[e.kind] ?? THICK.text) / 1000;

// ---- what each element looks like, in each of the four looks ---------------------------------------
const SANS = '"Geist Sans", Geist, system-ui, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
const GREY = '#d9d3ca', GREY2 = '#b9b2a7', LINE = '#8d857a';
const BRAND = { gold: '#c49a3c', green: '#24372c', wa: '#3a9a5c', paper: '#fbf8f3', sand: '#efe6da' };
const DARK = { bg: '#1c1916', card: '#2a2520', text: '#efe6da', sub: '#a8998a' };
const ACC = '#cd7d42', ACC2 = '#8a4a26';      // the design system's components, before the brand's pictures

function crop(g, img, fx, fy, fw, fh, w, h) {
  if (!img) { g.fillStyle = '#c9b8a2'; g.fillRect(0, 0, w, h); return; }
  // cover the box with the crop, centred
  const sw = img.width * fw, sh = img.height * fh, k = Math.max(w / sw, h / sh);
  const cw = w / k, ch = h / k;
  g.drawImage(img, img.width * fx + (sw - cw) / 2, img.height * fy + (sh - ch) / 2, cw, ch, 0, 0, w, h);
}
function drawElement(e, look, g, w, h, img) {
  const k = w / rectOf(e, 'A').w;             // pixels per point
  const text = (s, x, y, size, col, { weight = 500, font = SANS, align = 'left' } = {}) => { g.fillStyle = col; g.font = `${weight} ${size * k}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x * k, y * k); };
  const box = (col, r = 0) => { g.fillStyle = col; g.beginPath(); g.roundRect(0, 0, w, h, r * k); g.fill(); };
  const wireX = () => { g.strokeStyle = LINE; g.lineWidth = 2 * k; g.strokeRect(k, k, w - 2 * k, h - 2 * k); g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); };
  const bars = (n, col, frac = 0.8) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(0, (h / n) * i + h / n * 0.25, w * (frac - i * 0.15), (h / n) * 0.5); };
  const wire = look === 0, comp = look === 1, dark = look === 3;
  switch (e.kind) {
    case 'bg': box(wire ? '#efebe4' : comp ? '#f6f2ec' : dark ? DARK.bg : BRAND.paper); break;
    case 'banner':
      box(wire ? GREY : comp ? '#ece4d8' : dark ? '#2a2520' : BRAND.sand);
      if (wire) bars(1, GREY2, 0.7); else text('Delivered in 3–5 business days via Egypt Post', 195, 15, 11, dark ? DARK.sub : '#4a4036', { align: 'center', weight: 400 });
      break;
    case 'nav':
      box(wire ? '#e4dfd7' : comp ? '#ffffff' : dark ? DARK.bg : '#ffffff');
      if (wire) { g.strokeStyle = LINE; g.lineWidth = 2 * k; g.strokeRect(16 * k, 14 * k, 90 * k, 28 * k); g.strokeRect(300 * k, 16 * k, 24 * k, 24 * k); g.strokeRect(340 * k, 16 * k, 30 * k, 24 * k); }
      else {
        text('Duriza', 20, 28, 26, comp ? '#3d3027' : BRAND.gold, { weight: 400, font: SERIF });
        g.strokeStyle = comp ? '#3d3027' : dark ? DARK.text : '#2d2620'; g.lineWidth = 2.2 * k;
        g.strokeRect(302 * k, 18 * k, 20 * k, 20 * k); g.beginPath(); g.arc(312 * k, 18 * k, 6 * k, Math.PI, 0); g.stroke();
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(342 * k, (20 + i * 8) * k); g.lineTo(368 * k, (20 + i * 8) * k); g.stroke(); }
      }
      break;
    case 'hero':
      if (wire) { box(GREY); wireX(); }
      else if (comp) { box('#e6d9c8'); g.fillStyle = '#d4c3ad'; g.beginPath(); g.arc(w * 0.3, h * 0.35, h * 0.12, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.35, h * 0.55); g.lineTo(w * 0.6, h * 0.8); g.lineTo(w * 0.8, h * 0.6); g.lineTo(w, h * 0.85); g.lineTo(w, h); g.fill(); }
      else { crop(g, img, 0.05, 0.12, 0.9, 0.42, w, h); if (dark) { g.fillStyle = 'rgba(15,10,6,0.45)'; g.fillRect(0, 0, w, h); } }
      break;
    case 'tagline':
      if (wire) bars(2, GREY2, 0.9);
      else text('Handmade in Egypt', 0, 17, 22, comp ? '#2d2620' : dark ? DARK.text : '#ffffff', { weight: 600 });
      break;
    case 'button':
      if (wire) { g.strokeStyle = LINE; g.lineWidth = 2.5 * k; g.strokeRect(2 * k, 2 * k, w - 4 * k, h - 4 * k); g.fillStyle = GREY2; g.fillRect(w * 0.25, h * 0.42, w * 0.5, h * 0.16); }
      else { box(comp ? ACC : dark ? BRAND.gold : BRAND.green, 4); text('SHOP NOW', 85, 23, 15, dark ? '#1c1916' : '#ffffff', { align: 'center', weight: 600 }); }
      break;
    case 'title':
      if (wire) bars(1, GREY2, 0.8); else text('New in', 0, 13, 20, dark ? DARK.text : '#2d2620', { weight: 600 });
      break;
    case 'card':
      box(wire ? '#f4f1ec' : dark ? DARK.card : '#ffffff', 8);
      g.strokeStyle = wire ? LINE : dark ? '#3a332c' : '#e3ddd4'; g.lineWidth = 2 * k; g.beginPath(); g.roundRect(k, k, w - 2 * k, h - 2 * k, 8 * k); g.stroke();
      break;
    case 'img':
      if (wire) { box(GREY); wireX(); }
      else if (comp) { box('#e6d9c8', 6); g.fillStyle = '#d4c3ad'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.22, 0, Math.PI * 2); g.fill(); }
      else { g.save(); g.beginPath(); g.roundRect(0, 0, w, h, 6 * k); g.clip(); crop(g, img, e.n ? 0.48 : 0.12, e.n ? 0.47 : 0.41, 0.34, 0.16, w, h); g.restore(); }
      break;
    case 'name':
      if (wire) bars(1, GREY2, 0.9); else text(['Abalone Pendant', 'Golden Rope Chain'][e.n], 0, 9, 15, dark ? DARK.text : '#2d2620', { weight: 500 });
      break;
    case 'price':
      if (wire) bars(1, GREY2, 0.6); else text(['950 EGP', '1,250 EGP'][e.n], 0, 10, 16, comp ? ACC2 : dark ? BRAND.gold : '#2d2620', { weight: 600 });
      break;
    case 'add':
      if (wire) { g.strokeStyle = LINE; g.lineWidth = 2 * k; g.strokeRect(k, k, w - 2 * k, h - 2 * k); }
      else { box(comp ? ACC : dark ? '#3a332c' : BRAND.green, 15); text('Add', 33, 15, 13, '#ffffff', { align: 'center', weight: 600 }); }
      break;
    case 'fab':
      g.beginPath(); g.arc(w / 2, h / 2, w / 2 - k, 0, Math.PI * 2);
      if (wire) { g.strokeStyle = LINE; g.lineWidth = 2.5 * k; g.stroke(); text('W', 28, 29, 22, LINE, { align: 'center' }); }
      else {
        g.fillStyle = comp ? ACC : BRAND.wa; g.fill();
        // a chat bubble with a handset: what the button is for
        g.strokeStyle = '#ffffff'; g.lineWidth = 3 * k; g.beginPath(); g.arc(w / 2, h / 2 - k, w * 0.27, 0.6, Math.PI * 2 + 0.2); g.lineTo(w * 0.24, h * 0.8); g.closePath(); g.stroke();
        g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(w * 0.4, h * 0.36, w * 0.2, w * 0.2, 4 * k); g.fill();
      }
      break;
    default: break;
  }
}

/** a block whose face (+z) shows its picture; its sides take the picture's bottom edge */
function blockGeometry() {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const uv = geo.attributes.uv, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) if (nrm.getZ(i) < 0.5) uv.setXY(i, Math.min(0.99, Math.max(0.01, uv.getX(i))), 0.02);
  return geo;
}
/** a rounded rectangle, w by h, `t` deep from z 0 back to -t: the phone's body behind its screen */
function bodyGeometry(w, h, r, t) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0);
  s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
  s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -t);
}

export function buildStack({ U, paint, edgeMat, images = {}, scale = 2.2 }) {
  const paneEdge = new THREE.LineBasicMaterial({ color: edgeMat.color, transparent: true, opacity: 0.22 });
  const root = new THREE.Group();             // at the screen's bottom edge on the page; turns it up
  const model = new THREE.Group();            // the screen's frame: x across, y up it, z out of it
  root.add(model);
  const geo = blockGeometry();
  const SCALE = scale;                        // the model's size over the sketch's (the phone drawn 1:1)
  const W = 0.0713, D = 0.1545;               // the sketch's phone, in metres
  const PX = 2;                               // texture pixels per point
  const blocks = ELEMENTS.map((e) => {
    const r = e.A;
    const texs = [0, 1, 2, 3].map((look) => {
      const c = document.createElement('canvas');
      c.width = Math.max(8, Math.round(r.w * PX)); c.height = Math.max(8, Math.round(r.h * PX));
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      t.userData.draw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); drawElement(e, look, g, c.width, c.height, images.phone); t.needsUpdate = true; };
      t.userData.draw();
      return t;
    });
    const mat = paint(U, { map: texs[0], dress: true, soft: 0.6, noise: 0.25, fine: 4, alphaTest: 0.02 });
    mat.userData.uniforms.uEdge.value.set('#e4a26f');
    const g = e.kind === 'fab' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 40).rotateX(Math.PI / 2).translate(0, 0, 0.5) : geo;
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 40), edgeMat));
    model.add(mesh);
    return { e, mesh, mat, texs };
  });
  // the phone's body behind the background: a dark rounded slab, its bezel round the screen
  const bodyMat = paint(U, { tint: 0.32, soft: 0.3, noise: 0.4, fine: 4 });
  const body = new THREE.Mesh(bodyGeometry(1, 1, 0.075, 1), bodyMat);
  body.castShadow = body.receiveShadow = true;
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 40), edgeMat));
  model.add(body);
  // the glass panes, one for each layer in front of the background
  const paneMat = paint(U, { soft: 0.75, tint: 1.05, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
  const paneGeo = new THREE.BoxGeometry(1, 1, 0.0012);
  const panes = [1, 2, 3, 4, 5, 6].map((k) => {
    const m = new THREE.Mesh(paneGeo, paneMat);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(paneGeo), paneEdge));
    m.userData.k = k;
    m.renderOrder = 2;
    model.add(m);
    return m;
  });

  const lerp = (a, b, t) => a + (b - a) * t;
  const mixR = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
  const sm = (t) => t * t * (3 - 2 * t);
  const clamp = (t) => Math.min(1, Math.max(0, t));

  //   lift     0..1  the front layers (the nav, the button) up and away, as their top floors lift off
  //   turn     0..1  a quarter turn about its foot, as their building turns for its facades
  function pose({ grow = 0, stand = 0, explode = 0, layout = 0, look = 0, reflow = 0, collapse = 0, panes: pn = 0, lift = 0, turn = 0 } = {}) {
    root.visible = grow > 0.001;
    if (!root.visible) return;
    const s = lerp(1, SCALE, sm(clamp(grow)));
    const w = W * s, d = D * s, k = s / SCALE;
    const st = sm(clamp(stand));
    root.rotation.x = -Math.PI / 2 * (1 - st);
    model.position.z = 0;
    root.rotation.y = lerp(yaw0, yaw1, st) + (Math.PI / 2) * sm(clamp(turn));
    fwd.set(Math.sin(yaw0), 0, Math.cos(yaw0));
    root.position.copy(anchor).addScaledVector(fwd, (D / 2) * (1 - st));
    const ex = explode * (1 - sm(clamp(collapse)));
    const la = Math.min(Math.max(layout, 0), 3), i0 = Math.floor(Math.min(la, 2.999)), f = sm(la - i0);
    const keys = ['A', 'B', 'C', 'A'];
    const lk = Math.min(Math.max(look, 0), 4), j = Math.min(3, Math.floor(lk)), jf = lk - j;
    const idx = [0, 1, 2, 3, 2];
    for (const b of blocks) {
      let r = mixR(rectOf(b.e, keys[i0]), rectOf(b.e, keys[i0 + 1]), f);
      if (b.e.A2) r = mixR(r, b.e.A2, sm(clamp(reflow)));
      const L = layerOf(b.e);
      const t = (L === 0 ? 0.004 : thickOf(b.e)) * k * (0.2 + 0.8 * sm(clamp(grow)));
      const z = (L - 3) * GAP * k * ex + L * 0.0009 * k;     // (a hair apart even together: no two faces in one plane)
      b.mesh.position.set((r.x + r.w / 2) / SW * w - w / 2, d - (r.y + r.h / 2) / SH * d + (L >= 5 ? 0.3 * k * sm(clamp(lift)) : 0), z);
      b.mesh.scale.set(Math.max(1e-4, r.w / SW * w), Math.max(1e-4, r.h / SH * d), t);
      b.mat.map = b.texs[idx[j]];
      b.mat.userData.uniforms.tDress.value = b.texs[idx[Math.min(4, j + 1)]];
      b.mat.userData.uniforms.uDress.value = jf;
    }
    body.position.set(0, d / 2, -3 * GAP * k * ex);
    body.scale.set(w * 1.06, d * 1.03, 0.012 * k);
    paneMat.opacity = 0.25 * clamp(pn);
    for (const m of panes) {
      m.visible = pn > 0.01 && ex > 0.02;
      m.position.set(0, d / 2, (m.userData.k - 3) * GAP * k * ex - 0.0008 * k);
      m.scale.set(w * 1.02, d * 1.01, 1);
    }
  }
  // where it stands: `anchor` the sketch's middle on the page, `fwd` the page's way toward him
  // (lying, it lies as the sketch does, `yaw0`; standing, it has turned to `yaw1`)
  const anchor = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
  let yaw0 = 0, yaw1 = 0;
  const place = (p, ry, ry1 = ry) => { anchor.copy(p); root.rotation.order = 'YXZ'; yaw0 = ry; yaw1 = ry1; };
  pose();
  return { root, model, pose, place, blocks, panes, size: () => ({ W: W * SCALE, D: D * SCALE }), redraw: () => blocks.forEach((b) => b.texs.forEach((t) => t.userData.draw())) };
}

/** the whole screen in one look, in layout A, into a box of a canvas (the notebook's page shows it) */
export function drawScreen(g, x, y, w, h, look, img) {
  const k = w / SW;
  for (const e of ELEMENTS) {
    const r = e.A;
    g.save();
    g.translate(x + r.x * k, y + r.y * k);
    drawElement(e, look, g, r.w * k, r.h * k, img);
    g.restore();
  }
}
