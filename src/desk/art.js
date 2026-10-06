import * as THREE from 'three';
import { canvasTex, rng } from './things.js';

// The pictures in the scene. For now placeholders (the user will send his own):
// his painting and prints of sites he built where the photo has pictures, and
// pencil sketches of UI where it has line drawings. Every one is drawn onto its
// own canvas at the size of the thing it goes on.

/** an image drawn to cover w x h (cropped to fill), on a paper margin */
export function printTex(img, { w = 1024, h = 768, margin = 0, paper = '#fbfaf7', grade = null } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = paper; g.fillRect(0, 0, w, h);
    const iw = w - 2 * margin, ih = h - 2 * margin;
    const s = Math.max(iw / img.width, ih / img.height);
    const sw = iw / s, sh = ih / s;
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, margin, margin, iw, ih);
    if (grade) { g.fillStyle = grade; g.fillRect(margin, margin, iw, ih); }
  });
}

/** pencil line sketches of UI on white paper: phone screens, components, icons */
export function sketchTex(kind, { w = 512, h = 768, seed = 3 } = {}) {
  const r = rng(seed);
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#f8f7f3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,58,55,0.8)';
    g.lineCap = 'round';
    const line = (x0, y0, x1, y1) => {
      g.lineWidth = 1.2 + r() * 1.2;
      g.beginPath(); g.moveTo(x0 + (r() - 0.5) * 2, y0 + (r() - 0.5) * 2);
      g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 4, (y0 + y1) / 2 + (r() - 0.5) * 4, x1 + (r() - 0.5) * 2, y1 + (r() - 0.5) * 2);
      g.stroke();
    };
    const rect = (x, y, a, b) => { line(x, y, x + a, y); line(x + a, y, x + a, y + b); line(x + a, y + b, x, y + b); line(x, y + b, x, y); };
    if (kind === 'phone') {
      // a phone screen wireframe, tall
      const x = w * 0.2, y = h * 0.08, a = w * 0.6, b = h * 0.84;
      rect(x, y, a, b);
      rect(x + a * 0.1, y + b * 0.08, a * 0.8, b * 0.3);
      line(x + a * 0.1, y + b * 0.08, x + a * 0.9, y + b * 0.38); line(x + a * 0.9, y + b * 0.08, x + a * 0.1, y + b * 0.38);
      for (let i = 0; i < 4; i++) line(x + a * 0.1, y + b * (0.45 + i * 0.06), x + a * (0.9 - i * 0.12), y + b * (0.45 + i * 0.06));
      rect(x + a * 0.1, y + b * 0.75, a * 0.8, b * 0.08);
    } else if (kind === 'icons') {
      // a sheet of icon sketches: circles, arrows, a heart, a gear-like star
      for (let k = 0; k < 6; k++) {
        const cx = w * (0.2 + (k % 3) * 0.3), cy = h * (0.3 + Math.floor(k / 3) * 0.4), s = w * 0.09;
        g.lineWidth = 1.6;
        if (k % 3 === 0) { g.beginPath(); g.arc(cx, cy, s, 0, 7); g.stroke(); line(cx - s * 0.5, cy, cx + s * 0.5, cy); }
        else if (k % 3 === 1) { rect(cx - s, cy - s * 0.7, s * 2, s * 1.4); line(cx - s, cy - s * 0.7, cx, cy + s * 0.1); line(cx, cy + s * 0.1, cx + s, cy - s * 0.7); }
        else { line(cx - s, cy + s * 0.6, cx, cy - s * 0.8); line(cx, cy - s * 0.8, cx + s, cy + s * 0.6); line(cx + s, cy + s * 0.6, cx - s, cy + s * 0.6); }
      }
    } else {
      // a desktop page wireframe, the site's home
      const x = w * 0.08, y = h * 0.1, a = w * 0.84, b = h * 0.8;
      rect(x, y, a, b);
      line(x, y + b * 0.08, x + a, y + b * 0.08);
      rect(x + a * 0.06, y + b * 0.15, a * 0.5, b * 0.35);
      line(x + a * 0.06, y + b * 0.15, x + a * 0.56, y + b * 0.5); line(x + a * 0.56, y + b * 0.15, x + a * 0.06, y + b * 0.5);
      for (let i = 0; i < 3; i++) line(x + a * 0.62, y + b * (0.2 + i * 0.08), x + a * 0.92, y + b * (0.2 + i * 0.08));
      for (let i = 0; i < 3; i++) rect(x + a * (0.06 + i * 0.3), y + b * 0.6, a * 0.26, b * 0.3);
    }
  });
}

