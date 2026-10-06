import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-800.css';
import './site.css';
import { createStage } from './stage.js';
import { createScreen } from './screen.js';
import { createDive } from './dive.js';
import { createEnter } from './enter.js';
import { signatureSVG, write as writeSignature } from '../shared/signature.js';
import { warp, rect, mix, mapPoint } from './enter.js';

// ---- the splash: his name written by his hand, slowly, while the room loads behind it; once it is written and the
// room is ready, a breath, then the sheet lifts and the room settles in. Nothing heavy starts until it has gone
// (the site in the laptop, the room's video), so the pen never stutters
const splashEl = document.querySelector('.splash');
let roomUp; const roomReady = new Promise((r) => { roomUp = r; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__splash = (async () => {
  if (!splashEl) return;
  const box = splashEl.querySelector('.splash-sig');
  box.innerHTML = signatureSVG();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // (the site in the laptop loads first, the paper still blank: it shares this page's thread, and loading under the
  // pen or the flight it made them stutter. Then it waits there, its first screen up and written, for the splash to
  // land on it: the splash and the site are one)
  await Promise.race([new Promise((r) => { window.__insideLoaded = r; }), wait(2500)]);
  const pen = writeSignature([box.firstChild], { delay: still ? 0 : 0.25, speed: still ? 1e6 : 3700, lift: 0.045 });
  await Promise.all([pen.done, roomReady]);
  await wait(still ? 200 : 550);
  await intoLaptop(still ? 0.4 : 1.7);
  window.__landed = true;
  document.querySelector('iframe.inside-frame')?.contentWindow?.postMessage({ type: 'desk:landed' }, '*');
  splashEl.classList.add('gone');
  document.body.classList.remove('splashing');
})();
// the splash is the site's own first screen (laid out as the site in the laptop is), so it flies back into the
// laptop's display: its four corners carried onto the display's, the room settling out of its slight zoom as one
// (the corners follow the room's scale, so it lands exactly), the paper taking the screen's warmth as it lands; there
// the stand-in screen under it shows the same, and the site takes over from that
function intoLaptop(secs) {
  const room = document.querySelector('.room');
  const W = innerWidth, H = innerHeight, full = rect(W, H);
  const narrow = H > W;
  const q0 = scene.screen.map((p) => stage.toScreen(p));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // (a phone's splash is its own tall shape, the laptop's page a laptop's: there the signature leaves the sheet and
  // goes on its own to where the laptop's page has it, while the sheet flies in under it)
  let sig = null, r0 = null, r1 = null;
  if (narrow) {
    sig = splashEl.querySelector('.splash-sig');
    r0 = sig.getBoundingClientRect();
    Object.assign(sig.style, { position: 'fixed', left: `${r0.left}px`, top: `${r0.top}px`, width: `${r0.width}px`, margin: '0', zIndex: '41', transformOrigin: '0 0' });
    document.body.append(sig);
    const PW = 1728, PH = 1080, sw = PW * 0.5, sh = sw * 684 / 2320, sx = (PW - sw) / 2, sy = PH / 2 - 0.02 * PH - sh / 2;
    const c = [[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]].map(([x, y]) => mapPoint(rect(PW, PH), q0, x, y));
    const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    r1 = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) };
  }
  return new Promise((ok) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / (secs * 1000)), e = ease(k);
      const s = 1.045 + (1 - 1.045) * e;
      room.style.transform = `scale(${s})`;
      const q = q0.map(([x, y]) => [W / 2 + (x - W / 2) * s, H / 2 + (y - H / 2) * s]);
      splashEl.style.transform = warp(full, mix(full, q, e));
      splashEl.style.filter = `brightness(${1 - 0.1 * e}) sepia(${0.1 * e})`;
      // (a soft shadow under it while it flies, gone as it lies down in the display)
      splashEl.style.boxShadow = `0 ${40 * Math.sin(Math.PI * e)}px ${90 * Math.sin(Math.PI * e)}px rgba(70, 40, 20, ${0.3 * Math.sin(Math.PI * e)})`;
      if (sig) {
        const kk = r1.width / r0.width * s + (1 - s) * 0;      // (its end follows the room's scale too)
        const tx = (W / 2 + (r1.left - W / 2) * s) - r0.left, ty = (H / 2 + (r1.top - H / 2) * s) - r0.top;
        sig.style.transform = `translate(${tx * e}px, ${ty * e}px) scale(${1 + (kk - 1) * e})`;
        sig.style.opacity = String(1 - Math.max(0, (e - 0.82) / 0.18));
      }
      if (k < 1) requestAnimationFrame(step);
      else { room.style.transform = ''; sig?.remove(); ok(); }
    };
    requestAnimationFrame(step);
  });
}

// The desk site's first screen: the 4K render of the desk, alive (the plants in
// the breeze, leaf shadows over the sun on the wall, the laptop's screen), then
// scrolling steps into the laptop's screen (dive.js).

// The Blender render (blender/final, tools/blender/*): a wide picture for a wide screen, the
// phone's own framing for a tall one; each with where the laptop's display lies in it.
const narrow = innerHeight > innerWidth;
const base = '/desk/final/';
const scenes = await (await fetch(base + 'scene.json')).json();
const view = narrow ? 'phone' : 'pc';
const scene = scenes[view];
const aspect = scene.image[0] / scene.image[1];
// the smallest picture that still covers the screen at its pixel density
const size = (() => {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (narrow) return innerWidth * dpr <= 720 ? 720 : 1080;
  const need = Math.max(innerWidth, innerHeight * aspect) * dpr;
  return [1280, 1920, 2560, 3840].find((w) => w >= need) ?? 3840;
})();
const canvas = document.querySelector('canvas.stage');
// on a screen narrower than the picture the crop keeps the laptop's screen in the middle
const focusX = scene.screen.reduce((a, p) => a + p[0], 0) / 4;
// (each render of the room a new version: a browser that kept the last one for a day fetches this one anyway)
const V = '?v=20261002c';
const stage = await createStage(canvas, { unlit: `${base}${view}-${size}.webp${V}`, aspect, focusX, still: true });
// the room's live loop (its breeze, dust, steam and candle), once rendered: blender/final/loop-*.mp4
// copied here; it takes over from the still when it can play through
const loopUrl = `${base}loop-${view}.mp4${V}`;
window.__splash.then(() => fetch(loopUrl, { method: 'HEAD' })).then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('video') && stage.playLoop(loopUrl), () => {});

const screen = createScreen(document.querySelector('.screens'));
// the dive into the laptop: to be rendered in Blender (the old browser-traced one no longer
// matches the room), so none for now
scene.dive = null;
const dive = scene.dive ? createDive({ stage, screen, scene, base }) : null;
const placeScreen = () => (dive ? dive.place(dive.state === 'site' ? scene.dive.length - 1 : 0) : screen.place(scene.screen.map((p) => stage.toScreen(p))));
placeScreen();
addEventListener('resize', () => requestAnimationFrame(placeScreen));
roomUp();

// Enter (or a tap on the display) steps into the site on the laptop, Esc steps back out
const hint = document.querySelector('.enter-hint');
if (matchMedia('(pointer: coarse)').matches) hint.innerHTML = 'Tap the laptop to step inside';
const enter = createEnter({ stage, scene, room: document.querySelector('.room'), screens: document.querySelector('.screens'), mock: screen.el, hint });

requestAnimationFrame(() => document.body.classList.add('ready'));
window.__site = { stage, screen, scene, dive, enter };
