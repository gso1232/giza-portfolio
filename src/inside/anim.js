// Small stand-ins for what the reference gets from GSAP: its three custom eases, text
// split into characters or words, and a timeline that can be scrubbed to any time or
// played forward and back in real time.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (v, a, b) => clamp((v - a) / (b - a));

/** a CSS-style cubic-bezier(x1, y1, x2, y2) as a function of 0..1 */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-5) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-3) {   // Newton lost it: bisect
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
// the reference's own curves (CustomEase "joe.*"), and GSAP's sine.out and none
export const ease = {
  out: bezier(0.2, 0, 0.1, 1),
  inOut: bezier(0.333, 0, 0, 1),
  in: bezier(0.8, 0, 0.8, 0.5),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  none: (t) => t,
};

/** wrap an element's text in spans, one per character (in word spans so lines still
 *  break between words) or one per word; returns the spans */
export function split(el, type = 'chars') {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';
  const out = [];
  text.split(' ').forEach((word, i, all) => {
    const w = document.createElement('span');
    w.className = 'wd';
    if (type === 'words') { w.textContent = word; out.push(w); }
    else for (const c of word) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.append(s); out.push(s); }
    el.append(w);
    if (i < all.length - 1) el.append(' ');
  });
  return out;
}

/** tweens laid out in time, each over a list of elements with a stagger, as GSAP's
 *  timeline().fromTo(..., position); seek(t) poses everything at time t */
export class Timeline {
  constructor() { this.tweens = []; this.duration = 0; this.time = -1; this.dir = 0; }
  add(els, at, set, { dur = 0.8, stagger = 0, ease: e = ease.out } = {}) {
    els = [...els].filter(Boolean);
    if (!els.length) return this;
    this.tweens.push({ els, at, set, dur, stagger, e, last: els.map(() => NaN) });
    this.duration = Math.max(this.duration, at + dur + stagger * (els.length - 1));
    return this;
  }
  seek(t) {
    if (t === this.time) return;
    this.time = t;
    for (const tw of this.tweens) tw.els.forEach((el, i) => {
      const p = tw.e(clamp((t - tw.at - i * tw.stagger) / tw.dur));
      if (p !== tw.last[i]) { tw.last[i] = p; tw.set(el, p); }
    });
  }
  /** scrubbed: progress 0..1 across the whole timeline */
  progress(p) { this.seek(clamp(p) * this.duration); }
  /** toggled: play forward (1) or back (-1) in real time from where it is; tick(dt) moves it */
  play(dir) { this.dir = dir; }
  tick(dt) {
    if (!this.dir) return false;
    const t = clamp((this.time < 0 ? 0 : this.time) + this.dir * dt, 0, this.duration);
    this.seek(t);
    if (t === 0 || t === this.duration) this.dir = 0;
    return true;
  }
}

export const fade = (el, p) => { el.style.opacity = p; };
