import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-mono/latin-500.css';
import '@fontsource/architects-daughter/latin-400.css';
import '@fontsource/ephesis/latin-400.css';
import './inside.css';
import { clamp, lerp, range, ease, split, Timeline, fade } from './anim.js';
import { createScene } from './scene6.js';
import { TRACKS } from './timeline.js';
import { signatureSVG, write as writeSignature, written as signatureWritten } from '../shared/signature.js';
import { PALETTES, byKey } from './palettes.js';
import { createGalaxy } from './galaxy.js';
import { createInkBall } from './inkball.js';
import { createReveal, canReveal } from './reveal.js';

// The site inside the laptop, driven the way illoca.unseen.co drives its own: the page
// is a tall stack of empty spacers, the scroll is smoothed, and every frame the scroll
// position poses everything that is fixed on screen: the window in the paper (its four
// edges ease between a few named states), each feature's panel (it swings in beside the
// window, holds, and is pushed out by the window's edge as it opens again), the text
// fading in a character at a time, and the 3D story behind it all (scene.js).

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const params = new URLSearchParams(location.search);
// the visitor's palette (palettes.js), remembered; applied before anything is drawn
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* (private mode) */ } } };
let palette = byKey(params.get('palette') || store.get('samy-palette') || 'cozy');
const ALL_VARS = [...new Set(PALETTES.flatMap((p) => Object.keys(p.css)))];
function paintPage(p) {
  for (const k of ALL_VARS) root.style.removeProperty(k);
  for (const [k, v] of Object.entries(p.css)) root.style.setProperty(k, v);
  root.dataset.palette = p.key;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.dark ? '#07061a' : p.css['--paper'] || '#f5e4ce');
}
paintPage(palette);
const inFrame = window.parent !== window;
// (on the room's laptop it waits, its first screen up and still, for the room's splash to land on it; then its words
// begin to turn and its 3D is built: nothing heavy while the splash is flying)
const landed = inFrame ? new Promise((ok) => { addEventListener('message', (e) => { if (e.data?.type === 'desk:landed') ok(); }); setTimeout(ok, 12000); }) : Promise.resolve();

