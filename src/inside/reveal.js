// A palette coming in as he asked: a drop of it falls into the middle of the page, and the page in its new colours
// spreads out from there, the old page still there round it, until the new page is all. The edge between them is a
// clone of santionispirits.com's: a hard, glowless band of the new palette's darkest colour whose sides break into
// vertical fingers (cloud noise and wavering lines added and cut at one level), boiling on a clock that steps 8 times
// a second. The page is the browser's own: a view transition, its old picture under the live new one, the new one shown
// through a mask of growing circles (a centre and lobes that bulge out after it, so the front billows); the band and
// the drop are a GL canvas over it, on the same clock, drawn along the same circles.
const VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
// the circles: [dx, dy] from the middle (in the viewport's longer side), when each starts (share of the clock), how fast
const BLOBS = [[0, 0, 0.1, 0.9], [0.08, -0.03, 0.15, 1.04], [-0.07, 0.045, 0.17, 1.0], [0.03, 0.09, 0.21, 1.06], [-0.05, -0.08, 0.19, 1.02],
  [0.1, 0.06, 0.26, 1.08], [-0.11, -0.02, 0.24, 1.05], [0.01, -0.11, 0.29, 1.07], [-0.03, 0.12, 0.31, 1.04]];
const R = 0.95;                              // (a circle's radius at the end, at speed 1, in the longer side)
const DUR = 2600, N = 40;
const ease = (t) => 1 - Math.pow(1 - t, 2.2);                          // (fast as it lands, slower as it spreads)
const KEYS = Array.from({ length: N + 1 }, (_, i) => ease(i / N));
const vtAt = (t) => { const x = Math.min(1, Math.max(0, t)) * N, i = Math.min(N - 1, Math.floor(x)); return KEYS[i] + (KEYS[i + 1] - KEYS[i]) * (x - i); };

const FS = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uV; uniform float uVmax; uniform float uTime;
uniform vec3 uDeep; uniform vec3 uShade; uniform vec3 uLight; uniform vec3 uSpark;
uniform vec4 uBlob[${BLOBS.length}];
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
float aastep(float th, float v) { float w = length(vec2(dFdx(v), dFdy(v))) * 0.70710678; return smoothstep(th - w, th + w, v); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);               // (top down, as the page's mask is)
  vec2 c = 0.5 * uRes;
  // the front: the union of the circles, as the mask draws it (distance to it, in the longer side)
  float sd = 1e5;
  for (int i = 0; i < ${BLOBS.length}; i++) {
    vec4 b = uBlob[i];
    float r = max(0.0, (uV - b.z)) * b.w * ${R.toFixed(3)};
    if (r > 0.0) sd = min(sd, length((px - c) / uVmax - b.xy) - r);
  }
  vec2 q = (px - c) / uVmax;
  float spread = step(0.105, uV);                                         // (it has landed and begun)
  // the edge, as santionispirits draws theirs: no glow, a hard line through cloud noise and wavering vertical
  // lines added together, both made here (their lines.jpg, their clouds_noise.png), on a clock that steps 8 times a
  // second; a band of the new palette's darkest colour, its two sides breaking into vertical fingers
  float st = floor(uTime * 8.0) / 8.0;
  float wave = fbm(vec2(q.x * 3.0, q.y * 1.2 + st * 0.6));
  float lines = 0.5 + 0.5 * sin(6.2831853 * (q.x * 330.0 + wave * 5.0));                   // (fine: a few pixels apart)
  lines *= 0.5 + noise(vec2(q.x * 330.0 + wave * 5.0, st));                                  // (each line its own weight)
  float nz = fbm(q * vec2(70.0, 5.0) + vec2(0.0, -st * 0.9));                                // (drawn out up and down)
  // (thin: a line at the front, its fine streaks running a little way off it)
  float f = 1.0 - abs(sd + 0.002) / 0.014 + (lines - 0.5) * 0.9 + (nz - 0.5) * 0.6;
  float band = aastep(0.5, f) * spread;
  // the drop: falling into the middle, the same dark colour, and landing
  float fall = clamp(uT / 0.1, 0.0, 1.0);
  vec2 dq = (q - vec2(0.0, -0.3 * (1.0 - fall * fall))) / vec2(1.0, 1.25);
  float drop = (1.0 - aastep(0.0, length(dq) - 0.012 * (0.6 + 0.4 * fall))) * (1.0 - step(0.1, uT));
  float a = max(band, drop) * (1.0 - smoothstep(0.92, 1.0, uT));
  gl_FragColor = vec4(uDeep * a, a);
}`;

const hex = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// the page's mask: the same circles, their radii on --vt, which the clock animates on the new picture only
function maskCSS() {
  const layers = BLOBS.map(([dx, dy, d, sp]) => `radial-gradient(circle max(0px, calc((var(--vt) - ${d}) * ${(sp * R * 100).toFixed(2)}vmax)) at calc(50% + ${(dx * 100).toFixed(2)}vmax) calc(50% + ${(dy * 100).toFixed(2)}vmax), #000 calc(100% - 2px), #0000 100%)`).join(', ');
  return `@property --vt { syntax: '<number>'; inherits: false; initial-value: 0; }
html.vt-ink::view-transition-old(root), html.vt-ink::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
html.vt-ink::view-transition-new(root) { -webkit-mask-image: ${layers}; mask-image: ${layers}; }
html.vt-ink::view-transition-group(vt-fx), html.vt-ink::view-transition-new(vt-fx) { animation: none; }
html.vt-ink::view-transition-old(vt-fx) { display: none; }`;
}

