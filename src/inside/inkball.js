// The ink ball that brings a palette in (the Reality Stone's aether, as he asked): a drop of liquid in the new
// palette's colours appears in the middle of the screen and swells, its edge ragged and reaching out in tendrils, its
// inside swirling, until it covers everything; under it the page takes its new colours; then it opens from its own
// middle and runs off the edges, and the page is there in them. One full-screen shader, drawn only while it plays.
const VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uGrow; uniform float uOpen; uniform float uMaxR;
uniform vec3 uDeep; uniform vec3 uShade; uniform vec3 uLight; uniform vec3 uSpark;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// the edge of a ball of radius R, as a splash of ink lands: round lobes swelling out of it (moving: it is liquid), a
// few sharp spikes thrown out of those, and its rim never quite still
float edge(vec2 p, float R, float seed) {
  float r = length(p), a = atan(p.y, p.x);
  vec2 ring = vec2(cos(a), sin(a));
  float lobes = fbm(ring * 1.3 + vec2(seed, uT * 0.45)) - 0.5;
  float spikes = pow(max(0.0, fbm(ring * 4.6 + vec2(uT * 0.25, seed * 1.7)) - 0.5) * 4.0, 3.0);
  float wob = (noise(ring * 9.0 + vec2(seed, uT * 1.5)) - 0.5) * 0.04;
  return r - R * (1.0 + 0.42 * lobes + 0.55 * spikes + wob);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float R = uGrow * uMaxR, H = uOpen * uMaxR;
  float aa = 1.6 / uRes.y;                                                     // (a pixel and a half of soft edge)
  float d = edge(p, R, 3.0);
  float inside = (1.0 - smoothstep(-aa, aa, d)) * step(0.0005, uGrow);
  // droplets thrown ahead of it, round, some big, some small (none before it has grown, none once it covers)
  vec2 q = p * 11.0; vec2 id = floor(q); vec2 g = fract(q) - 0.5;
  float n = h21(id + 7.0);
  float rad = mix(0.05, 0.2, pow(h21(id + 4.4), 2.0));
  float drop = (1.0 - smoothstep(rad - aa * 11.0, rad + aa * 11.0, length(g - (vec2(h21(id + 1.3), h21(id + 2.9)) - 0.5) * 0.5))) * step(0.8, n);
  float near = (1.0 - smoothstep(0.0, 0.14, abs(d - 0.07))) * step(0.0, d) * smoothstep(0.03, 0.15, uGrow) * (1.0 - smoothstep(0.85, 1.0, uGrow));
  float a1 = max(inside, drop * near);
  // the opening: a hole from the middle, its edge the same kind of splash
  float dh = edge(p, H, 11.0);
  float open = uOpen > 0.0005 ? smoothstep(-aa, aa, dh) : 1.0;
  float alpha = a1 * open;
  // the aether: liquid light swirling (faster near the middle), folded on itself
  float r = length(p);
  vec2 s = rot(uT * 0.8 + 2.4 * r) * p;
  vec2 w = vec2(fbm(s * 2.2 + uT * 0.35), fbm(s * 2.2 + 4.1 - uT * 0.3));
  float f = fbm(s * 3.0 + 2.8 * w);
  vec3 col = mix(uDeep, uShade, smoothstep(0.2, 0.6, f));
  col = mix(col, uLight, smoothstep(0.58, 0.92, f) * 0.8);
  // threads of light running through it, and sparks
  float thread = 1.0 - smoothstep(0.0, 0.028, abs(fbm(s * 4.0 + w * 3.0) - 0.5));
  col += mix(uLight, uSpark, 0.45) * thread * 0.32;
  col += uSpark * pow(smoothstep(0.6, 1.0, fbm(s * 7.0 + w * 5.0)), 3.0) * 0.8;
  col += uLight * 0.18 * exp(-r * r * 7.0) * (1.0 - uOpen);                  // (it glows from its heart)
  // its rim catches the light (and the hole's rim, as it opens)
  float rim = (1.0 - smoothstep(0.0, 0.03, abs(d))) * inside;
  if (uOpen > 0.0005) rim = max(rim, (1.0 - smoothstep(0.0, 0.03, abs(dh))) * open * a1);
  col = mix(col, mix(uLight, uSpark, 0.35), rim * 0.45);
  // and round it, on the page, the faint glow it throws (gone once it covers)
  float glow = exp(-max(d, 0.0) * 28.0) * (1.0 - inside) * 0.2 * smoothstep(0.0, 0.1, uGrow) * (1.0 - smoothstep(0.8, 1.0, uGrow));
  vec3 gc = mix(uShade, uLight, 0.5);
  gl_FragColor = vec4(col * alpha + gc * glow * (1.0 - alpha), alpha + glow * (1.0 - alpha));
}`;

const hex = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function createInkBall(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false });
  if (!gl) return { play: (colors, swap) => { swap(); return Promise.resolve(); }, warm() {}, get busy() { return false; } };
  // (compiled off the main thread where the browser can: a first click must not wait on it)
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
  let linked = !par, u = null;
  const ready = () => {
    if (!linked) linked = gl.getProgramParameter(pr, par.COMPLETION_STATUS_KHR);
    if (!linked) return false;
    if (!u) {
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const U = (n) => gl.getUniformLocation(pr, n);
      u = { res: U('uRes'), t: U('uT'), grow: U('uGrow'), open: U('uOpen'), maxR: U('uMaxR'), deep: U('uDeep'), shade: U('uShade'), light: U('uLight'), spark: U('uSpark') };
    }
    return true;
  };
  const whenReady = () => new Promise((done) => { const poll = () => (ready() ? done() : requestAnimationFrame(poll)); poll(); });
  const scale = Math.min(screen.width, screen.height) < 700 ? 0.45 : 0.55;
  const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = (t) => 1 - Math.pow(1 - t, 3);
  let busy = false, warmed = false;
  const size = () => {
    const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  };
  const draw = (t, g, o) => {
    gl.uniform1f(u.t, t); gl.uniform1f(u.grow, g); gl.uniform1f(u.open, o);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  /** once, while nothing is happening: its program compiled (off the main thread where the browser can) */
  function warm() {
    if (warmed) return; warmed = true;
    const go = () => { if (!ready()) setTimeout(go, 100); };
    go();
  }
  /** play it in the colours [deep, shade, light, spark]; swap() is called once it covers everything */
  async function play(colors, swap) {
    if (busy) return;
    busy = true;
    await whenReady();
    size();
    const [c0, c1, c2, c3] = colors.map(hex);
    gl.uniform3fv(u.deep, c0); gl.uniform3fv(u.shade, c1); gl.uniform3fv(u.light, c2); gl.uniform3fv(u.spark, c3);
    // (the ball must reach past the corners, ragged edge and all)
    gl.uniform1f(u.maxR, Math.hypot(canvas.width / canvas.height / 2, 0.5) * 1.25);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    canvas.classList.add('on');
    const GROW = 1.05, HOLD = 0.12, OPEN = 0.95;
    // (its own clock, a frame at most a 30th of a second on: a hitch somewhere pauses it, never skips it)
    let t = 0, prev = 0, swapped = false;
    await new Promise((done) => {
      const step = (now) => {
        t += prev ? Math.min(1 / 30, (now - prev) / 1000) : 0; prev = now;
        const g = inOut(Math.min(1, t / GROW));
        const o = t > GROW + HOLD ? out(Math.min(1, (t - GROW - HOLD) / OPEN)) : 0;
        if (!swapped && t >= GROW) { swapped = true; swap(); }
        draw(t, g, o);
        if (t < GROW + HOLD + OPEN) requestAnimationFrame(step);
        else { gl.clear(gl.COLOR_BUFFER_BIT); canvas.classList.remove('on'); busy = false; done(); }
      };
      requestAnimationFrame(step);
    });
  }
  /** (for a look at one moment of it) */
  function still(colors, g, o, t = 1) {
    if (!ready()) return false;
    size();
    const [c0, c1, c2, c3] = colors.map(hex);
    gl.uniform3fv(u.deep, c0); gl.uniform3fv(u.shade, c1); gl.uniform3fv(u.light, c2); gl.uniform3fv(u.spark, c3);
    gl.uniform1f(u.maxR, Math.hypot(canvas.width / canvas.height / 2, 0.5) * 1.25);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    canvas.classList.add('on'); draw(t, g, o);
    return true;
  }
  return { play, warm, still, get busy() { return busy; } };
}
