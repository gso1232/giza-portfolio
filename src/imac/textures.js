import * as THREE from 'three';

// Every surface texture of the set, painted in code on canvases.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** 1D value noise, for grain that wanders instead of repeating. */
function noise1(seed) {
  const r = rng(seed);
  const pts = Array.from({ length: 512 }, r);
  return (x) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return pts[i & 511] * (1 - u) + pts[(i + 1) & 511] * u;
  };
}

/**
 * The white "ice" plastic of the front: faint vertical pinstripes moulded in,
 * and the name printed under the screen. UVs are planar over the bezel's front
 * (u across its width, v up its height), so text is placed in centimetres.
 */
export function bezelTextures({ widthCm, heightCm, name, nameCenter, nameHeightCm, font, stripesFromCm = 0 }) {
  const W = 4096;
  const H = Math.round((W * heightCm) / widthCm);
  const pxPerCm = W / widthCm;

  // albedo
  const [ca, a] = canvas(W, H);
  a.fillStyle = '#ffffff';
  a.fillRect(0, 0, W, H);
  // Measured on the photo: a line every 3.4 mm, about 1.7 % deep on the upper
  // bezel, and none at all on the belly below it. A soft cosine, not a hard
  // bar, so it never aliases into grain.
  const pitch = 0.34 * pxPerCm;
  const fadeCm = 0.5;
  const stripeAt = (yCm) => Math.min(1, Math.max(0, (yCm - stripesFromCm) / fadeCm));
  const row = a.createImageData(W, 1);
  for (let x = 0; x < W; x++) {
    const t = (x % pitch) / pitch;
    const dark = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);
    row.data[x * 4] = 110; row.data[x * 4 + 1] = 108; row.data[x * 4 + 2] = 104;
    row.data[x * 4 + 3] = Math.round(dark * 0.035 * 255);
  }
  const [cr, rctx] = canvas(W, 1);
  rctx.putImageData(row, 0, 0);
  const yStop = H - stripesFromCm * pxPerCm; // canvas rows below this are the belly
  for (let y = 0; y < Math.min(H, Math.ceil(yStop)); y++) {
    const k = stripeAt((H - y) / pxPerCm);
    if (k <= 0) continue;
    a.globalAlpha = k;
    a.drawImage(cr, 0, y);
  }
  a.globalAlpha = 1;
  if (name) {
    a.fillStyle = '#595857';
    a.textAlign = 'center';
    a.textBaseline = 'alphabetic';
    const px = nameHeightCm * pxPerCm;
    a.font = `${px}px ${font}`;
    const x = nameCenter[0] * pxPerCm;
    const y = H - nameCenter[1] * pxPerCm + px * 0.36;
    a.fillText(name, x, y);
  }

  // normal map: each stripe a very shallow rounded ridge, fading out above the belly
  const NR = 256;
  const [cn, n] = canvas(W, NR);
  const img = n.createImageData(W, NR);
  for (let y = 0; y < NR; y++) {
    const k = stripeAt((1 - (y + 0.5) / NR) * heightCm);
    for (let x = 0; x < W; x++) {
      const t = (x % pitch) / pitch;
      const slope = Math.sin(t * Math.PI * 2) * 0.12 * k;
      const i = (y * W + x) * 4;
      img.data[i] = Math.round((0.5 + slope * 0.5) * 255);
      img.data[i + 1] = 128;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  n.putImageData(img, 0, 0);
  const normal = finish(cn, { srgb: false });
  return { map: finish(ca), normalMap: normal };
}

/**
 * Speaker grille: a stadium of orange plastic, the outer two thirds perforated
 * with a fine hole grid, the inner third smooth. `jacks` adds the two
 * headphone sockets the right-hand grille carries.
 */
export function grilleTexture({ widthCm, heightCm, meshSide, jacks, colors = { base: '#ffa05a', holes: 'rgba(70, 20, 0, 0.78)', jack: '#c25a14', jackRim: 'rgba(90, 30, 0, 0.6)' } }) {
  const W = 1024;
  const H = Math.round((W * heightCm) / widthCm);
  const s = W / widthCm;
  const [c, g] = canvas(W, H);
  g.fillStyle = colors.base;
  g.fillRect(0, 0, W, H);

  const splitCm = widthCm * 0.64;
  const meshFrom = meshSide === 'left' ? 0 : widthCm - splitCm;
  const meshTo = meshFrom + splitCm;
  const hole = 0.11 * s, step = 0.27 * s;
  g.fillStyle = colors.holes;
  for (let y = step * 0.8; y < H - step * 0.5; y += step) {
    for (let x = meshFrom * s + step * 0.9; x < meshTo * s - step * 0.4; x += step) {
      // keep the holes inside the rounded end
      const cx = x / s - widthCm / 2, cy = y / s - heightCm / 2;
      const r = heightCm / 2;
      const ex = Math.max(Math.abs(cx) - (widthCm / 2 - r), 0);
      if (Math.hypot(ex, cy) > r - 0.35) continue;
      g.beginPath();
      g.arc(x, y, hole, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (jacks) {
    for (const yCm of [heightCm * 0.3, heightCm * 0.7]) {
      const x = 1.0 * s, y = yCm * s;
      g.fillStyle = colors.jack;
      g.beginPath(); g.arc(x, y, 0.36 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a0d06';
      g.beginPath(); g.arc(x, y, 0.21 * s, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = colors.jackRim;
    g.lineWidth = 0.04 * s;
    g.beginPath(); g.arc(0.45 * s, H / 2, 0.13 * s, 0, Math.PI * 2); g.stroke();
  }
  return finish(c);
}

/** Light oak: long wavy grain along x, a few darker streaks, fine pores. */
export function oakTextures() {
  const W = 4096, H = 1024;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const n1 = noise1(11), n2 = noise1(23), n3 = noise1(37);
  const r = rng(5);
  const pores = new Float32Array(W * H);
  for (let i = 0; i < 90000; i++) pores[Math.floor(r() * W * H)] = 0.5 + r() * 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const warp = n1(x * 0.002 + y * 0.0007) * 60 + n2(x * 0.0006) * 120;
      const band = y + warp;
      const grain = 0.5 + 0.5 * Math.sin(band * 0.23 + n3(band * 0.03) * 7);
      const streak = Math.pow(n2(band * 0.012 + 3.1), 3);
      const fine = n3(x * 0.2 + band * 0.5);
      let v = 0.93 - grain * 0.035 - streak * 0.08 - fine * 0.02;
      const pore = pores[y * W + x];
      if (pore) v -= 0.05 * pore;
      const i = (y * W + x) * 4;
      img.data[i] = Math.round(236 * v);
      img.data[i + 1] = Math.round(210 * v);
      img.data[i + 2] = Math.round(174 * v);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, { repeat: true });
}

/** A flat, warm plaster wall with the faintest trowel mottling. */
export function plasterTexture() {
  const W = 1024;
  const [c, g] = canvas(W, W);
  const img = g.createImageData(W, W);
  const n1 = noise1(71), n2 = noise1(83);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const v = 0.97 + (n1(x * 0.01 + n2(y * 0.013) * 4) - 0.5) * 0.035 + (n2(x * 0.3 + y * 0.7) - 0.5) * 0.015;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * v);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, { repeat: true });
}
