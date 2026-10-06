// The laptop's screen, live: the page it shows in the render, rebuilt in HTML at
// its own size (1728 x 1080, as src/desk/art.js drew it) and laid onto the
// display's four corners with a perspective transform, so it moves, and later
// becomes the real site the camera dives into.

import { signatureSVG, written } from '../shared/signature.js';

// (the stand-in at the window's own shape on a wide screen, as the site in the frame is laid out at the window's
// size; a phone's frame is a laptop-shaped 1280 x 800, so 1728 x 1080 there)
const H = 1080;
let W = 1728;

/** a 3x3 homography taking the rectangle 0..W x 0..H to the quad, as a CSS matrix3d */
function quadMatrix(q) {
  const adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
  const mm = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c.push(s); } return c; };
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const basis = (p) => { const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; const v = mv(adj(m), [p[3][0], p[3][1], 1]); return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
  // corners in the order TL, TR, BL, BR for the basis
  const src = [[0, 0], [W, 0], [0, H], [W, H]];
  const dst = [q[0], q[1], q[3], q[2]];
  const t = mm(basis(dst), adj(basis(src)));
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}

export function createScreen(root, imgs) {
  const el = document.createElement('div');
  el.className = 'laptop-screen';
  // (until the site itself is on the display: its first screen, his signature on the warm paper, as the site will show it)
  W = innerHeight > innerWidth ? 1728 : Math.round(H * innerWidth / innerHeight);
  el.style.width = `${W}px`;
  el.innerHTML = `<div class="mock-sig">${signatureSVG()}</div><div class="glare"></div>`;
  written([el.querySelector('.mock-sig svg')]);
  // where the site's first screen has it (inside.css .sig: half the width, centred, 2 % of the height above the middle: its -4vh margin, halved by the centring)
  const sw = W * 0.5, sh = sw * 684 / 2320;
  Object.assign(el.querySelector('.mock-sig').style, { left: `${(W - sw) / 2}px`, width: `${sw}px`, top: `${H / 2 - 0.02 * H - sh / 2}px` });
  root.append(el);
  void imgs;
  return {
    el,
    place(q) { el.style.transform = quadMatrix(q); },
  };
}

export function createScreenGrid(root, imgs) {
  const el = document.createElement('div');
  el.className = 'laptop-screen';
  el.innerHTML = `
    <div class="bar"><i></i><i></i><i></i><span class="url">mohamedsamy.design</span></div>
    <div class="head"><b>Mohamed Samy</b><nav><span>Work</span><span>About</span><span>Contact</span><em></em></nav></div>
    <div class="grid">${[[110, 160, 420, 400], [550, 160, 480, 400], [1050, 160, 560, 400], [110, 580, 420, 480], [550, 580, 480, 480], [1050, 580, 560, 480]]
      .map(([x, y, w, h], i) => `<figure style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><img src="${imgs[i % imgs.length]}" alt="" style="animation-delay:${-i * 3.7}s"></figure>`).join('')}</div>
    <div class="glare"></div>`;
  root.append(el);
  return {
    el,
    /** lay it on the display: q = its corners on the page in px (TL, TR, BR, BL) */
    place(q) { el.style.transform = quadMatrix(q); },
  };
}
