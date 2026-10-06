// The room of script 5, as Blender built it (tools/blender/set.py -> public/inside/set.glb): his studio
// with only what a software engineer and UI designer has on his desk, its sunlight baked into one
// lightmap (set-light.png) and drawn as the reference draws its room: the light colour where the baked
// sun is, one shadow colour elsewhere. What is on its surfaces is drawn here: the screens (Figma with
// the app's screens, VS Code in dark mode, Duriza live on the MacBook), the dot-grid notebook (the
// sitemap, and the Home screen in pencil), the sticky notes, the Kanban board, the glass board (the
// user flow, a flowchart, the system's architecture) and the printout his teammate will mark up.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { paint } from './look.js';
import { drawScreen } from './stack.js';

const INK = '#3a2a1c', LEAD = '#4d4640', HAND = '"Architects Daughter", "Segoe Print", cursive', SANS = '"Geist Sans", Geist, system-ui, sans-serif', MONO = '"Geist Mono", ui-monospace, monospace';
const NOTE = { yellow: '#f4d57c', peach: '#f5b88a', pink: '#f0a796' };

const rngOf = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// (decoded off the main thread before it is drawn or sent to the GPU: decoded there, each big one held a frame 0.3 s)
const loadImage = (src) => { const i = new Image(); i.src = src; return i.decode().then(() => i, () => null); };
// the room's baked light, 4096 square: decoded, turned upright and left as it is off the main thread (an ImageBitmap),
// so sending it to the GPU is only a copy (as an <img> it held a frame half a second)
const loadLightmap = async (src) => {
  try {
    const bmp = await createImageBitmap(await (await fetch(src)).blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const t = new THREE.Texture(bmp); t.flipY = false; t.needsUpdate = true; return t;
  } catch {
    const img = await loadImage(src); const t = new THREE.Texture(img); t.needsUpdate = true; return t;
  }
};

/** a canvas texture in glTF's sense (its first row is v = 0) */
function canvasTex(w, h, draw, { alpha = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.premultiplyAlpha = false;
  t.userData.alpha = alpha;
  return t;
}

/** a hand: pencil or marker lines with a little wobble */
function hand(g, seed, { w = 2.4, col = LEAD, clean = false } = {}) {
  const r = rngOf(seed);
  const j = clean ? () => 0 : (k) => (r() - 0.5) * k;
  const line = (x0, y0, x1, y1, lw = w) => {
    g.strokeStyle = col; g.lineWidth = lw * (0.85 + r() * 0.3); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0 + j(2), y0 + j(2));
    g.quadraticCurveTo((x0 + x1) / 2 + j(4), (y0 + y1) / 2 + j(4), x1 + j(2), y1 + j(2)); g.stroke();
  };
  const rect = (x, y, a, b, lw) => { line(x, y, x + a, y, lw); line(x + a, y, x + a, y + b, lw); line(x + a, y + b, x, y + b, lw); line(x, y + b, x, y, lw); };
  const round = (x, y, a, b, rad, lw = w) => {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.roundRect(x + j(1.5), y + j(1.5), a, b, rad); g.stroke();
  };
  const cross = (x, y, a, b, lw = w * 0.6) => {
    if (clean) { g.fillStyle = '#e4ddd1'; g.fillRect(x + 2, y + 2, a - 4, b - 4); g.strokeStyle = '#b7aea2'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + a, y + b); g.moveTo(x + a, y); g.lineTo(x, y + b); g.stroke(); return; }
    line(x, y, x + a, y + b, lw); line(x + a, y, x, y + b, lw);
  };
  const arrow = (x0, y0, x1, y1, lw = w, head = 14) => {
    line(x0, y0, x1, y1, lw);
    const a = Math.atan2(y1 - y0, x1 - x0);
    line(x1, y1, x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45), lw);
    line(x1, y1, x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45), lw);
  };
  const text = (s, x, y, size, { align = 'left', font = clean ? SANS : HAND, colour = col, weight = clean ? 500 : 400 } = {}) => {
    if (clean) size *= 0.82;
    g.fillStyle = colour; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
  };
  const scribble = (x, y, len, lw = w * 0.7) => { if (clean) { g.fillStyle = '#b7aea2'; g.fillRect(x, y - lw, len * 0.8, lw * 2.2); return; } let xx = x; while (xx < x + len) { const s = 8 + r() * 26; line(xx, y + j(3), Math.min(x + len, xx + s), y + j(3), lw); xx += s + 6 + r() * 6; } };
  return { line, rect, round, cross, arrow, text, scribble, r };
}

// ---- the screens -------------------------------------------------------------------------------------------
/** Figma: the app's ~50 screens on the canvas, layers on the left, properties on the right */
function figmaTex(phoneImg) {
  return canvasTex(1920, 1080, (g, W, H) => {
    const r = rngOf(9);
    g.fillStyle = '#e5e2dd'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2c2c2c'; g.fillRect(0, 0, W, 48);
    for (let i = 0; i < 7; i++) { g.fillStyle = i === 1 ? '#cd7d42' : '#5a5a5a'; g.fillRect(14 + i * 42, 13, 24, 22); }
    g.fillStyle = '#e8e8e8'; g.font = `500 18px ${SANS}`; g.textAlign = 'center'; g.fillText('Duriza / App — Mobile', W / 2, 31);
    g.fillStyle = '#cd7d42'; g.beginPath(); g.roundRect(W - 110, 10, 90, 28, 6); g.fill(); g.fillStyle = '#fff'; g.fillText('Share', W - 65, 30);
    // the panels
    g.fillStyle = '#ffffff'; g.fillRect(0, 48, 250, H - 48); g.fillRect(W - 270, 48, 270, H - 48);
    g.fillStyle = '#d9d6d1'; g.fillRect(250, 48, 1, H); g.fillRect(W - 270, 48, 1, H);
    g.textAlign = 'left'; g.fillStyle = '#333'; g.font = `500 16px ${SANS}`; g.fillText('Layers', 16, 80);
    const layers = ['Home', 'Home — dark', 'Shop', 'Product', 'Cart', 'Checkout', 'Search', 'Account', 'Onboarding 1', 'Onboarding 2', 'Order done', 'Components', 'Tokens'];
    layers.forEach((n, i) => {
      if (i === 0) { g.fillStyle = '#f6e3d3'; g.fillRect(0, 96 + i * 34, 250, 32); }
      g.fillStyle = '#9b9b9b'; g.fillRect(18, 106 + i * 34, 12, 12);
      g.fillStyle = '#333'; g.font = `400 15px ${SANS}`; g.fillText(n, 40, 117 + i * 34);
    });
    g.font = `500 16px ${SANS}`; g.fillText('Design', W - 254, 80);
    for (let i = 0; i < 16; i++) { g.fillStyle = '#ebe8e3'; g.fillRect(W - 254, 100 + i * 46, 238, 32); g.fillStyle = '#8a8a8a'; g.fillRect(W - 244, 112 + i * 46, 50 + r() * 90, 8); }
    ['#f6aa73', '#774a27', '#cd7d42', '#3d2b15', '#f4ead9'].forEach((c, i) => { g.fillStyle = c; g.fillRect(W - 244 + i * 44, 860, 34, 34); });
    // the canvas: 5 rows of 10 screens
    const fw = 112, fh = 232, gx = 300, gy = 92, sx = 132, sy = 196 + 0;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 10; col++) {
      const x = gx + col * sx, y = gy + row * (fh + 22);
      if (y + fh > H - 10) continue;
      const k = row * 10 + col;
      g.fillStyle = '#8b8b8b'; g.font = `400 10px ${SANS}`; g.fillText(layers[k % 11], x, y - 5);
      g.fillStyle = k % 9 === 1 ? '#2a211b' : '#ffffff'; g.fillRect(x, y, fw, fh);
      const dark = k % 9 === 1;
      if (phoneImg && k % 4 === 0) g.drawImage(phoneImg, 0, 60, phoneImg.width, phoneImg.width * 0.95, x, y + 18, fw, fw * 0.95);
      else { g.fillStyle = dark ? '#4a3a2e' : ['#f3d8c2', '#e9e4dc', '#f6c9a6'][k % 3]; g.fillRect(x + 8, y + 22, fw - 16, 70 + (k % 3) * 10); }
      g.fillStyle = dark ? '#d8c6b6' : '#c9c4bd';
      for (let i = 0; i < 4; i++) g.fillRect(x + 8, y + 112 + i * 14 + (k % 3) * 10, fw - 24 - ((i * 13 + k) % 30), 6);
      g.fillStyle = '#3d2b15'; g.fillRect(x + 8, y + fh - 40, fw - 16, 22);
      if (k === 11) { g.strokeStyle = '#cd7d42'; g.lineWidth = 3; g.strokeRect(x - 3, y - 3, fw + 6, fh + 6); }
    }
  });
}