// ---- grain: a tile of noise made here, laid over everything ------------------------------
{
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const v = 96 + Math.random() * 64; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  $('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

// ---- measures ------------------------------------------------------------------------
// the width without the scrollbar: the fixed sheets of paper are that wide
const viewW = () => document.documentElement.clientWidth || innerWidth;
let VW = viewW(), VH = innerHeight, REM = 12, LG = innerWidth >= 1080;
const docTop = (el) => el.getBoundingClientRect().top + scrollY;

// the window's named states, as the reference names them: the gaps from each screen
// edge in grid squares (1 rem each)
function holeState(name) {
  const c = REM, W = VW, H = VH;
  const side = LG ? 2 : 1, bottom = LG ? 1.5 : 0;
  switch (name) {
    case 'open': return { l: side * c, r: side * c, t: 28 * c, b: bottom * c };
    case 'openToNav': return { l: side * c, r: side * c, t: 6 * c, b: bottom * c };
    case 'toLeft': return { l: 38 * c, r: 2 * c, t: 6 * c, b: bottom * c };
    case 'toRight': return { l: 2 * c, r: 38 * c, t: 6 * c, b: bottom * c };
    case 'closed': return { l: W / 2, r: W / 2, t: H / 2, b: H / 2 };
    case 'fullyOpen': return { l: 0, r: 0, t: 0, b: 0 };
  }
}
const mixRect = (a, b, t) => ({ l: lerp(a.l, b.l, t), r: lerp(a.r, b.r, t), t: lerp(a.t, b.t, t), b: lerp(a.b, b.b, t) });

// ---- the parts -------------------------------------------------------------------------
const hole = { left: $('.hole-left'), right: $('.hole-right'), top: $('.hole-top'), bottom: $('.hole-bottom'), edge: $('.hole-edge'), last: '' };
const heroTitle = $('.hero-title');
const sub = $('.subheading');
const coords = { x: $('.cx'), y: $('.cy') };
const thumb = $('.thumb');

// the title: an outline, then its fill, a character at a time (their intro)
const intro = new Timeline();
{
  const bg = split($('.hero-bg')), fill = split($('.hero-fill'));
  intro.add(bg, 0.3, fade, { dur: 1.2, stagger: 0.04 })
    .add(fill, 0.7, fade, { dur: 1.2, stagger: 0.04 })
    .add(split($('.hero-left')), 0.2, fade, { dur: 1.2, stagger: 0.04 })
    .add($$('.hero-right > span:not(.not), .hero-right .not'), 1.3, fade, { dur: 1.2, stagger: 0.2 })
    .add([$('.hero-right .arrow')], 1.2, fade, { dur: 0.6 })
    .add($$('.hero-right .strike'), 1.2, (el, p) => { el.style.transform = `scaleX(${p})`; }, { dur: 0.4, ease: ease.inOut });
  intro.seek(0);
}

const sections = $$('.feature').map((el) => {
  const s = {
    el, side: el.classList.contains('right') ? -1 : 1, n: +el.dataset.n,
    pin: $('.pin', el), timing: $('.timing', el), wrap: $('.panel-wrap', el), panel: $('.panel', el), hide: $('.after', el), hold: $('.hide', el), toy: $('.toy', el),
    reveal: new Timeline(), buttons: new Timeline(), toyTl: null, shown: null, last: {},
  };
  const eyebrowChars = split($('.eyebrow span', el));
  const titleBg = split($('.title-bg', el)), titleFill = split($('.title-fill', el));
  const words = split($('.text', el), 'words');
  const btn = $('.btn', el);
  s.reveal
    .add(eyebrowChars, 0.3, fade, { stagger: 0.02 })
    .add($$('.eyebrow .line, .eyebrow .num', el), 0.3, (e, p) => { e.style.opacity = p; if (e.tagName === 'svg') e.style.transform = `scaleX(${p})`; }, { dur: 0.4, stagger: 0.05, ease: ease.inOut })
    .add(titleBg, 0, fade, { stagger: 0.02 })
    .add(titleFill, 0.15, fade, { stagger: 0.02 })
    .add(words, 0.1, fade, { stagger: 0.02 })
    .add([btn], 0.3, fade, { stagger: 0.04 })
    .add($$('.rule', el), 0, (e, p) => { e.style.transform = `scaleX(${p})`; }, { dur: 0.6, ease: ease.inOut });
  s.reveal.seek(0);
  const chin = $('.chin span', el);
  s.buttons
    .add([$('.sq', btn)], 0, (e, p) => { e.style.transform = `scale(${p})`; }, { dur: 0.6 })
    .add([$('.btn-bg', btn)], 0.2, (e, p) => { e.style.transform = `translateX(${(1 - p) * -101}%)`; }, { dur: 0.6 })
    .add([$('.btn-in', btn)], 0.2, (e, p) => { e.style.transform = `translateX(${(1 - p) * 101}%)`; }, { dur: 0.6 })
    .add(chin ? split(chin) : [], 0.3, fade, { stagger: 0.02 })
    .add($$('.chin svg', el), 0.3, fade, { dur: 0.6 });
  s.buttons.seek(0);
  if (s.toy) {
    s.toyTl = new Timeline().add([s.toy], 0, (e, p) => { e.style.transform = `translate(-50%, 0) scale(${p})`; e.style.visibility = p > 0 ? 'visible' : 'hidden'; }, { dur: 0.7, ease: ease.out });
    s.toyTl.seek(0);
  }
  return s;
});

// the letter's title over the full-screen 3D
const letter = { el: $('.letter'), head: $('.letter-head'), run: $('.letter-run'), tl: new Timeline() };
const envs = $$('.env');
letter.tl.add(split($('.letter-head .to')), 0, fade, { stagger: 0.02 })
  .add(split($('.letter-head .title-bg')), 0.1, fade, { stagger: 0.03 })
  .add(split($('.letter-head .title-fill')), 0.4, fade, { stagger: 0.03 });
letter.tl.seek(0);

// the 3D: placeholder scene, two tones from the palette
// the palette as the page has it (css), for the 3D: its two tones, and the colours the house takes
const readPal = () => {
  const c = getComputedStyle(root), v = (n) => c.getPropertyValue(n).trim();
  return { accent: v('--accent'), lit: v('--accent-lit'), cta: v('--cta'), spark: v('--spark'), card2: v('--card-2'), card3: v('--card-3'), foot: v('--foot'), paper: v('--paper'), ink: v('--ink'), cream: v('--cream'), gridv: v('--grid-v'), nav: '#fffbf3' };
};
const pal0 = readPal();
// (with the first screen up, the 3D's heavy start waits until the signature has written itself: the pen must not stutter)
const sigFirst = !!document.querySelector('.sig-sheet') && scrollY < 2 && !location.hash;
let sigWrote; const sigWritten = new Promise((r) => { sigWrote = r; });
const scene = createScene($('canvas.scene'), { accent: palette.shade, lit: palette.light, pal: pal0, start: sigFirst ? Promise.all([sigWritten, landed]) : landed });

// ---- layout: spacer heights, then every trigger's scroll position ---------------------------
let T = {};                    // trigger positions in px of scroll
let storyKeys = [];            // [scroll px, story u] pairs, for the 3D
function layout() {
  VW = viewW(); VH = innerHeight; LG = innerWidth >= 1080;
  REM = parseFloat(getComputedStyle(root).fontSize);
  $$('[data-h], [data-hm]').forEach((el) => {
    const h = LG ? el.dataset.h : el.dataset.hm ?? el.dataset.h;
    el.style.height = h ? `${h}dvh` : '';
  });
  $('.intro').style.height = LG ? `${VH}px` : '';
  $('.hero').style.position = LG ? 'fixed' : '';
  $('.hero').style.inset = LG ? '0' : '';
  for (const s of sections) {
    s.P = docTop(s.pin);                         // the pin's top
    s.Hd = docTop(s.hide);                       // the element after the pin: the panel leaves over it
    s.Hh = s.hide.offsetHeight;
    s.pinH = s.pin.offsetHeight;
    s.wrapH = s.wrap.offsetHeight;
    s.wrap.style.visibility = LG ? 'hidden' : 'visible';
    s.panel.style.transform = LG ? '' : 'none';
    s.panel.style.opacity = LG ? '' : '1';
  }
  const introEnd = docTop($('[data-key="intro"]')) + $('[data-key="intro"]').offsetHeight - VH;
  const k = (key) => docTop($(`[data-key="${key}"]`));
  const kEnd = (key) => { const e = $(`[data-key="${key}"]`); return docTop(e) + e.offsetHeight - VH; };
  const [s1, s2, s3, s4, s5] = sections;
  const endOf = (s) => s.Hd + s.Hh - VH;
  T = { introEnd, letterTop: docTop(letter.el), letterRun: docTop(letter.run), max: document.documentElement.scrollHeight - VH };
  // the 3D's sequence position S, as theirs runs (their scrollProgress:N triggers): the intro moves it from
  // the first camera keyframe to the second; each section's spacer (in from the screen's foot until it has
  // gone off the top) to the next; its pin (its top at the screen's top until its foot is the exit
  // element's height above the screen's foot) to the next
  void k; void kEnd; void endOf;
  const kf = TRACKS.camera.map((c) => c[0]);
  const ins = [$('.sec-in', s1.el), $('[data-key="rise"]'), $('[data-key="orbit"]'), $('[data-key="devices"]'), $('[data-key="projects"]')];
  storyKeys = [[0, kf[0]], [Math.max(introEnd, 0.6 * VH), kf[1]]];
  sections.forEach((s, i) => {
    const si = ins[i];
    storyKeys.push([docTop(si) - VH, kf[1 + 2 * i]], [docTop(si) + si.offsetHeight, kf[2 + 2 * i]]);
    storyKeys.push([s.P + s.pinH - VH + s.Hh, kf[3 + 2 * i]]);
  });
  // keep the keys in order even where a narrow screen squeezes them together
  for (let i = 1; i < storyKeys.length; i++) storyKeys[i][0] = Math.max(storyKeys[i][0], storyKeys[i - 1][0] + 1);
  scene.resize(VW, VH);
  smooth.max = T.max;
  hole.last = '';
  dirty = true;
}
const storyAt = (y) => {
  const K = storyKeys;
  if (y <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (y < K[i][0]) return lerp(K[i - 1][1], K[i][1], (y - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
  return K[K.length - 1][1];
};

// ---- the window at a scroll position ----------------------------------------------------
// each feature: over its timing element the window slides to leave room for the panel
// ("joe.out"), then over its hide element it opens again, linearly
function holeAt(y) {
  let rect = holeState('open');
  const seg = (a, b, from, to, e = ease.none) => { if (y >= a) rect = mixRect(holeState(from), holeState(to), e(range(y, a, b))); };
  seg(0, T.introEnd, 'open', 'openToNav');
  if (LG) for (const s of sections) {
    const side = s.side > 0 ? 'toLeft' : 'toRight';
    seg(s.P - VH, s.P - 0.2 * VH, 'openToNav', side, ease.out);
    seg(s.Hd - VH, s.Hd + s.Hh - VH, side, 'openToNav');
  }
  seg(T.letterTop - VH, T.letterTop, 'openToNav', 'fullyOpen', ease.inOut);
  return rect;
}
function applyHole(r) {
  const key = `${r.l | 0},${r.r | 0},${r.t | 0},${r.b | 0}`;
  if (key === hole.last) return;
  hole.last = key;
  hole.left.style.clipPath = `inset(0 ${VW - r.l}px 0 0)`;
  hole.right.style.clipPath = `inset(0 0 0 ${VW - r.r}px)`;
  hole.top.style.clipPath = `inset(0 0 ${VH - r.t}px 0)`;
  hole.bottom.style.clipPath = `inset(${VH - r.b}px 0 0 0)`;
  const w = Math.max(0, VW - r.l - r.r), h = Math.max(0, VH - r.t - r.b);
  Object.assign(hole.edge.style, { transform: `translate(${r.l}px, ${r.t}px)`, width: `${w}px`, height: `${h}px`, opacity: r.l + r.t > 1 ? 1 : 0 });
}

// ---- a feature's panel at a scroll position -----------------------------------------------
function posePanel(s, y, dt) {
  if (!LG) {   // narrow: the panel is a strip of paper in the flow; reveal it as it comes up
    const top = s.wrap.getBoundingClientRect().top;
    const want = top < VH * 0.85 ? 1 : -1;
    if (s.shown !== want) { s.shown = want; s.reveal.play(want); s.buttons.play(want); }
    s.reveal.tick(dt); s.buttons.tick(dt);
    return;
  }
  const inA = s.P - VH, inB = s.P + 0.04 * VH;                   // the swing in
  const outA = s.Hd - VH, outB = s.Hd + s.Hh - VH;             // pushed out by the window
  const live = y > inA - 2 && y < outB + 2;
  if (!live) { if (s.last.live !== false) { s.wrap.style.visibility = 'hidden'; s.last.live = false; } }
  else {
    if (s.last.live !== true) { s.wrap.style.visibility = 'visible'; s.last.live = true; }
    const ty = y < s.P ? s.P - y : y > s.P + s.pinH ? s.P + s.pinH - y : 0;
    const pin = ease.sineOut(range(y, inA, inB)), out = range(y, outA, outB);
    const x = s.side * (-100 * (1 - pin) - 100 * out);
    const rot = s.side * 45 * (1 - pin);
    s.wrap.style.transform = `translateY(${ty}px)`;
    s.panel.style.transformOrigin = s.side > 0 ? '0 0' : '100% 0';
    s.panel.style.transform = `translateX(${x}%) rotate(${rot}deg)`;
    s.panel.style.opacity = 1 - out;
    s.reveal.progress(range(y, s.P - VH, s.P + 0.6 * VH));
  }
  // the buttons and the arrow note play in real time once the panel has landed
  const want = y >= s.P + 0.04 * VH ? 1 : -1;
  if (s.shown !== want) { s.shown = want; s.buttons.play(want); }
  s.buttons.tick(dt);
  if (s.toyTl) {
    const on = y > s.P + 0.3 * VH && y < s.Hd - VH + 0.5 * s.Hh ? 1 : -1;
    if (s.toyOn !== on) { s.toyOn = on; s.toyTl.play(on); }
    s.toyTl.tick(dt);
  }
}

// ---- the first screen: his signature (inside.css .sig-sheet). It stays until the page is scrolled (the wheel, a
// swipe up, the keys, or its cue), then lifts away and the site's own opening plays under it; back at the top, a
// turn of the wheel up brings it down again. In the room's laptop it simply stays, turning its words over
const sig = { el: $('.sig-sheet'), up: false, busy: false, opened: false, writing: false, t: 0, quiet: () => Promise.resolve() };
const startOpening = () => { if (sig.opened) return; sig.opened = true; introOn = true; heroTitle.classList.add('on'); };
function sigLayout() {
  // the trade's two words set as one line in the middle, each the back of the word it turns from
  if (!sig.el) return;
  const box = $('.sig', sig.el), a = $('.sig-a .sig-back', sig.el), b = $('.sig-b .sig-back', sig.el);
  const W = box.offsetWidth, gap = 0.36 * parseFloat(getComputedStyle(a).fontSize);
  const wa = a.offsetWidth, wb = b.offsetWidth, x0 = (W - wa - gap - wb) / 2;
  a.style.left = `${x0}px`;
  b.style.left = `${x0 + wa + gap - $('.sig-a', sig.el).offsetWidth}px`;
}
function sigShow(instant = false) {
  if (!sig.el || (sig.up && !sig.busy)) return;
  sig.up = true; sig.busy = !instant;
  root.classList.add('sig-on');
  sig.el.classList.remove('gone');
  if (instant) { sig.el.classList.add('instant'); sig.el.classList.remove('away', 'moving'); requestAnimationFrame(() => requestAnimationFrame(() => sig.el.classList.remove('instant'))); return; }
  void sig.el.offsetWidth;
  sig.el.classList.remove('moving'); void sig.el.offsetWidth;
  sig.el.classList.add('moving'); sig.el.classList.remove('away');
  clearTimeout(sig.t); sig.t = setTimeout(() => { sig.busy = false; sig.el.classList.remove('moving'); }, 1200);
}
function sigHide() {
  if (!sig.el || !sig.up || sig.busy) return;
  // (the 3D's one slow first draw, if it is still to come, done now behind the sheet, then the sheet lifts: never a
  // freeze with the sheet halfway up; a moment's wait at most)
  if (scene.warmState === 'quiet' && sig.hurry !== 'gone') {
    if (!sig.hurry) {
      sig.hurry = true;
      Promise.race([scene.warmed, new Promise((r) => setTimeout(r, 1600))]).then(() => requestAnimationFrame(() => requestAnimationFrame(() => { sig.hurry = 'gone'; sigHide(); })));
    }
    return;
  }
  sig.up = false; sig.busy = true;
  sig.el.classList.remove('moving'); void sig.el.offsetWidth;
  sig.el.classList.add('moving', 'away');
  setTimeout(startOpening, 120);                 // (the window opens and the title writes itself as the sheet lifts)
  clearTimeout(sig.t); sig.t = setTimeout(() => { sig.busy = false; sig.el.classList.remove('moving'); sig.el.classList.add('gone'); root.classList.remove('sig-on'); }, 1200);
}
if (sig.el) {
  // the two words' fronts: his signature, each word under its own pen
  for (const f of $$('.sig-front', sig.el)) f.outerHTML = signatureSVG({ word: f.dataset.word, cls: f.getAttribute('class') });
  const fronts = $$('.f0 .sig-front', sig.el);
  signatureWritten($$('.sig-again', sig.el));                // (the box's back: the name, written)
  const turn = () => { sig.writing = false; sig.el.classList.add('turning'); sigWrote(); };
  if (scrollY < 2 && !location.hash) {
    sig.up = true; root.classList.add('sig-on'); sig.el.classList.add('live');
    // written by his hand, slowly, then a breath, then the words begin to turn
    // (on the room's laptop it is already written: the room's own splash wrote it, and the display showed it so)
    if (inFrame) { signatureWritten(fronts); landed.then(turn); }
    else if (matchMedia('(prefers-reduced-motion: reduce)').matches) { signatureWritten(fronts); turn(); }
    else { sig.writing = true; writeSignature(fronts, { delay: 0.35, speed: 3700, lift: 0.045 }).done.then(turn); }
  } else { signatureWritten(fronts); sig.el.classList.add('away', 'gone', 'turning'); sigWrote(); }
  $('.sig-cue', sig.el).addEventListener('click', () => sigHide());
  let ty = null;
  addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (e) => { if (!sig.up) return; e.preventDefault(); if (ty !== null && ty - e.touches[0].clientY > 18) { ty = null; sigHide(); } }, { passive: false });
  addEventListener('keydown', (e) => {
    if (sig.up && ['ArrowDown', 'PageDown', ' ', 'Enter', 'End'].includes(e.key)) { e.preventDefault(); sigHide(); }
    else if (!sig.up && !sig.busy && scrollY < 2 && ['ArrowUp', 'PageUp', 'Home'].includes(e.key)) { e.preventDefault(); sigShow(); }
  });
  sigLayout(); document.fonts.ready.then(sigLayout);    // (before anything else loads: the words are set from the start)
  // a moment when nothing on the first screen moves (both words still between their turns, 1.2 s of it at least),
  // for the 3D's one unavoidable stall; at once if the screen is not up
  sig.quiet = () => new Promise((ok) => {
    const wait = () => {
      if (!sig.up || sig.busy || sig.hurry) return ok();
      const a = $('.sig-a', sig.el).getAnimations().find((x) => x.animationName === 'sig-roll-a');
      if (sig.writing || !a || a.currentTime == null) return setTimeout(wait, 60);
      const t = (a.currentTime - 900) % 7500;
      if (a.currentTime < 900 || (t > 1400 && t < 3300) || (t > 5520 && t < 6800)) return ok();
      setTimeout(wait, 60);
    };
    wait();
  });
  scene.waitQuiet = sig.quiet;
  // the room behind the laptop asks for it again when it is left (its laptop shows the first screen)
  addEventListener('message', (e) => { if (e.data?.type === 'inside:intro') { smooth.active = false; scrollTo(0, 0); smooth.cur = smooth.target = 0; sigShow(true); } });
}

// ---- the palettes: the swatches at the top right; a pick brings its palette in under an ink ball (inkball.js),
// the Milky Way one over a live galaxy (galaxy.js): behind the first screen while it is up (its own canvas in the
// sheet), and behind the whole page round the 3D's window after
const skyPage = document.createElement('canvas'); skyPage.className = 'galaxy'; skyPage.setAttribute('aria-hidden', 'true');
$('.hole').before(skyPage);
const skySheet = document.createElement('canvas'); skySheet.className = 'galaxy sheet-sky'; skySheet.setAttribute('aria-hidden', 'true');
sig.el?.after(skySheet);
// (each made only when first wanted: three more GL contexts at load would be three more things to wait on)
const lazySky = (canvas) => { let g = null; const get = () => (g ??= createGalaxy(canvas)); return { show: () => get().show(), hide: () => g?.hide(), warm: () => get().warm(), get on() { return !!g?.on; } }; };
const galaxyPage = lazySky(skyPage), galaxySheet = lazySky(skySheet);
const inkCanvas = document.createElement('canvas'); inkCanvas.className = 'inkball'; inkCanvas.setAttribute('aria-hidden', 'true');
document.body.append(inkCanvas);
const ink = (() => { let k = null; const get = () => (k ??= createInkBall(inkCanvas)); return { play: (c, f) => get().play(c, f), warm: () => get().warm(), get busy() { return !!k?.busy; } }; })();
// (where the browser can show the old page and the new at once, the new one spreads out from a drop instead: reveal.js)
const reveal = canReveal() ? (() => {
  const c = document.createElement('canvas'); c.className = 'vtfx'; c.setAttribute('aria-hidden', 'true'); document.body.append(c);
  let r = null; const get = () => (r ??= createReveal(c));
  return { play: (cl, f) => get().play(cl, f), warm: () => get().warm(), get busy() { return !!r?.busy; } };
})() : null;
const bring = reveal ?? ink;
function skies() {
  const g = palette.key === 'galaxy';
  const sheetUp = sig.el && sig.up && !sig.busy;
  if (g && (sig.up || sig.busy)) galaxySheet.show(); else galaxySheet.hide();
  if (g && !sheetUp) galaxyPage.show(); else galaxyPage.hide();
}
// (over the sky the sheets round the window are clear, so the 3D itself is cut to the window)
const sceneCanvas = $('canvas.scene');
let sceneClip = '';
function clipScene(r) {
  const v = r && palette.key === 'galaxy' && r.l + r.t + r.r + r.b > 0.5 ? `inset(${r.t.toFixed(1)}px ${r.r.toFixed(1)}px ${r.b.toFixed(1)}px ${r.l.toFixed(1)}px)` : '';
  if (v !== sceneClip) { sceneClip = v; sceneCanvas.style.clipPath = v; }
}
function usePalette(p) {
  palette = p;
  paintPage(p);
  scene.setDay(p.shade, p.light);
  scene.clearStage = p.key === 'galaxy';
  clipScene(lastHole);
  store.set('samy-palette', p.key);
  for (const b of $$('.palettes button')) b.setAttribute('aria-pressed', String(b.dataset.key === p.key));
  skies();
  dirty = true;
}
{
  const box = document.createElement('div');
  box.className = 'palettes'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Colours of the site');
  box.innerHTML = PALETTES.map((p) => `<button type="button" data-key="${p.key}" class="${p.key === 'galaxy' ? 'galaxy' : ''}" style="--a:${p.light};--b:${p.shade}" aria-label="${p.name}" aria-pressed="${p.key === palette.key}"></button>`).join('') + '<span class="tip"></span>';
  $('header').append(box);
  box.addEventListener('pointerenter', () => { bring.warm(); galaxyPage.warm(); }, { once: true });
  const tip = $('.tip', box);
  box.addEventListener('pointerover', (e) => { const b = e.target.closest('button'); if (b) { tip.textContent = b.getAttribute('aria-label'); tip.classList.add('on'); } });
  box.addEventListener('pointerleave', () => tip.classList.remove('on'));
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || bring.busy || b.dataset.key === palette.key) return;
    const p = byKey(b.dataset.key);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { usePalette(p); return; }
    bring.play(p.fluid, () => usePalette(p));
  });
}
scene.clearStage = palette.key === 'galaxy';
skies();

// ---- the last card's "See more": his other sites
for (const box of $$('.more')) {
  const btn = $('.more-btn', box), list = $('.more-list', box);
  const open = (v) => { list.hidden = !v; btn.setAttribute('aria-expanded', String(v)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(list.hidden); });
  addEventListener('click', (e) => { if (!box.contains(e.target)) open(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
}

// ---- smooth scroll (what Lenis does for them): the wheel sets a target, the page eases to it
const smooth = { target: 0, cur: 0, active: false, max: 0, locked: true };
let wheelUp = 0, wheelUpAt = 0;
addEventListener('wheel', (e) => {
  if (e.ctrlKey) return;
  if (sig.up) { e.preventDefault(); if (e.deltaY > 2) sigHide(); return; }
  // (at the very top, a firm turn of the wheel upward brings the first screen back down)
  if (sig.el && !sig.busy && sig.opened && introT >= 2.4 && scrollY < 2 && smooth.target < 2 && e.deltaY < 0) {
    const now = performance.now();
    wheelUp = (now - wheelUpAt > 350 ? 0 : wheelUp) - e.deltaY; wheelUpAt = now;
    if (wheelUp > 120) { wheelUp = 0; e.preventDefault(); sigShow(); return; }
  }
  if (!matchMedia('(pointer: fine)').matches) return;
  e.preventDefault();
  if (smooth.locked) return;
  const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? VH : 1);
  if (!smooth.active) smooth.cur = smooth.target = scrollY;
  smooth.target = clamp(smooth.target + d, 0, smooth.max);
  smooth.active = true;
}, { passive: false });
addEventListener('scroll', () => { if (!smooth.active) smooth.cur = smooth.target = scrollY; dirty = true; }, { passive: true });
const scrollToY = (y) => { smooth.cur = scrollY; smooth.target = clamp(y, 0, smooth.max); smooth.active = true; };
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const t = a.getAttribute('href') === '#top' ? document.body : $(a.getAttribute('href'));
  if (!t) return;
  e.preventDefault();
  scrollToY(t === document.body ? 0 : docTop(t));
});

// ---- the pointer: the camera leans with it, the corner shows where it is ---------------------
addEventListener('pointerleave', () => scene.pointerOut());
document.documentElement.addEventListener('pointerleave', () => scene.pointerOut());
addEventListener('pointermove', (e) => {
  const x = (e.clientX / VW) * 2 - 1, y = -((e.clientY / VH) * 2 - 1);
  scene.pointer(x, y);
  coords.x.textContent = x.toFixed(2);
  coords.y.textContent = y.toFixed(2);
});

// ---- the toy: their Generate box, ours a command: it types itself as the section runs, and Run plays
// the design system onto the blocks again
const cmd = { text: $('.cmd-text'), run: $('.toy .run'), words: 'Open the work storey', shown: -1 };
cmd.run?.addEventListener('click', () => { cmd.run.classList.add('pressed'); setTimeout(() => cmd.run.classList.remove('pressed'), 260); scene.replay?.('system'); });

// ---- questions open and close -------------------------------------------------------------
$$('.q').forEach((q) => q.addEventListener('click', () => q.setAttribute('aria-expanded', q.getAttribute('aria-expanded') !== 'true')));

// ---- back to the desk: the room behind the laptop listens for this (Esc does the same) --------
const back = (e) => { if (!inFrame) return; e?.preventDefault(); window.parent.postMessage({ type: 'inside:back' }, '*'); };
$$('a[href="./"]').forEach((a) => a.addEventListener('click', back));
addEventListener('keydown', (e) => { if (e.key === 'Escape') back(e); });

// ---- the frame loop ----------------------------------------------------------------------
let dirty = true, last = performance.now(), introT = 0, introOn = false, lastHole = null;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (smooth.active) {
    smooth.cur += (smooth.target - smooth.cur) * (1 - Math.exp(-dt * 7.5));
    if (Math.abs(smooth.target - smooth.cur) < 0.4) { smooth.cur = smooth.target; smooth.active = false; }
    scrollTo(0, smooth.cur);
    dirty = true;
  }
  const y = smooth.active ? smooth.cur : scrollY;

  // the opening: the window grows from a point to its first state as the title writes itself
  if (introOn && introT < 2.4) { introT += dt; dirty = true; if (introT >= 1.6) smooth.locked = false; }
  const k = ease.inOut(clamp(introT / 1.8));
  intro.seek(introOn ? introT : 0);

  const busy = sections.some((s) => s.buttons.dir || s.reveal.dir || (s.toyTl && s.toyTl.dir));
  if (dirty || busy) {
    const hr = mixRect(holeState('closed'), holeAt(y), k);
    applyHole(hr);
    lastHole = hr; clipScene(hr);
    // the story framed for the window: its middle where the window's middle is (a wide screen)
    if (LG) scene.center((hr.l + VW - hr.r) / 2 - VW / 2, (hr.t + VH - hr.b) / 2 - VH / 2);
    if (LG) {
      const p = range(y, 0, T.introEnd);
      heroTitle.style.transform = `translateY(${-160 * p}%)`;
      sub.style.opacity = 1 - p;
      sub.style.visibility = p >= 1 ? 'hidden' : 'visible';
    }
    for (const s of sections) posePanel(s, y, dt);
    // the letter's title: shown from when the window opens fully until its sheet has passed
    const lOn = y > T.letterTop - VH * 0.5 && y < T.letterRun + VH * 1.4;
    letter.head.style.visibility = lOn ? 'visible' : 'hidden';
    // the envelope: up from below as the letter begins, down and away once its sheet has risen out
    const envK = range(y, T.letterTop - VH * 0.4, T.letterTop + VH * 0.2) * (1 - range(y, T.letterRun + VH * 0.7, T.letterRun + VH * 1.3));
    for (const e of envs) e.style.transform = `translate(-50%, ${(1 - ease.inOut(envK)) * 101}%)`;
    if (lOn) letter.tl.progress(range(y, T.letterTop - VH * 0.5, T.letterTop + VH * 0.3));
    // (their opening: the sequence runs from 0 to its first camera keyframe as the title writes itself)
    { const f = ease.inOut(clamp(introT / 2.2)); scene.u = f < 1 ? TRACKS.camera[0][0] * f : storyAt(y); }
    scene.letter = y > T.letterTop - VH * 0.45 ? Math.max(0.0001, range(y, T.letterTop - VH * 0.45, T.letterRun + VH * 1.4)) : 0;
    // their closing: the letter's stage rises from the bottom over the room as the window opens out
    scene.rise = range(y, T.letterTop - VH * 1.04, T.letterTop - VH * 0.37);
    // the command types itself as their prompt does, over the start of section 3's pin; Run is pressed
    if (cmd.text) { const n = Math.round(cmd.words.length * range(scene.u, 16.2, 16.9)); if (n !== cmd.shown) { cmd.shown = n; cmd.text.textContent = cmd.words.slice(0, n); } cmd.run?.classList.toggle('pressed', scene.u > 16.95 && scene.u < 17.1); }
    // the thumb: shown while the page moves, gone a moment after
    const th = Math.max(24, (VH / (T.max + VH)) * VH);
    thumb.style.height = `${th}px`;
    thumb.style.transform = `translateY(${(y / Math.max(1, T.max)) * (VH - th)}px)`;
    thumb.classList.add('on'); clearTimeout(thumb.t); thumb.t = setTimeout(() => thumb.classList.remove('on'), 900);
    dirty = false;
  }
  scene.hold = sig.up && !sig.busy;
  if (palette.key === 'galaxy') skies();
  scene.frame(dt);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => { layout(); sigLayout(); });