export function canReveal() {
  return !!document.startViewTransition && typeof CSS !== 'undefined' && CSS.registerProperty !== undefined;
}

export function createReveal(canvas) {
  const st = document.createElement('style'); st.textContent = maskCSS(); document.head.append(st);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false });
  const par = gl?.getExtension('KHR_parallel_shader_compile');
  gl?.getExtension('OES_standard_derivatives');
  let pr = null, u = null, linked = false, busy = false;
  if (gl) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    linked = !par;
  }
  const ready = () => {
    if (!gl) return false;
    if (!linked) linked = gl.getProgramParameter(pr, par.COMPLETION_STATUS_KHR);
    if (!linked) return false;
    if (!u) {
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const U = (n) => gl.getUniformLocation(pr, n);
      u = { res: U('uRes'), t: U('uT'), v: U('uV'), vmax: U('uVmax'), time: U('uTime'), deep: U('uDeep'), shade: U('uShade'), light: U('uLight'), spark: U('uSpark'), blob: U('uBlob') };
      gl.uniform4fv(u.blob, new Float32Array(BLOBS.flat()));
    }
    return true;
  };
  const scale = Math.min(screen.width, screen.height) < 700 ? 0.5 : 0.6;
  /** bring the new palette in: swap() puts it on the page (inside the transition's update) */
  async function play(colors, swap) {
    if (busy) return; busy = true;
    const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale);
    // (set up the moment its shader is in: on the first frame, or a frame or two later if it was still compiling)
    let set = false;
    const setUp = () => {
      if (set || !ready()) return set;
      canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
      const [c0, c1, c2, c3] = colors.map(hex);
      gl.uniform3fv(u.deep, c0); gl.uniform3fv(u.shade, c1); gl.uniform3fv(u.light, c2); gl.uniform3fv(u.spark, c3);
      gl.uniform2f(u.res, w, h); gl.uniform1f(u.vmax, Math.max(w, h));
      gl.clearColor(0, 0, 0, 0);
      return (set = true);
    };
    setUp();
    const root = document.documentElement;
    root.classList.add('vt-ink');
    performance.mark('vt-start');
    const vt = document.startViewTransition(() => { performance.mark('vt-update'); swap(); canvas.classList.add('on'); performance.mark('vt-swapped'); });
    try {
      await vt.ready;
      performance.mark('vt-ready');
      const anim = root.animate({ '--vt': KEYS }, { duration: DUR, easing: 'linear', fill: 'forwards', pseudoElement: '::view-transition-new(root)' });
      const t0 = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          const t = anim.currentTime != null ? anim.currentTime / DUR : (now - t0) / DUR;
          if (setUp()) {
            gl.uniform1f(u.t, t); gl.uniform1f(u.v, vtAt(t)); gl.uniform1f(u.time, now / 1000);
            gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
          }
          if (t < 1) requestAnimationFrame(step); else done();
        };
        requestAnimationFrame(step);
      });
      await vt.finished;
    } catch { /* (the page is in its new colours either way) */ }
    root.classList.remove('vt-ink');
    canvas.classList.remove('on');
    if (set) gl.clear(gl.COLOR_BUFFER_BIT);
    busy = false;
  }
  return { play, warm: () => { const go = () => { if (gl && !ready()) setTimeout(go, 100); }; go(); }, get busy() { return busy; } };
}