/** VS Code, dark: the Duriza product card in React */
function codeTex() {
  return canvasTex(1080, 1920, (g, W, H) => {
    g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#333333'; g.fillRect(0, 0, 56, H);
    for (let i = 0; i < 5; i++) { g.fillStyle = i === 0 ? '#d0d0d0' : '#7a7a7a'; g.fillRect(16, 24 + i * 60, 24, 24); }
    g.fillStyle = '#252526'; g.fillRect(56, 0, 260, H);
    g.font = `500 17px ${SANS}`; g.fillStyle = '#bbbbbb'; g.textAlign = 'left'; g.fillText('EXPLORER', 76, 34);
    const files = ['duriza', '  src', '    app', '      page.tsx', '      layout.tsx', '    components', '      Nav.tsx', '      Hero.tsx', '      ProductCard.tsx', '      Cart.tsx', '      WhatsApp.tsx', '    lib', '      cart.ts', '      api.ts', '    styles', '      tokens.css', '  public', '  package.json', '  next.config.js'];
    files.forEach((f, i) => {
      if (f.includes('ProductCard')) { g.fillStyle = '#37373d'; g.fillRect(56, 54 + i * 34, 260, 32); }
      g.fillStyle = f.endsWith('.tsx') ? '#e8a76f' : f.includes('.') ? '#c8b89e' : '#cccccc';
      g.font = `400 17px ${SANS}`; g.fillText(f, 76, 76 + i * 34);
    });
    g.fillStyle = '#2d2d2d'; g.fillRect(316, 0, W - 316, 44);
    [['ProductCard.tsx', true], ['Cart.tsx', false], ['tokens.css', false]].forEach(([t, on], i) => {
      g.fillStyle = on ? '#1e1e1e' : '#2d2d2d'; g.fillRect(316 + i * 200, 0, 198, 44);
      g.fillStyle = on ? '#ffffff' : '#9a9a9a'; g.font = `400 16px ${SANS}`; g.fillText(t, 336 + i * 200, 28);
    });
    const K = '#d58fd0', S = '#e8a76f', T = '#7fc3b5', V = '#9cdcfe', F = '#e2d48a', C = '#7b8a6a', P = '#d4d4d4';
    const code = [
      [[C, '// one product, as a card in the grid']],
      [[K, 'import '], [P, '{ '], [V, 'useCart'], [P, ' } '], [K, 'from '], [S, "'@/lib/cart'"]],
      [[K, 'import '], [V, 'Image'], [K, ' from '], [S, "'next/image'"]],
      [],
      [[K, 'type '], [T, 'Props'], [P, ' = { '], [V, 'product'], [P, ': '], [T, 'Product'], [P, ' }']],
      [],
      [[K, 'export default function '], [F, 'ProductCard'], [P, '({ '], [V, 'product'], [P, ' }: '], [T, 'Props'], [P, ') {']],
      [[P, '  '], [K, 'const '], [P, '{ '], [V, 'add'], [P, ' } = '], [F, 'useCart'], [P, '()']],
      [[P, '  '], [K, 'return '], [P, '(']],
      [[P, '    <'], [T, 'article'], [V, ' className'], [P, '='], [S, '"card"'], [P, '>']],
      [[P, '      <'], [T, 'Image'], [V, ' src'], [P, '={'], [V, 'product'], [P, '.'], [V, 'photo'], [P, '}']],
      [[P, '        '], [V, 'alt'], [P, '={'], [V, 'product'], [P, '.'], [V, 'name'], [P, '} '], [V, 'fill'], [P, ' />']],
      [[P, '      <'], [T, 'h3'], [P, '>{'], [V, 'product'], [P, '.'], [V, 'name'], [P, '}</'], [T, 'h3'], [P, '>']],
      [[P, '      <'], [T, 'p'], [V, ' className'], [P, '='], [S, '"price"'], [P, '>']],
      [[P, '        {'], [V, 'product'], [P, '.'], [V, 'price'], [P, '} '], [S, 'EGP']],
      [[P, '      </'], [T, 'p'], [P, '>']],
      [[P, '      <'], [T, 'button'], [V, ' onClick'], [P, '={() => '], [F, 'add'], [P, '('], [V, 'product'], [P, ')}>']],
      [[P, '        '], [S, 'Add to cart']],
      [[P, '      </'], [T, 'button'], [P, '>']],
      [[P, '    </'], [T, 'article'], [P, '>']],
      [[P, '  )']],
      [[P, '}']],
      [],
      [[C, '// the grid: two columns on a phone (review, v2)']],
      [[K, 'export function '], [F, 'Grid'], [P, '({ '], [V, 'items'], [P, ' }) {']],
      [[P, '  '], [K, 'return '], [P, '<'], [T, 'section'], [V, ' className'], [P, '='], [S, '"grid cols-2"'], [P, '>']],
      [[P, '    {'], [V, 'items'], [P, '.'], [F, 'map'], [P, '('], [V, 'p'], [P, ' =>']],
      [[P, '      <'], [T, 'ProductCard'], [V, ' key'], [P, '={'], [V, 'p'], [P, '.'], [V, 'id'], [P, '} '], [V, 'product'], [P, '={'], [V, 'p'], [P, '} />)}']],
      [[P, '  </'], [T, 'section'], [P, '>']],
      [[P, '}']],
    ];
    g.font = `500 21px ${MONO}`;
    code.forEach((ln, i) => {
      const y = 86 + i * 34;
      g.fillStyle = '#6e6e6e'; g.textAlign = 'right'; g.fillText(String(i + 1), 376, y);
      g.textAlign = 'left';
      let x = 400;
      for (const [c, s] of ln) { g.fillStyle = c; g.fillText(s, x, y); x += g.measureText(s).width; }
    });
    g.fillStyle = '#264f78'; g.fillRect(400, 86 + 16 * 34 - 24, 2, 30);
    // the terminal
    g.fillStyle = '#181818'; g.fillRect(316, 1340, W - 316, H - 1380);
    g.fillStyle = '#9a9a9a'; g.font = `500 16px ${SANS}`; g.fillText('TERMINAL', 336, 1374);
    g.font = `400 19px ${MONO}`;
    [['#7fc3b5', '$ npm run dev'], ['#d4d4d4', '  ▲ Next.js 15.1  ·  Local: http://localhost:3000'], ['#e8a76f', '  ✓ Ready in 1.2s'], ['#d4d4d4', '  ✓ Compiled /  in 340ms']].forEach(([c, s], i) => { g.fillStyle = c; g.fillText(s, 336, 1414 + i * 32); });
    g.fillStyle = '#cd7d42'; g.fillRect(0, H - 40, W, 40);
    g.fillStyle = '#fff'; g.font = `400 16px ${SANS}`; g.fillText('main  ✓  Duriza  ·  Ln 17, Col 9  ·  TypeScript JSX', 70, H - 14);
  });
}