/** a page of printed text with a picture: the clipping on the wall */
export function clippingTex(img, { w = 512, h = 768 } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    const s = Math.max((w * 0.84) / img.width, (h * 0.34) / img.height);
    g.drawImage(img, 0, 0, (w * 0.84) / s, (h * 0.34) / s, w * 0.08, h * 0.06, w * 0.84, h * 0.34);
    g.fillStyle = '#2a2a2a';
    g.font = '700 30px Georgia, serif';
    g.fillText('Designing for', w * 0.08, h * 0.47);
    g.fillText('people, first', w * 0.08, h * 0.52);
    g.fillStyle = 'rgba(40,40,40,0.55)';
    const r = rng(9);
    for (let y = h * 0.57; y < h * 0.95; y += 13) g.fillRect(w * 0.08, y, w * (0.6 + r() * 0.24), 4);
  });
}

/** the laptop's screen: a portfolio page with a grid of pictures (placeholders) */
export function screenTex(imgs) {
  return canvasTex(1728, 1080, (g, W, H) => {
    g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, W, H);
    // browser bar
    g.fillStyle = '#e4e4e2'; g.fillRect(0, 0, W, 64);
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(360, 14, 1000, 36, 18); g.fill();
    g.fillStyle = '#9a9a98'; g.font = '500 20px Poppins'; g.fillText('mohamedsamy.design', 390, 39);
    for (let i = 0; i < 3; i++) { g.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][i]; g.beginPath(); g.arc(28 + i * 26, 32, 8, 0, 7); g.fill(); }
    // site header
    g.fillStyle = '#1d1d1f'; g.font = '800 30px Poppins'; g.fillText('Mohamed Samy', 110, 120);
    g.fillStyle = '#6e6e73'; g.font = '500 20px Poppins';
    ['Work', 'About', 'Contact'].forEach((t, i) => g.fillText(t, 1260 + i * 130, 118));
    g.fillStyle = '#1f7a4d'; g.beginPath(); g.roundRect(1600, 94, 90, 36, 18); g.fill();
    // the grid
    const cells = [[110, 160, 420, 400], [550, 160, 480, 400], [1050, 160, 560, 400], [110, 580, 420, 480], [550, 580, 480, 480], [1050, 580, 560, 480]];
    cells.forEach(([x, y, w, h], i) => {
      const img = imgs[i % imgs.length];
      const s = Math.max(w / img.width, h / img.height);
      const sw = w / s, sh = h / s;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    });
  });
}

/** the phone's screen: the same portfolio, its mobile layout */
export function phoneTex(imgs) {
  return canvasTex(780, 1688, (g, W, H) => {
    g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d1d1f'; g.font = '600 34px Poppins'; g.fillText('9:41', 64, 66);
    g.fillStyle = '#0b0b0c'; g.beginPath(); g.roundRect(W / 2 - 110, 26, 220, 64, 32); g.fill();
    g.fillStyle = '#1d1d1f'; g.font = '800 46px Poppins'; g.fillText('Mohamed Samy', 56, 190);
    g.fillStyle = '#6e6e73'; g.font = '500 26px Poppins'; g.fillText('Software Engineer · UI/UX · Web', 58, 236);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#1d1d1f'; g.fillRect(W - 110, 150 + i * 16, 50, 5); }
    const cells = [[56, 290, 668, 500], [56, 810, 324, 420], [400, 810, 324, 420], [56, 1250, 668, 380]];
    cells.forEach(([x, y, w, h], i) => {
      const img = imgs[i % imgs.length];
      const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
      g.save(); g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip();
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
      g.restore();
    });
    g.fillStyle = 'rgba(20,20,20,0.7)'; g.beginPath(); g.roundRect(W / 2 - 140, H - 32, 280, 10, 5); g.fill();
  });
}