await document.fonts.ready;
// the opening waits for the room and him (at most 4 s), as theirs waits behind its loader
await Promise.race([scene.ready, new Promise((r) => setTimeout(r, 4000))]);
layout();
smooth.cur = smooth.target = scrollY;
sigLayout();
requestAnimationFrame((t) => { last = t; frame(t); requestAnimationFrame(() => { if (!sig.up) startOpening(); }); });
// (the shaders a palette pick needs, readied in a still moment once the room is up: never on the first click)
// (their programs compiled off the main thread, once the room is up and the page has been still a while)
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 200));
scene.ready.then(() => new Promise((r) => setTimeout(r, 4000))).then(() => sig.quiet()).then(() => idle(() => { bring.warm(); idle(() => galaxyPage.warm()); }));
// (yAt: the scroll that puts the story at u, for checking a moment of it)
const yAt = (v) => { let lo = 0, hi = T.max; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (storyAt(m) < v) lo = m; else hi = m; } return lo; };
// the dark mode switch (the Real Facades panel): the 3D's room goes to night, its tower's pages lit
for (const b of document.querySelectorAll('.night-toggle')) {
  b.addEventListener('click', () => { const on = !scene.isNight; scene.night(on); b.setAttribute('aria-pressed', String(on)); b.querySelector('.btn-in').textContent = on ? 'Light mode' : 'Dark mode'; });
}
window.__inside = { scene, sections, get T() { return T; }, storyAt, yAt, holeAt, layout, scrollToY, sig: { show: sigShow, hide: sigHide, get up() { return sig.up; } } };