/** a phone's screen, off: dark glass with a soft reflection, its corners rounded */
function phoneOffTex(island) {
  return canvasTex(400, 860, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.roundRect(0, 0, W, H, island ? 58 : 6); g.clip();
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2b2622'); gr.addColorStop(0.45, '#151210'); gr.addColorStop(1, '#0d0b0a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,240,225,0.06)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.7, 0); g.lineTo(0, H * 0.45); g.fill();
    if (island) { g.fillStyle = '#000'; g.beginPath(); g.roundRect(W / 2 - 62, 22, 124, 36, 18); g.fill(); }
  }, { alpha: true });
}

// ---- the dot-grid notebook ---------------------------------------------------------------------------------
const PAGE = [1024, 1459];
function dotGrid(g, W, H) {
  g.fillStyle = '#f6efe2'; g.fillRect(0, 0, W, H);
  const s = W / 29.2;
  g.fillStyle = '#c4b8a4';
  for (let y = s * 0.8; y < H - s * 0.4; y += s) for (let x = s * 0.6; x < W - s * 0.3; x += s) { g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill(); }
}
/** the left page: Duriza's sitemap (in pencil, or drawn clean) */
function sitemapTex(clean = false) {
  return canvasTex(...PAGE, (g, W, H) => {
    dotGrid(g, W, H);
    const h = hand(g, 21, { w: clean ? 2.2 : 3, clean, col: clean ? '#5a5148' : LEAD });
    h.text('DURIZA', 70, 120, 58); h.text('— sitemap', 300, 120, 40);
    h.line(70, 138, 520, 140, 2.4);
    const box = (cx, y, t, w = 190) => { h.rect(cx - w / 2, y, w, 70, 3); h.text(t, cx, y + 47, 32, { align: 'center' }); };
    box(W / 2, 220, 'Home', 210);
    const kids = [[170, 'Shop'], [400, 'About'], [624, 'Contact'], [854, 'Account']];
    h.line(W / 2, 290, W / 2, 340); h.line(170, 340, 854, 342);
    kids.forEach(([x, t]) => { h.line(x, 340, x, 380); box(x, 380, t, 180); });
    const cats = ['Necklaces', 'Rings', 'Bracelets', 'Earrings'];
    h.line(170, 450, 170, 1010);
    cats.forEach((t, i) => { const y = 500 + i * 110; h.line(170, y + 35, 230, y + 35); h.rect(230, y, 230, 64, 2.6); h.text(t, 345, y + 44, 30, { align: 'center' }); });
    h.arrow(460, 532, 600, 640);
    box(700, 640, 'Product', 200); h.arrow(700, 710, 700, 790); box(700, 790, 'Cart', 180); h.arrow(700, 860, 700, 940); box(700, 940, 'Checkout', 220);
    h.arrow(700, 1010, 700, 1090); box(700, 1090, 'Order done', 240);
    h.line(854, 450, 854, 520); h.text('orders', 854, 560, 28, { align: 'center' }); h.text('wishlist', 854, 600, 28, { align: 'center' });
    h.text('search', 400, 520, 28, { align: 'center' }); h.line(400, 450, 400, 490);
    h.text('WhatsApp on every page', 80, 1250, 34); h.arrow(470, 1238, 560, 1200, 2.6);
    h.text('v1 · 12 screens', 80, 1330, 30);
  });
}
/** the right page: Duriza's Home screen in pencil, with his notes around it (or drawn clean) */
function homeSketchTex(clean = false) {
  return canvasTex(...PAGE, (g, W, H) => {
    dotGrid(g, W, H);
    const h = hand(g, 33, { w: clean ? 2.2 : 3, clean, col: clean ? '#5a5148' : LEAD });
    if (clean) { g.fillStyle = '#fbf8f2'; g.beginPath(); g.roundRect(262, 150, 500, 1084, 52); g.fill(); }
    h.text('Home v1', 60, 100, 46);
    const px = 262, py = 150, pw = 500, ph = 1084;                      // the phone, 9 : 19.5
    h.round(px, py, pw, ph, 52, 4);
    h.line(px + pw / 2 - 60, py + 30, px + pw / 2 + 60, py + 30, 5);
    // the banner, the nav
    h.rect(px + 26, py + 64, pw - 52, 44, 2.2); h.scribble(px + 70, py + 88, pw - 140, 2);
    h.text('Duriza', px + 40, py + 170, 40); h.round(px + pw - 132, py + 136, 40, 40, 6, 2.6); h.line(px + pw - 72, py + 146, px + pw - 36, py + 146); h.line(px + pw - 72, py + 158, px + pw - 36, py + 158); h.line(px + pw - 72, py + 170, px + pw - 36, py + 170);
    // the hero: a photo, a line, the button
    h.rect(px + 26, py + 206, pw - 52, 330, 3); h.cross(px + 26, py + 206, pw - 52, 330);
    h.round(px + pw / 2 - 110, py + 470, 220, 50, 6, 3.4); h.text('SHOP NOW', px + pw / 2, py + 504, 26, { align: 'center' });
    // the products: one column, a card each
    h.text('New in', px + 30, py + 590, 32);
    for (let i = 0; i < 2; i++) {
      const y = py + 616 + i * 230;
      h.rect(px + 26, y, pw - 52, 210, 2.6); h.rect(px + 42, y + 16, 170, 178, 2.2); h.cross(px + 42, y + 16, 170, 178);
      h.scribble(px + 232, y + 50, 180, 2.4); h.scribble(px + 232, y + 90, 120, 2); h.text('950 EGP', px + 232, y + 150, 26);
    }
    // WhatsApp, floating
    g.beginPath(); g.strokeStyle = LEAD; g.lineWidth = 3.4; g.arc(px + pw - 62, py + ph - 70, 34, 0, Math.PI * 2); g.stroke();
    h.text('W', px + pw - 62, py + ph - 58, 30, { align: 'center' });
    // his notes
    h.text('real photo,', 790, 380, 30); h.text('full bleed', 790, 418, 30); h.arrow(800, 440, px + pw - 30, py + 330, 2.6);
    h.text('sticky nav', 40, 330, 30); h.arrow(110, 346, px + 30, py + 160, 2.6);
    h.text('CTA!', 60, 660, 36); h.arrow(140, 650, px + pw / 2 - 118, py + 495, 2.8);
    h.text('1 col?', 800, 900, 30);
    h.text('always', 800, 1170, 28); h.text('there', 800, 1204, 28); h.arrow(800, 1186, px + pw - 22, py + ph - 72, 2.4);
  });
}

/** the right page as the pointer shows it: the Home screen as it really is, in the sketch's place */
function homeRealTex(img) {
  return canvasTex(...PAGE, (g, W, H) => {
    dotGrid(g, W, H);
    const px = 262, py = 150, pw = 500, ph = 1084;
    g.save(); g.beginPath(); g.roundRect(px, py, pw, ph, 52); g.clip();
    drawScreen(g, px, py, pw, ph, 2, img);
    g.restore();
    g.strokeStyle = '#2d2620'; g.lineWidth = 5; g.beginPath(); g.roundRect(px, py, pw, ph, 52); g.stroke();
    const h = hand(g, 33, { w: 2.2, clean: true, col: '#5a5148' });
    h.text('Home — final', 60, 100, 46);
  });
}

