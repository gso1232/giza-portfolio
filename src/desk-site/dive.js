// The dive: scrolling down on the desk flies the camera into the laptop's screen, and the
// page on it becomes the site; scrolling back up flies out again. The flight is a
// path-traced video (public/desk/dive-fwd.mp4, and dive-rev.mp4 for going back) drawn
// by the stage in place of the pictures, and the live page on the laptop follows the
// display's corners frame by frame (dive.json), so it grows to fill the screen.

export function createDive({ stage, screen, scene, base, fps = 30 }) {
  const corners = scene.dive;                                   // [frame][TL, TR, BR, BL] as image fractions
  const last = corners.length - 1;
  const mk = (src) => {
    const v = document.createElement('video');
    Object.assign(v, { muted: true, playsInline: true, preload: 'auto', src: base + src });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    return v;
  };
  const fwd = mk('dive-fwd.mp4'), rev = mk('dive-rev.mp4');
  let state = 'desk', busy = false;

  const place = (f) => screen.place(corners[Math.max(0, Math.min(last, f))].map((p) => stage.toScreen(p)));
  // follow the video: every painted frame, put the page where the display is in it
  const follow = (v, toFrame) => {
    const step = (_, meta) => {
      if (v.paused || v.ended) return;
      place(toFrame(Math.round(meta.mediaTime * fps)));
      v.requestVideoFrameCallback(step);
    };
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(step);
    else { const tick = () => { if (!v.paused && !v.ended) { place(toFrame(Math.round(v.currentTime * fps))); requestAnimationFrame(tick); } }; requestAnimationFrame(tick); }
  };
  const play = (v, toFrame) => new Promise((ok) => {
    v.currentTime = 0;
    v.addEventListener('ended', ok, { once: true });
    follow(v, toFrame);
    v.play().catch(ok);
  });

  async function into() {
    if (busy || state !== 'desk') return;
    busy = true;
    document.body.classList.add('diving');
    await stage.calm(1);                                        // the breeze and the leaf shadows settle first
    stage.showVideo(fwd);
    await play(fwd, (f) => f);
    place(last);
    state = 'site';
    document.body.classList.remove('diving');
    document.body.classList.add('inside');
    busy = false;
  }
  async function out() {
    if (busy || state !== 'site') return;
    busy = true;
    document.body.classList.remove('inside');
    document.body.classList.add('diving');
    stage.showVideo(rev);
    await play(rev, (f) => last - f);
    stage.showVideo(null);
    place(0);
    await stage.calm(0);
    state = 'desk';
    document.body.classList.remove('diving');
    busy = false;
  }

  // scroll, swipe or keys: down goes in, up comes out
  addEventListener('wheel', (e) => { if (e.deltaY > 8) into(); else if (e.deltaY < -8) out(); }, { passive: true });
  let y0 = null;
  addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', (e) => { if (y0 == null) return; const dy = y0 - e.changedTouches[0].clientY; if (dy > 40) into(); else if (dy < -40) out(); y0 = null; }, { passive: true });
  addEventListener('keydown', (e) => { if (['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) into(); if (['ArrowUp', 'PageUp', 'Escape'].includes(e.key)) out(); });
  // warm both videos up so the first scroll starts at once
  fwd.load(); rev.load();
  return { into, out, get state() { return state; }, place };
}
