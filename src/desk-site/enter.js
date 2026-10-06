// Enter: stepping into the laptop. The site inside it (inside.html) runs in a frame laid on
// the laptop's display, so the screen in the room is the real site. Enter, or a click or tap
// on the screen, flies the room into it: every frame the display's four corners move a
// step closer to the corners of the window, and the whole room is warped by the one
// perspective transform that carries them there, so the room swells past the edges as the
// screen comes to fill the view, blurring, with a flash of light as we pass the glass.
// Esc (or the site's "back to the desk", or the browser's back) flies out again.
// A code stand-in: the Blender-rendered dive will take the room's part later.

const W = () => innerWidth, H = () => innerHeight;

// ---- a perspective transform taking four points to four points, as a CSS matrix3d ---------
const adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
const mm = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c.push(s); } return c; };
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const basis = (p) => { const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; const v = mv(adj(m), [p[3][0], p[3][1], 1]); return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
/** src and dst: four points each, TL, TR, BR, BL */
export function warp(src, dst) {
  const o = (q) => [q[0], q[1], q[3], q[2]];
  const t = mm(basis(o(dst)), adj(basis(o(src))));
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}
/** where a point of the rectangle src lands under the perspective transform taking src to dst (both TL, TR, BR, BL) */
export function mapPoint(src, dst, x, y) {
  const o = (q) => [q[0], q[1], q[3], q[2]];
  const t = mm(basis(o(dst)), adj(basis(o(src))));
  const v = mv(t, [x, y, 1]);
  return [v[0] / v[2], v[1] / v[2]];
}
export const rect = (w, h, x = 0, y = 0) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export const mix = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
const inQuad = (q, x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4]; const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (c !== 0) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; };
// slow out of the room, fast through the middle, a long settle into the site
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createEnter({ stage, scene, room, screens, mock, hint }) {
  const narrow = () => H() > W();
  const quad = () => scene.screen.map((p) => stage.toScreen(p));   // the display, TL TR BR BL, in px
  let frame = null, loaded = null, state = 'room', busy = false;
  const flash = document.createElement('div'); flash.className = 'dive-flash'; document.body.append(flash);

  // the site, loaded into a frame that lies on the display, live. On a wide screen it is laid out
  // at the window's own size, so the dive ends on it exactly; on a phone at a laptop's size
  // (1280 x 800), so the laptop shows the same page as on a computer, and the dive fills the phone
  // with it and then, under a flash of paper, lets it lay itself out for the phone
  const box = () => (narrow() ? [1280, 800] : [W(), H()]);
  function load() {
    if (frame) return loaded;
    frame = document.createElement('iframe');
    frame.className = 'inside-frame';
    frame.title = 'The site on the laptop';
    frame.src = './inside.html';
    loaded = new Promise((ok) => { frame.addEventListener('load', ok, { once: true }); setTimeout(ok, 8000); });
    screens.append(frame);
    place();
    // (the stand-in stays under the site until the site has fully faded in: between them the render's own baked screen showed)
    loaded.then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => window.__insideLoaded?.()));
      frame.classList.add('shown'); setTimeout(() => mock?.classList.add('gone'), 900);
      if (window.__landed) frame.contentWindow?.postMessage({ type: 'desk:landed' }, '*');   // (it came in after the splash)
    });
    return loaded;
  }
  function place() {
    if (!frame || state !== 'room') return;
    const [bw, bh] = box();
    Object.assign(frame.style, { width: `${bw}px`, height: `${bh}px`, transform: warp(rect(bw, bh), quad()) });
  }
  const paperFlash = (to, ms) => new Promise((ok) => {
    flash.style.transition = `opacity ${ms}ms ease`;
    flash.style.opacity = to;
    setTimeout(() => { flash.style.transition = ''; ok(); }, ms);
  });
  const frames2 = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  addEventListener('resize', () => requestAnimationFrame(place));

  // one flight, t from 0 (the room) to 1 (the site) or back
  function fly(from, to, dur) {
    const q0 = quad();
    // where the display ends: the window itself, or (phone) the laptop-shaped page grown to cover it
    const [bw, bh] = box();
    const cover = Math.max(W() / bw, H() / bh);
    const q1 = narrow() ? rect(bw * cover, bh * cover, (W() - bw * cover) / 2, (H() - bh * cover) / 2) : rect(W(), H());
    return new Promise((ok) => {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / (dur * 1000));
        const t = from + (to - from) * k, e = ease(t);
        room.style.transform = warp(q0, mix(q0, q1, e));
        // the room goes soft and bright as we reach the glass; the flash peaks just past it
        stage.canvas.style.filter = `blur(${Math.max(0, e - 0.55) * 14}px) brightness(${1 + Math.max(0, e - 0.6) * 0.9})`;
        flash.style.opacity = Math.max(0, 1 - Math.abs(t - 0.86) / 0.16) * 0.55;
        frame.style.filter = `brightness(${0.82 + 0.18 * e})`;
        if (k < 1) requestAnimationFrame(step); else ok();
      };
      requestAnimationFrame(step);
    });
  }

  async function into() {
    if (busy || state !== 'room') return;
    busy = true;
    hint?.classList.add('gone');
    await load();
    frame.classList.add('shown');
    document.body.classList.add('diving');
    await fly(0, 1, 2.1);
    if (narrow()) await paperFlash(1, 160);              // (the phone: the page lays itself out for it, unseen)
    // there: the room's warp and the frame's own cancel out, so drop both and the site is crisp
    room.style.transform = '';
    Object.assign(frame.style, { transform: 'none', width: `${W()}px`, height: `${H()}px`, filter: '', opacity: '' });
    if (narrow()) { await frames2(); await paperFlash(0, 420); }
    flash.style.opacity = 0;
    frame.classList.add('live');
    room.style.visibility = 'hidden';
    stage.sleep(true);
    state = 'site'; busy = false;
    document.body.classList.replace('diving', 'inside');
    if (history.state?.inside !== true) history.pushState({ inside: true }, '', '#inside');
    frame.focus(); frame.contentWindow?.focus();
  }

  async function out() {
    if (busy || state !== 'site') return;
    busy = true;
    stage.sleep(false);
    if (narrow()) await paperFlash(1, 200);              // (back to the laptop's layout, unseen)
    room.style.visibility = '';
    frame.classList.remove('live');
    const [bw, bh] = box();
    Object.assign(frame.style, { width: `${bw}px`, height: `${bh}px`, transform: warp(rect(bw, bh), quad()) });
    document.body.classList.replace('inside', 'diving');
    if (narrow()) { await frames2(); paperFlash(0, 380); }
    await fly(1, 0, 1.7);
    room.style.transform = ''; stage.canvas.style.filter = ''; flash.style.opacity = 0;
    frame.style.filter = '';
    document.body.classList.remove('diving');
    state = 'room'; busy = false;
    frame.contentWindow?.postMessage({ type: 'inside:intro' }, '*');   // (the laptop shows his first screen again)
    window.focus();
  }
  // leaving asks the history first, so the browser's back button and Esc agree
  const leave = () => { if (state !== 'site') return; if (history.state?.inside) history.back(); else out(); };
  addEventListener('popstate', () => { if (state === 'site') out(); else if (history.state?.inside && state === 'room') into(); });
  addEventListener('message', (e) => { if (e.source === frame?.contentWindow && e.data?.type === 'inside:back') leave(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state === 'room' && !e.repeat && !document.body.classList.contains('splashing')) { e.preventDefault(); into(); }
    if (e.key === 'Escape') leave();
  });
  // a click or a tap on the laptop's display
  addEventListener('click', (e) => { if (state === 'room' && !document.body.classList.contains('splashing') && inQuad(quad(), e.clientX, e.clientY)) into(); });
  addEventListener('pointermove', (e) => { if (state === 'room') document.body.style.cursor = inQuad(quad(), e.clientX, e.clientY) ? 'pointer' : ''; });

  // the live site on the display from the start, under the splash (it waits there, still, for the splash to land)
  load();
  if (location.hash === '#inside') history.replaceState(null, '', location.pathname + location.search);
  return { into, out, place, get state() { return state; } };
}