// ---- the sticky notes, the boards, the printout -----------------------------------------------------------
function notesTex(notes) {
  return canvasTex(1024, 512, (g, W, H) => {
    g.fillStyle = '#f6efe2'; g.fillRect(0, 0, W, H);
    notes.forEach((n) => {
      const x = (n.cell % 8) * 128, y = Math.floor(n.cell / 8) * 128;
      g.fillStyle = NOTE[n.colour] ?? NOTE.yellow; g.fillRect(x, y, 128, 128);
      const gr = g.createLinearGradient(0, y + 80, 0, y + 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,50,20,0.14)');
      g.fillStyle = gr; g.fillRect(x, y + 80, 128, 48);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, 128, 22);
      g.fillStyle = INK; g.textAlign = 'center';
      const words = n.text.split(' ');
      const big = n.where === 'flow';
      g.font = `400 ${big ? 25 : 21}px ${HAND}`;
      const lines = []; let cur = '';
      for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > 108 && cur) { lines.push(cur); cur = w; } else cur = t; }
      lines.push(cur);
      lines.forEach((l, i) => g.fillText(l, x + 64, y + 64 + (i - (lines.length - 1) / 2) * 28 + 8));
    });
  });
}
function kanbanTex() {
  return canvasTex(1600, 1030, (g, W, H) => {
    g.fillStyle = '#fbf9f4'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(120,100,80,0.05)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(200 + i * 160, 300 + (i % 3) * 220, 140, 50, 0.2, 0, Math.PI * 2); g.fill(); }
    const h = hand(g, 7, { w: 6, col: '#3a2a1c' });
    ['TO DO', 'IN PROGRESS', 'DONE'].forEach((t, i) => { const cx = (i + 0.5) * W / 3; h.text(t, cx, 92, 62, { align: 'center' }); h.line(cx - 150, 112, cx + 150, 114, 4); });
    h.line(W / 3, 40, W / 3 + 4, H - 40, 4); h.line(2 * W / 3, 40, 2 * W / 3 - 3, H - 40, 4);
    h.text('sprint 4 · Duriza', 30, H - 30, 34, { colour: '#8a5a38' });
    h.text('✓', 2 * W / 3 + 40, H - 60, 48, { colour: '#8a5a38' });
  });
}
function glassTex() {
  return canvasTex(2048, 1350, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const h = hand(g, 13, { w: 6, col: '#3a2a1c' }), red = hand(g, 14, { w: 6, col: '#b8532f' });
    // the user flow along the top: arrows between the notes (set.py puts them 0.17 m apart from x 0.1 m)
    h.text('USER FLOW', 40, 66, 46);
    const nx = (j) => ((0.1 + j * 0.17) / 1.04) * W, ny = (0.11 / 0.69) * H;
    for (let j = 0; j < 5; j++) h.arrow(nx(j) + 86, ny, nx(j + 1) - 86, ny, 5, 22);
    red.text('2 taps to cart', nx(2) - 40, ny + 130, 36);
    // a wireframe: the product page
    const ox = 70, oy = 430;
    h.round(ox, oy, 300, 640, 34, 5); h.rect(ox + 22, oy + 70, 256, 230, 4); h.cross(ox + 22, oy + 70, 256, 230, 3);
    for (let i = 0; i < 3; i++) h.line(ox + 26, oy + 340 + i * 40, ox + 230 - i * 40, oy + 340 + i * 40, 4);
    h.rect(ox + 22, oy + 540, 256, 60, 4); h.text('Product', ox, oy - 20, 40);
    // a flowchart: add to cart
    const fx = 560;
    h.round(fx + 40, 440, 260, 70, 35, 5); h.text('add to cart', fx + 170, 486, 36, { align: 'center' });
    h.arrow(fx + 170, 510, fx + 170, 570, 5);
    h.line(fx + 170, 580, fx + 300, 660, 5); h.line(fx + 300, 660, fx + 170, 740, 5); h.line(fx + 170, 740, fx + 40, 660, 5); h.line(fx + 40, 660, fx + 170, 580, 5);
    h.text('in stock?', fx + 170, 672, 32, { align: 'center' });
    h.arrow(fx + 170, 740, fx + 170, 820, 5); h.text('yes', fx + 186, 790, 30);
    h.rect(fx + 50, 820, 240, 70, 5); h.text('update badge', fx + 170, 866, 32, { align: 'center' });
    h.arrow(fx + 300, 660, fx + 430, 660, 5); h.text('no', fx + 330, 645, 30);
    h.rect(fx + 430, 625, 200, 70, 5); h.text('notify me', fx + 530, 671, 32, { align: 'center' });
    // the system: the app, its API, what is behind it
    const sx = 1300;
    h.text('ARCHITECTURE', sx, 420, 44);
    const node = (x, y, t, w = 230) => { h.rect(x, y, w, 76, 5); h.text(t, x + w / 2, y + 50, 32, { align: 'center' }); };
    node(sx, 470, 'Next.js app'); node(sx + 400, 470, 'CDN / images', 260);
    node(sx, 680, 'API routes'); node(sx + 400, 640, 'Auth', 200); node(sx + 400, 780, 'Payments', 230);
    node(sx, 900, 'Postgres'); node(sx + 400, 940, 'WhatsApp API', 270);
    h.arrow(sx + 230, 508, sx + 400, 508, 5); h.arrow(sx + 115, 546, sx + 115, 680, 5); h.arrow(sx + 230, 710, sx + 400, 678, 5);
    h.arrow(sx + 230, 728, sx + 400, 818, 5); h.arrow(sx + 115, 756, sx + 115, 900, 5); h.arrow(sx + 230, 740, sx + 400, 976, 5);
    red.round(sx - 30, 880, 300, 120, 50, 5);
  }, { alpha: true });
}
/** the Home screen as Figma prints it: what his teammate reviews with the red pen */
function printTex(phoneImg) {
  return canvasTex(1240, 1754, (g, W, H) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b2b2b'; g.font = `500 34px ${SANS}`; g.textAlign = 'left'; g.fillText('Duriza — Home  v1', 90, 110);
    g.fillStyle = '#8a8a8a'; g.font = `400 24px ${SANS}`; g.fillText('Mobile · 390 × 844 · for review', 90, 150);
    const px = 370, py = 220, pw = 500, ph = 1084;
    g.fillStyle = '#f2f0ec'; g.beginPath(); g.roundRect(px, py, pw, ph, 46); g.fill(); g.strokeStyle = '#9a9a9a'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#e1ddd6'; g.fillRect(px + 24, py + 60, pw - 48, 40);
    g.fillStyle = '#3d3d3d'; g.font = `600 34px ${SANS}`; g.fillText('Duriza', px + 36, py + 158);
    g.fillStyle = '#bdb8b0'; g.fillRect(px + pw - 120, py + 128, 34, 34); g.fillRect(px + pw - 70, py + 132, 36, 6); g.fillRect(px + pw - 70, py + 145, 36, 6); g.fillRect(px + pw - 70, py + 158, 36, 6);
    if (phoneImg) g.drawImage(phoneImg, 0, 120, phoneImg.width, phoneImg.width * 0.66, px + 24, py + 196, pw - 48, 330);
    else { g.fillStyle = '#d6d1c9'; g.fillRect(px + 24, py + 196, pw - 48, 330); }
    g.fillStyle = '#2f3d33'; g.fillRect(px + pw / 2 - 110, py + 460, 220, 50); g.fillStyle = '#fff'; g.font = `600 20px ${SANS}`; g.textAlign = 'center'; g.fillText('SHOP NOW', px + pw / 2, py + 492);
    g.textAlign = 'left'; g.fillStyle = '#3d3d3d'; g.font = `600 28px ${SANS}`; g.fillText('New in', px + 30, py + 584);
    for (let i = 0; i < 2; i++) {
      const y = py + 610 + i * 230;
      g.fillStyle = '#ffffff'; g.fillRect(px + 24, y, pw - 48, 210); g.strokeStyle = '#d0ccc5'; g.lineWidth = 2; g.strokeRect(px + 24, y, pw - 48, 210);
      g.fillStyle = '#d6d1c9'; g.fillRect(px + 40, y + 16, 170, 178);
      g.fillStyle = '#9a958d'; g.fillRect(px + 230, y + 40, 190, 14); g.fillRect(px + 230, y + 70, 130, 12);
      g.fillStyle = '#3d3d3d'; g.font = `600 24px ${SANS}`; g.fillText('950 EGP', px + 230, y + 150);
    }
    g.fillStyle = '#3f8f5a'; g.beginPath(); g.arc(px + pw - 62, py + ph - 70, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b0aba3'; g.font = `400 20px ${SANS}`; g.fillText('Page 1 of 3', 90, H - 80);
  });
}