/** a magazine page: a case study of one of his projects, its picture on top */
export function caseStudyTex(img, { w = 600, h = 960 } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a8a86'; g.font = '600 15px Poppins'; g.fillText('CASE STUDY  ·  WEB DESIGN', w * 0.08, h * 0.05);
    const iw = w * 0.84, ih = h * 0.36;
    const s = Math.max(iw / img.width, ih / img.height), sw = iw / s, sh = ih / s;
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, w * 0.08, h * 0.075, iw, ih);
    g.fillStyle = '#1d1d1f'; g.font = '800 40px Georgia, serif';
    g.fillText('A portfolio that', w * 0.08, h * 0.51);
    g.fillText('feels like a stage', w * 0.08, h * 0.56);
    g.fillStyle = '#6e6e73'; g.font = 'italic 18px Georgia, serif';
    g.fillText('Sondos Hamed, scenographer — by Mohamed Samy', w * 0.08, h * 0.605);
    const r = rng(19);
    g.fillStyle = 'rgba(40,40,40,0.5)';
    for (let col = 0; col < 2; col++) for (let y = h * 0.64; y < h * 0.95; y += 14) g.fillRect(w * (0.08 + col * 0.44), y, w * (0.36 + (r() - 0.5) * 0.06), 4.5);
  });
}

/** a UI sheet: three phone screens of his portfolio side by side, with redlines, as printed for review */
export function uiSheetTex(imgs, { w = 900, h = 1150 } = {}) {
  const phone = phoneTex(imgs).image;
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#141416'; g.font = '800 58px Poppins'; g.fillText('Portfolio — mobile', 56, 110);
    g.fillStyle = '#5b5b57'; g.font = '600 26px Poppins'; g.fillText('v3 · home · 390 × 844', 58, 156);
    // three phone screens, each in a black bezel so they read from across the room
    const pw = 238, ph = pw * (phone.height / phone.width), gap = 30, y = 210;
    for (let i = 0; i < 3; i++) {
      const x = 56 + i * (pw + gap);
      g.fillStyle = '#111'; g.beginPath(); g.roundRect(x - 9, y - 9, pw + 18, ph + 18, 36); g.fill();
      g.save(); g.beginPath(); g.roundRect(x, y, pw, ph, 28); g.clip();
      g.drawImage(phone, 0, 0, phone.width, phone.height, x, y, pw, ph);
      g.restore();
    }
    // redlines: spacing marks in the designer's red
    g.strokeStyle = '#d93a3f'; g.fillStyle = '#d93a3f'; g.lineWidth = 4; g.font = '700 26px Poppins';
    g.beginPath(); g.moveTo(56, y + ph + 40); g.lineTo(56 + pw, y + ph + 40); g.stroke(); g.fillText('390', 56 + pw / 2 - 22, y + ph + 76);
    g.fillStyle = '#141416'; g.font = '600 28px Poppins';
    ['Type — Poppins 800 / 500', 'Grid — 4 col · 16 gutter', 'Radius — 18'].forEach((t, i) => g.fillText(t, 58, y + ph + 140 + i * 42));
  });
}

/** his monogram, for the little glass frame: MS drawn on a transparent ground */
export function monogramTex() {
  return canvasTex(256, 320, (g) => {
    g.clearRect(0, 0, 256, 320);
    g.fillStyle = '#1d1d1f';
    g.font = '800 120px Poppins';
    g.textAlign = 'center';
    g.fillText('MS', 128, 190);
    g.fillRect(78, 222, 100, 5);
    g.font = '600 20px Poppins';
    g.fillText('DESIGN · CODE', 128, 262);
  });
}

/** a pressed leaf, for the little glass frame: drawn with a transparent background */
export function pressedLeafTex() {
  const t = canvasTex(256, 320, (g) => {
    g.clearRect(0, 0, 256, 320);
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(128, 300); g.quadraticCurveTo(120, 180, 132, 40); g.stroke();
    const r = rng(4);
    for (let i = 0; i < 7; i++) {
      const y = 70 + i * 32, s = 1 - i * 0.08;
      for (const sx of [-1, 1]) {
        g.fillStyle = `rgba(${150 + r() * 30},${120 + r() * 20},${70 + r() * 20},0.9)`;
        g.beginPath(); g.ellipse(128 + sx * 32 * s, y, 30 * s, 12 * s, sx * -0.5, 0, 7); g.fill();
      }
    }
  });
  return t;
}

export const loadImage = (url) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
export { THREE };