/** the room: loads it, dresses it; returns { group, meshes, info } */
export async function buildSet({ U, renderer, edgeMat, name = 'set' }) {
  const PROJ = [['duriza', 'Duriza'], ['synergy', 'Synergy'], ['sondos', 'Sondos'], ['adham-paper', 'Adham'], ['monopoly-eg', 'Ganeeh']];
  const [gltf, lm, info, phoneImg, deskImg, ...shots] = await Promise.all([
    new GLTFLoader().loadAsync(`./inside/${name}.glb`),
    loadLightmap(`./inside/${name}-light.png`),
    fetch(`./inside/${name}-info.json`).then((r) => r.json()),
    loadImage('./inside/work/live/duriza-phone.jpg'),
    loadImage('./inside/work/live/duriza-desk.jpg'),
    ...PROJ.flatMap(([f]) => [loadImage(`./inside/work/live/${f}-desk.jpg`), loadImage(`./inside/work/live/${f}-phone.jpg`)]),
    document.fonts?.load(`400 30px ${HAND}`).catch(() => {}),
  ]);
  const work = PROJ.map(([, name], i) => ({ name, desk: shots[i * 2], phone: shots[i * 2 + 1] }));
  // the tower's drawings, made from its model (tools/blender/ych.py --draw): plan, front, three-quarter
  const dr = {};
  await Promise.all(['plan', 'elev'].flatMap((v) => ['pencil', 'clean', 'real'].map(async (m) => { dr[`${v}-${m}`] = await loadImage(`./inside/draw/ych-${v}-${m}.webp`); }))
    .concat(['pencil', 'shade'].map(async (m) => { dr[`axo-${m}`] = await loadImage(`./inside/draw/ych-axo-${m}.webp`); })));
  work.draw = dr;
  lm.flipY = false;
  lm.colorSpace = THREE.NoColorSpace;
  lm.anisotropy = renderer.capabilities.getMaxAnisotropy();
  lm.channel = 1;
  const macTex = new THREE.Texture(deskImg); macTex.colorSpace = THREE.SRGBColorSpace; macTex.flipY = false; macTex.needsUpdate = !!deskImg;
  const pics = {
    scr_figma: { map: figmaTex(phoneImg), flat: true },
    scr_code: { map: codeTex(), flat: true },
    scr_mac: { map: macTex, flat: true },
    scr_iphone: { map: phoneOffTex(true), flat: true, alphaTest: 0.5 },
    scr_android: { map: phoneOffTex(false), flat: true, alphaTest: 0.5 },
    nb_left: { map: sitemapTex(), dress: true, reveal: sitemapTex(true), clean: sitemapTex(true) },
    nb_right: { map: homeSketchTex(), dress: true, reveal: homeRealTex(phoneImg), clean: homeSketchTex(true) },
    notes: { map: notesTex(info.notes) },
    board_kanban: { map: kanbanTex() },
    board_glass: { map: glassTex(), transparent: true },
    print_review: { map: printTex(phoneImg) },
    // the room as theirs (set2.py): the tracing sheet over the printout, his whole flow on it; the poster
    sheet_flow: { map: flowSheetTex(0, work), dress: true, reveal: flowSheetTex(2, work), clean: flowSheetTex(1, work), transparent: true, opacity: 0.86 },
    poster: { map: posterTex() },
    scr_tablet: { map: screensTex(false, work), dress: true, clean: screensTex(true, work), flat: true },
  };
  const byName = new Map();
  const group = gltf.scene;
  group.traverse((o) => {
    if (!o.isMesh) return;
    byName.set(o.name, o);
    o.receiveShadow = true;
    o.castShadow = false;
    const pic = pics[o.name];
    if (pic) {
      o.material = paint(U, { baked: pic.flat ? null : lm, noise: pic.flat ? 0.35 : 1, ...pic });
      if (pic.clean) { o.material.userData.uniforms.tDress.value = pic.clean; o.material.userData.uniforms.uEdge.value.set('#9b8d7c'); }
      return;
    }
    if (o.name === 'glass') {                    // the glass board: a pale pane, the wall through it
      o.material = paint(U, { baked: lm, transparent: true, opacity: 0.22, tint: 1.08 });
      return;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => paint(U, { baked: lm, tint: m.color.clone(), noise: 0.6 }));
    o.material = Array.isArray(o.material) ? out : out[0];
    // their outlines: the creases only (a cable's or a bevel's facets stay unlined)
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 50), edgeMat));
  });
  return { group, byName, info, lightmap: lm, pics, makePrintout: () => makePrintout(U, edgeMat, work), makeRoll: () => makeRoll(U, edgeMat, work.draw), makeCover: () => makeCover(U, edgeMat, byName) };
}

// =====================================================================================================
// the room as theirs: the sheet of tracing paper with his whole flow, and the things that move
// =====================================================================================================
const SHEET = { w: 1.07, d: 0.93, cx: -0.0005, cz: 0.0395, px: 2048 };
SHEET.ph = Math.round(SHEET.px * SHEET.d / SHEET.w);
/** a point of the room (x, z) on the sheet's picture */
const onSheet = (x, z) => [((x - SHEET.cx) / SHEET.w + 0.5) * SHEET.px, ((z - SHEET.cz) / SHEET.d + 0.5) * SHEET.ph];
/** the Yellow Crane Tower's ground plan on the sheet, where the tower rises (tools/blender/ych.py's numbers at
 *  1:120, about the pivot (-0.051, 0.074), a quarter turned as it stands before its turn): the terrace and its
 *  balustrade, the stairs, the eaves' line dashed, the columns, the walls, the doors, the grid, the pines, a
 *  dimension, north. mode 0 pencil, 1 clean, 2 in its colours */
function drawPlan(g, h, mode, W, H) {
  const K = 1 / 120, real = mode === 2, clean = mode > 0;
  const Wg = (30 - 5.2) * K, bw = Wg * 0.52, bp = 2.6 * K, bd = 2.4 * K;
  const P = (x, z) => onSheet(-0.051 - z, 0.074 + x);           // (the tower's x, z as it ends -> the sheet, turned)
  const px = (m) => m / SHEET.w * W;
  const ink = real ? '#3a2a1c' : clean ? '#3b332c' : LEAD;
  const cross = (w, b, out) => {
    const hh = w / 2, bb = b / 2, pts = [];
    for (const ang of [0, 90, 180, 270]) {
      const c = Math.cos(ang * Math.PI / 180), s_ = Math.sin(ang * Math.PI / 180);
      const R = (x, z) => [x * c - z * s_, x * s_ + z * c];
      pts.push(R(hh, -hh), R(hh, -bb), R(hh + out, -bb), R(hh + out, bb), R(hh, bb));
    }
    return pts;
  };
  const poly = (pts, lw, col = ink, fill = null, dash = null) => {
    g.save();
    if (dash) g.setLineDash(dash);
    g.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = P(x, z); const j = clean || dash ? 0 : (Math.sin(i * 12.9 + x * 50) * 2.2); i ? g.lineTo(a + j, b - j) : g.moveTo(a, b); });
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
    g.restore();
  };
  // the pines round it (their crowns, hatched in pencil)
  const pines = [[0.225, -0.13, 1.25], [0.235, 0.12, 1.05], [0.06, 0.235, 1.2], [-0.14, 0.215, 1.35], [-0.235, -0.03, 1.1], [-0.09, -0.225, 1.3], [0.15, -0.235, 0.95]];
  for (const [x, z, k] of pines) {
    const [a, b] = P(x, z), r = px(0.032 * k);
    g.save(); g.beginPath(); g.arc(a, b, r, 0, Math.PI * 2);
    if (real) { g.fillStyle = '#a9bc8f'; g.fill(); }
    g.strokeStyle = ink; g.lineWidth = clean ? 2.4 : 3; g.stroke();
    if (!real) { g.clip(); g.lineWidth = 1.6; for (let t = -r; t < r; t += 9) { g.beginPath(); g.moveTo(a + t, b - r); g.lineTo(a + t + r, b + r); g.stroke(); } }
    g.restore();
    g.fillStyle = ink; g.beginPath(); g.arc(a, b, 4, 0, Math.PI * 2); g.fill();
  }
  // the terrace, its balustrade a double line with posts; the stairs down the front
  const T = 19 * K;
  poly([[T, -T], [T, T], [-T, T], [-T, -T]], clean ? 4 : 5, ink, real ? '#ebe3d5' : null);
  poly([[T - 0.006, -T + 0.006], [T - 0.006, T - 0.006], [-T + 0.006, T - 0.006], [-T + 0.006, -T + 0.006]], 2, ink);
  for (let i = 0; i <= 14; i++) {
    const t = -T + 2 * T * i / 14;
    for (const [x, z] of [[T - 0.003, t], [-T + 0.003, t], [t, T - 0.003], [t, -T + 0.003]]) {
      if (x > 0 && Math.abs(z) < 0.05 && Math.abs(x - (T - 0.003)) < 1e-6) continue;
      const [a, b] = P(x, z); g.fillStyle = ink; g.fillRect(a - 3, b - 3, 6, 6);
    }
  }
  for (let i = 0; i <= 6; i++) { const x = T + i * 0.006; const [a, b] = P(x, -0.05), [c, d] = P(x, 0.05); h.line(a, b, c, d, i === 0 ? 3 : 2.2); }
  { const [a, b] = P(T + 0.036, -0.05), [c, d] = P(T + 0.036, 0.05); h.line(a, b, c, d, 2.2); }
  { const [a, b] = P(T + 0.04, 0), [c, d] = P(T + 0.004, 0); h.arrow(a, b, c, d, 2.4, 16); }
  // the eaves above, their line dashed
  const ov = 4.6 * K;
  poly(cross(Wg + 2 * ov, bw + 2 * ov * 0.95, bp - ov * 0.05), 2.4, real ? '#c98a2a' : ink, null, [16, 11]);
  // the floor inside, then the walls (thick), the columns (filled), the doors
  const inner = cross(Wg - 2 * bd, Math.max(bw - 2 * bd, bw * 0.6), bp);
  if (real) poly(inner, 0, ink, '#f4e5c9');
  poly(inner, clean ? 9 : 11, real ? '#9b3b33' : ink);
  const outline = cross(Wg, bw, bp);
  const cols = [];
  outline.forEach((a, i) => { const b = outline[(i + 1) % outline.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / (4.2 * K))); for (let j = 0; j < n; j++) cols.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); });
  for (const [x, z] of cols) { const [a, b] = P(x, z); g.beginPath(); g.arc(a, b, px(0.0042), 0, Math.PI * 2); g.fillStyle = real ? '#a3392f' : ink; g.fill(); }
  // the doors: three openings in the front bay's wall, their leaves swung in
  const fx = (Wg - 2 * bd) / 2 + bp;
  for (const z of [-0.022, 0, 0.022]) {
    const [a, b] = P(fx, z - 0.008), [c, d] = P(fx, z + 0.008);
    g.save(); g.strokeStyle = real ? '#f4e5c9' : '#f4efe6'; g.lineWidth = 14; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.restore();
    const [ox, oy] = P(fx, z - 0.008);
    g.save(); g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.arc(ox, oy, px(0.016), Math.PI / 2, Math.PI); g.stroke(); g.restore();
  }
  // the grid: the column lines, dashed, numbered round the terrace
  const gl = [-Wg / 2, -bw / 2, 0, bw / 2, Wg / 2];
  g.save(); g.setLineDash([22, 8, 4, 8]); g.strokeStyle = ink; g.lineWidth = 1.4; g.globalAlpha = 0.7;
  gl.forEach((v) => { let [a, b] = P(v, -T - 0.03), [c, d] = P(v, T + 0.03); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); [a, b] = P(-T - 0.03, v); [c, d] = P(T + 0.03, v); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  g.restore();
  gl.forEach((v, i) => {
    for (const [lab, x, z] of [['ABCDE'[i], v, -T - 0.042], [String(i + 1), -T - 0.042, v]]) {
      const [a, b] = P(x, z); g.beginPath(); g.arc(a, b, 22, 0, Math.PI * 2); g.fillStyle = real ? '#fbf6ee' : '#f4efe6'; g.fill(); g.strokeStyle = ink; g.lineWidth = 2.2; g.stroke();
      h.text(lab, a, b + 9, 26, { align: 'center' });
    }
  });
  // a dimension under it: the terrace's 38 m
  { const [a, b] = P(-T, T + 0.065), [c, d] = P(T, T + 0.065);
    h.line(a, b, c, d, 2); h.line(a, b - 12, a, b + 12, 2); h.line(c, d - 12, c, d + 12, 2);
    h.text('38.0 m', (a + c) / 2, (b + d) / 2 - 12, 28, { align: 'center' }); }
  // north, and the names
  { const [a, b] = P(-T + 0.02, -T - 0.075); g.beginPath(); g.arc(a, b, 30, 0, Math.PI * 2); g.strokeStyle = ink; g.lineWidth = 2.4; g.stroke();
    g.beginPath(); g.moveTo(a, b - 34); g.lineTo(a - 12, b + 10); g.lineTo(a, b); g.closePath(); g.fillStyle = ink; g.fill(); h.text('N', a, b - 44, 26, { align: 'center' }); }
  const [cx, cy] = P(0, 0);
  h.text('GROUND STOREY', cx, cy - 6, 34, { align: 'center', colour: real ? '#3a2a1c' : undefined, weight: real ? 600 : undefined, font: real ? SANS : undefined });
  h.text('HERO', cx, cy + 34, 30, { align: 'center', colour: real ? '#9b3b33' : undefined, weight: real ? 600 : undefined, font: real ? SANS : undefined });
  { const [a, b] = P(T - 0.02, -T + 0.03); h.text('terrace', a, b, 26); }
  { const [a, b] = P(T + 0.03, 0.06); h.text('up', a, b, 24); }
  { const [a, b] = P(T + 0.085, T + 0.01); h.text(clean ? 'Yellow Crane Tower · ground storey · 1:120' : 'ground floor plan 1:120', a, b, 30); }
}

/** the sheet: his site drawn as the Yellow Crane Tower, in pencil (0), drawn clean (1), or in its colours (2):
 *  its ground plan where the tower will rise (the model's plan, ych.py --draw: 0.36 m square about the pivot
 *  (-0.051, 0.074), turned a quarter as the tower stands before its turn), its front with a section to each
 *  storey, and the sitemap the storeys are */
function flowSheetTex(mode, work) {
  return canvasTex(SHEET.px, SHEET.ph, (g, W, H) => {
    const clean = mode > 0, real = mode === 2;
    const kind = ['pencil', 'clean', 'real'][mode];
    const dr = work.draw || {};
    g.fillStyle = real ? '#f7f2ea' : '#f4efe6'; g.fillRect(0, 0, W, H);
    const h = hand(g, 41, { w: clean ? 2.4 : 3.4, clean, col: clean ? '#5a5148' : LEAD });
    // (the title kept to the sheet's left half, in short lines: the sheet that unrolls later lies over its right
    // half, and cut the long lines off mid-word, 'Yellow Crane Towe')
    h.text('samy.dev — the site,', 70, 110, 58);
    h.text('as the Yellow Crane Tower', 70, 172, 58);
    (clean ? ['黄鹤楼 · inspired by my university,', 'the Egyptian Chinese University ·', 'a storey for each section'] : ['inspired by my uni: ECU', '(Egyptian Chinese)'])
      .forEach((t, i) => h.text(t, 70, 232 + i * 46, 38));
    // the plan, where it rises: drawn as an architect draws it, from the tower's own numbers
    drawPlan(g, h, mode, W, H);
    // the front, low on the right (clear of the plan and of the sheet that unrolls), a section at each storey
    const elev = dr[`elev-${kind}`];
    const eh = H * 0.4, ew = eh / 2, ex = W * 0.69, ey = H * 0.575;
    if (elev) g.drawImage(elev, ex, ey, ew, eh);
    const Y0 = 0.758, TOP = 1.218, mid = (Y0 + TOP) / 2;                // (ych-info.json: the levels; 0.52 m tall drawing)
    const yAt = (y) => ey + ((mid - y) / 0.52 + 0.5) * eh;
    const L = [0.783, 0.888, 0.9647, 1.0355, 1.1005, 1.1563];
    const names = ['HERO · 1440', 'ABOUT · 1280', 'WORK · 1024', 'WORK · 768', 'CONTACT · 390'];
    names.forEach((t, i) => {
      const y = yAt((L[i] + L[i + 1]) / 2);
      h.line(ex + ew * 0.88, y, ex + ew + 22, y, 2);
      h.text(t, ex + ew + 30, y + 9, 26);
    });
    h.text(clean ? 'front · 1:120' : 'front elevation', ex, ey - 10, 30);
    // the sitemap, low on the left
    const sx = W * 0.03, sy = H * 0.66;
    h.text('sitemap', sx, sy, 36);
    const box = (cx, y, t, wd = 150) => { h.rect(cx - wd / 2, y, wd, 50, 2.4); h.text(t, cx, y + 35, 24, { align: 'center' }); };
    const c0 = sx + 190;
    box(c0, sy + 24, 'Home');
    h.line(c0, sy + 74, c0, sy + 100); h.line(c0 - 140, sy + 100, c0 + 140, sy + 100);
    [['About', c0 - 140], ['Work', c0], ['Contact', c0 + 140]].forEach(([t, x]) => { h.line(x, sy + 100, x, sy + 124); box(x, sy + 124, t, 125); });
    work.forEach((p, i) => { const y = sy + 210 + i * 58; h.line(c0, sy + 174 + (i ? (i - 1) * 58 + 50 : 0), c0, y + 25); h.line(c0, y + 25, c0 + 26, y + 25); h.rect(c0 + 26, y, 150, 50, 2.2); h.text(p.name, c0 + 101, y + 35, 23, { align: 'center' }); });
    if (!clean) {
      h.text('every storey = a section', sx, sy + 540, 30);
      h.text('Work = the middle storeys', W * 0.69, H * 0.985, 28);
    }
  }, { alpha: false });
}

/** his design system, framed on the wall: colour, type, the button, the card */
function posterTex() {
  return canvasTex(1320, 1900, (g, W, H) => {
    g.fillStyle = '#f7f1e6'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2d2620'; g.font = `500 64px ${SANS}`; g.textAlign = 'left'; g.fillText('Duriza — design system', 90, 150);
    g.fillStyle = '#8a7a6a'; g.font = `400 32px ${SANS}`; g.fillText('tokens · type · components', 90, 205);
    ['#c49a3c', '#24372c', '#efe6da', '#2d2620', '#3a9a5c', '#fbf8f3'].forEach((c, i) => { g.fillStyle = c; g.fillRect(90 + (i % 3) * 390, 290 + Math.floor(i / 3) * 300, 350, 230); g.fillStyle = '#5a5148'; g.font = `500 28px ${MONO}`; g.fillText(c, 90 + (i % 3) * 390, 560 + Math.floor(i / 3) * 300); });
    g.fillStyle = '#2d2620'; g.font = `400 300px Georgia, serif`; g.fillText('Aa', 90, 1240);
    g.font = `500 40px ${SANS}`; g.fillText('Display · Georgia', 640, 1080); g.fillText('Text · Geist', 640, 1150);
    g.fillStyle = '#24372c'; g.fillRect(90, 1380, 420, 110); g.fillStyle = '#fff'; g.font = `600 44px ${SANS}`; g.fillText('SHOP NOW', 165, 1452);
    g.fillStyle = '#ffffff'; g.fillRect(620, 1340, 600, 420); g.strokeStyle = '#d9d1c6'; g.lineWidth = 4; g.strokeRect(620, 1340, 600, 420);
    g.fillStyle = '#e6d9c8'; g.fillRect(650, 1370, 240, 360); g.fillStyle = '#2d2620'; g.font = `500 40px ${SANS}`; g.fillText('Abalone', 920, 1430); g.fillText('950 EGP', 920, 1660);
  });
}
/** the tablet: his projects' screens, all of them, as Figma lays them out; grey (false) or in colour (true) */
function screensTex(colour, work) {
  return canvasTex(1400, 1040, (g, W, H) => {
    g.fillStyle = '#e5e2dd'; g.fillRect(0, 0, W, H);
    const fw = 118, fh = 250;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
      const x = 22 + c * 137, y = 20 + r * 255;
      if (y + fh > H) continue;
      const k = r * 10 + c, p = work[(c + r * 3) % work.length], img = p && (c % 2 ? p.phone : p.phone || p.desk);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, fw, fh - 20);
      if (colour && img) { const sh = Math.min(img.height, img.width * (fh - 20) / fw); g.drawImage(img, 0, (k * 61) % Math.max(1, img.height - sh), img.width, sh, x, y, fw, fh - 20); }
      else {
        g.fillStyle = '#cfc9c0'; g.fillRect(x + 8, y + 18, fw - 16, 84);
        g.fillStyle = '#bdb7ae'; for (let i = 0; i < 4; i++) g.fillRect(x + 8, y + 160 + i * 12, fw - 24 - (i * 11) % 30, 5);
        g.fillStyle = '#9d968c'; g.fillRect(x + 8, y + fh - 52, fw - 16, 18);
      }
    }
  });
}

/** the printout under the tracing sheet (their plan sheet, 0.52 x 0.35): his Home screen as Figma prints it,
 *  landscape: now his Work page, three to a row; the site moves it on their paper's track. Its red marks:
 *  userData.marks.draw(loop, text, arrow) */
function makePrintout(U, edgeMat, work) {
  const W = 1560, H = 1050;
  const base = canvasTex(W, H, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b2b2b'; g.font = `500 40px ${SANS}`; g.textAlign = 'left'; g.fillText('samy.dev — Work  v1', 70, 90);
    g.fillStyle = '#8a8a8a'; g.font = `400 28px ${SANS}`; g.fillText('Desktop · 1440 · for review', 70, 135);
    // the page in a browser frame
    const bx = 220, by = 170, bw = 1120, bh = 820;
    g.fillStyle = '#f3ede4'; g.fillRect(bx, by, bw, bh); g.strokeStyle = '#9a9a9a'; g.lineWidth = 3; g.strokeRect(bx, by, bw, bh);
    g.fillStyle = '#e4ddd2'; g.fillRect(bx, by, bw, 40);
    ['#e0614f', '#e8b64a', '#6dae5a'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(bx + 24 + i * 22, by + 20, 7, 0, 7); g.fill(); });
    g.fillStyle = '#3a2a1c'; g.font = `600 26px ${SANS}`; g.fillText('samy', bx + 40, by + 92);
    g.font = `400 22px ${SANS}`; g.fillStyle = '#6b5d50'; ['Work', 'Letter', 'FAQs'].forEach((t, i) => g.fillText(t, bx + 420 + i * 110, by + 92));
    g.fillStyle = '#b9693b'; g.fillRect(bx + bw - 170, by + 64, 130, 40); g.fillStyle = '#fff'; g.fillText('Say hello', bx + bw - 155, by + 92);
    g.fillStyle = '#2b2118'; g.font = `500 64px ${SANS}`; g.fillText('Work', bx + 50, by + 190);
    // five projects, three to a row
    const cw = (bw - 100 - 60) / 3, ch = 250;
    work.forEach((p, i) => {
      const r = Math.floor(i / 3), c = i % 3, x = bx + 50 + c * (cw + 30), y = by + 230 + r * (ch + 30);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, cw, ch); g.strokeStyle = '#d0c8bc'; g.lineWidth = 2; g.strokeRect(x, y, cw, ch);
      if (p.desk) g.drawImage(p.desk, x + 10, y + 10, cw - 20, (cw - 20) / 1.6); else { g.fillStyle = '#d6d1c9'; g.fillRect(x + 10, y + 10, cw - 20, (cw - 20) / 1.6); }
      g.fillStyle = '#2b2118'; g.font = `600 26px ${SANS}`; g.fillText(p.name, x + 12, y + ch - 22);
    });
    g.fillStyle = '#b0aba3'; g.font = `400 24px ${SANS}`; g.fillText('Page 2 of 4', 70, H - 30);
  });
  const geo = new THREE.PlaneGeometry(0.52, 0.35).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, paint(U, { map: base, noise: 0.5, side: THREE.DoubleSide }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  // the red pen's marks over it: a loop round the cards, "2 COLUMNS", an arrow (figure.py's pen runs these). Drawn
  // once, each mark in its own channel, and shown as far as the pen has got by the shader (not drawn again and sent
  // to the GPU every frame the pen moves: that was 15 frames a second)
  const c = document.createElement('canvas'); c.width = Math.round(W * 2 / 3); c.height = Math.round(H * 2 / 3);
  const g = c.getContext('2d');
  g.setTransform(2 / 3, 0, 0, 2 / 3, 0, 0);
  const paintMarks = () => {
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#ff0000'; g.beginPath();
    for (let i = 0; i <= 90; i++) { const a = -2.2 + (i / 90) * Math.PI * 2.15, wob = 1 + Math.sin(i * 0.4) * 0.012; const x = 780 + Math.cos(a) * 300 * wob, y = 640 + Math.sin(a) * 200 * wob; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = '#00ff00'; g.font = '400 92px "Architects Daughter", cursive'; g.fillText('2 COLUMNS', 1040, 900);
    g.strokeStyle = '#0000ff'; g.beginPath(); g.moveTo(1030, 860); g.lineTo(1000, 800); g.stroke();
  };
  paintMarks();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  const mu = { tMarks: { value: t }, uK: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#c8432a') } };
  const over = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.35).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: mu, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tMarks; uniform vec3 uK; uniform vec3 uColor;
      void main() {
        vec3 m = texture2D(tMarks, vUv).rgb;
        vec2 p = vec2(vUv.x * ${W}.0, (1.0 - vUv.y) * ${H}.0);           // (the drawing's own coordinates)
        float a = atan((p.y - 640.0) / 200.0, (p.x - 780.0) / 300.0); if (a < -2.2) a += 6.2831853;
        float loopT = (a + 2.2) / (2.15 * 3.14159265);                    // (how far round the pen is there)
        float textT = (p.x - 1040.0) / 460.0;
        vec2 d = vec2(-30.0, -60.0); float arrowT = dot(p - vec2(1030.0, 860.0), d) / dot(d, d);
        float k = max(max(m.r * step(0.0001, uK.x) * step(loopT, uK.x), m.g * step(0.0001, uK.y) * step(textT, uK.y)), m.b * step(0.0001, uK.z) * step(arrowT, uK.z));
        gl_FragColor = vec4(uColor, k);
        #include <colorspace_fragment>
      }`,
  }));
  over.position.y = 0.0004; over.renderOrder = 3;
  mesh.add(over);
  const draw = (loopK, textK, arrowK) => { mu.uK.value.set(loopK, textK, arrowK); };
  // (the font must be in before the marks are drawn: drawn again once it is)
  document.fonts?.load('400 92px "Architects Daughter"').then(() => {
    paintMarks();
    t.needsUpdate = true;
  });
  mesh.userData.marks = { draw };
  return mesh;
}
const lerp = (a, b, t) => a + (b - a) * t;

/** the tower in three-quarter, rolled at one end, unrolling flat (their second sheet): pose(0..1) */
function makeRoll(U, edgeMat, draw) {
  const L = 0.54, D = 0.56, N = 60, R = 0.016;
  // the tower drawn in three-quarter, in pencil (their second sheet is a sketch of their building)
  const tex = canvasTex(1080, 1120, (g, W, H) => {
    g.fillStyle = '#fbf8f3'; g.fillRect(0, 0, W, H);
    g.translate(0, H); g.scale(1, -1);               // (flipped to read from his side of the desk)
    const axo = draw?.['axo-pencil'], shade = draw?.['axo-shade'];
    if (shade) { g.save(); g.globalAlpha = 0.32; g.globalCompositeOperation = 'multiply'; g.drawImage(shade, 20, 60, W - 40, W - 40); g.restore(); }
    if (axo) g.drawImage(axo, 20, 60, W - 40, W - 40);
    g.fillStyle = '#4d4640'; g.textAlign = 'left'; g.font = `400 40px ${HAND}`; g.fillText('黄鹤楼 — Yellow Crane Tower', 50, 70);
    g.font = `400 28px ${HAND}`; g.fillText('51.4 m · 5 storeys · 60 corners · 1:120', 50, H - 40);
  });
  const geo = new THREE.PlaneGeometry(L, D, N, 1);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  const mesh = new THREE.Mesh(geo, paint(U, { map: tex, noise: 0.5, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true;
  const g0 = new THREE.Group(); g0.add(mesh);
  // laid along x (0 at its fixed edge), z across; y up. Unrolled up to xk, the rest wound round a roll there
  g0.userData.pose = (k) => {
    const xk = L * Math.min(1, Math.max(0.04, k));
    for (let i = 0; i < pos.count; i++) {
      const u = base[i * 3] + L / 2, z = -base[i * 3 + 1];
      let x = u, y = 0;
      if (u > xk) { const a = (u - xk) / R; const r = R * (1 - 0.02 * a); x = xk + Math.sin(a) * r; y = R - Math.cos(a) * r; }
      pos.setXYZ(i, x - L / 2, y + 0.0015, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  g0.userData.pose(0);
  return g0;
}

/** the tablet's folio cover, hinged at its left edge: pose(open 0..1, colour 0..1) */
function makeCover(U, edgeMat, byName) {
  const hinge = new THREE.Group();
  const w = 0.288, d = 0.222, t = 0.004;
  // the tablet (set2.py): its middle at (0.709, desk, 0.202), turned -0.1; the hinge on its left edge
  const ry = -0.1, cx = 0.709, cz = 0.202;
  hinge.position.set(cx - Math.cos(ry) * w / 2, 0.762 + 0.0072, cz + Math.sin(ry) * w / 2);
  hinge.rotation.y = ry;
  const geo = new THREE.BoxGeometry(w, t, d).translate(w / 2, t / 2, 0);
  const mesh = new THREE.Mesh(geo, paint(U, { tint: new THREE.Color(0.8, 0.45, 0.26), noise: 0.6 }));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  hinge.add(mesh);
  const scr = byName.get('scr_tablet')?.material;
  hinge.userData.pose = (open, colour) => {
    hinge.rotation.z = Math.PI * open * 0.985;
    if (scr) scr.userData.uniforms.uDress.value = colour;
  };
  hinge.userData.pose(0, 0);
  return hinge;
}
