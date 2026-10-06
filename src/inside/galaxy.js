// The Milky Way palette's sky: the universe behind the whole page, and the viewer flying forward through it. No
// textures loaded, all drawn: the band of the Milky Way across the sky (its warm core, its brown dust lanes, the haze of
// its countless stars) and, far off, a spiral galaxy with its golden core and dusty arms and a scatter of smaller ones,
// all far away and so still, drawn once; the nebulae we fly through, nearer and nearer, drawn small every frame (they
// are all soft light); and the stars streaming past us, sharp, every frame, over it all.
const VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const LIB = `precision highp float;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// one star per cell, kept off the cell's edges so its glow is never cut: x = brightness 0..1 (0 = none here), yz = offset
vec4 star(vec2 uv, float seed, float density) {
  vec2 id = floor(uv), g = fract(uv) - 0.5;
  float n = h21(id + seed);
  if (n > density) return vec4(0.0, 9.0, 9.0, 0.0);                          // (none: "far away")
  vec2 c = (vec2(h21(id + seed * 1.7 + 0.31), h21(id + seed * 2.3 + 0.77)) - 0.5) * 0.46;
  return vec4(pow(h21(id + seed * 3.1 + 0.13), 3.0), g - c, fract(n * 91.7));
}
`;
// the band: far away, it does not move (only its stars twinkle, in the last pass)
const BAND = LIB + `
uniform vec2 uRes;
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 b = rot(-0.38) * (p - vec2(0.05, -0.12));
  float warp = fbm(b * 1.2 + 7.0);
  float y = b.y + 0.12 * (warp - 0.5) + 0.04 * sin(b.x * 2.3);
  float band = exp(-y * y * 30.0), wide = exp(-y * y * 6.0);                 // (its body, and the faint glow round it)
  float bulge = exp(-pow((b.x + 0.25) * 1.5, 2.0)) * exp(-y * y * 20.0);      // (the core, bright, to one side)
  float glow = fbm(b * vec2(2.0, 5.0) + 11.0);
  // the dust in front of it: filaments drawn out along it, and the great rift down its middle
  float ridge = 1.0 - abs(2.0 * fbm(b * vec2(2.2, 11.0) + vec2(3.0, 0.5 * warp)) - 1.0);
  float lanes = smoothstep(0.55, 0.92, ridge) * smoothstep(0.35, 0.65, fbm(b * vec2(1.5, 4.0) + 5.0));
  float rift = (1.0 - smoothstep(0.0, 0.045, abs(y + 0.01 - 0.04 * (glow - 0.5)))) * (1.0 - smoothstep(0.15, 0.85, abs(b.x + 0.15)));
  vec3 arm = mix(vec3(0.3, 0.3, 0.4), vec3(0.86, 0.84, 0.8), smoothstep(0.35, 0.8, glow));     // (star clouds: near white)
  vec3 col = arm * (band * (0.25 + 0.75 * glow) * 0.36 + wide * 0.035);
  col += vec3(1.0, 0.76, 0.5) * bulge * (0.3 + 0.45 * glow);
  col = mix(col, col * vec3(0.5, 0.36, 0.26), clamp(lanes * band * 0.9, 0.0, 1.0));               // (the dust: brown)
  col *= 1.0 - 0.6 * lanes * band - 0.45 * rift * band;
  // the haze of its stars: many, tiny, thicker where it is bright
  for (int i = 0; i < 3; i++) {
    float s = 95.0 + 70.0 * float(i);
    vec4 st = star(b * s, float(i) * 7.3 + 2.0, 0.08 + 0.55 * band * (1.0 - 0.7 * lanes));
    float d = length(st.yz);
    col += mix(vec3(0.7, 0.75, 1.0), vec3(1.0, 0.86, 0.7), st.w) * st.x * exp(-d * d * 60.0) * (0.5 + 1.2 * band);
  }
  // red-pink glows along it, where stars are born
  float hii = smoothstep(0.68, 0.88, fbm(b * 3.2 + 21.0)) * band;
  col += vec3(0.6, 0.18, 0.3) * hii * 0.25;
  // and deep space round it, black but for the faintest blue
  col += vec3(0.006, 0.008, 0.02) * (1.2 - length(p) * 0.6);
  gl_FragColor = vec4(min(col, 1.0), 1.0);
}`;
// a spiral galaxy, face on, drawn once into a square picture of its own (the last pass lays it in, tilted, as many times
// as it likes): two log-spiral arms, ragged, with bright ridges, dust lanes on their inner edges and clumps of young blue
// stars, round a golden bulge
const SPIRAL = LIB + `
uniform vec2 uRes;
void main() {
  vec2 p = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float r = length(p), th = atan(p.y, p.x);
  float ph = th - log(max(r, 0.002)) * 1.55 + 0.8 * (fbm(p * 4.0 + 3.0) - 0.5);
  float arm = pow(0.5 + 0.5 * cos(2.0 * ph), 2.2), ridge = pow(0.5 + 0.5 * cos(2.0 * ph + 0.35), 8.0);
  float disk = exp(-r * 3.4) * (1.0 - smoothstep(0.55, 1.0, r));
  float bulge = exp(-r * r * 22.0), core = exp(-r * r * 500.0);
  float dust = pow(0.5 + 0.5 * cos(2.0 * ph - 0.75), 10.0) * smoothstep(0.06, 0.2, r) * (0.6 + 0.6 * fbm(p * 9.0));
  float clumps = smoothstep(0.55, 0.95, fbm(p * 14.0 + 7.0)) * arm;
  vec3 disc = mix(vec3(0.62, 0.72, 1.0), vec3(1.0, 0.88, 0.7), exp(-r * 6.0));
  vec3 col = disc * disk * (0.16 + 1.15 * arm + 0.8 * ridge);
  col += mix(vec3(0.55, 0.7, 1.0), vec3(0.95, 0.45, 0.7), step(0.82, h21(floor(p * 40.0)))) * clumps * disk * 0.8;
  col *= 1.0 - 0.75 * dust;
  col += vec3(1.0, 0.8, 0.55) * bulge * 1.7 + vec3(1.0, 0.96, 0.88) * core * 1.8;
  col += vec3(1.0) * pow(h21(floor(p * 180.0)), 40.0) * disk * 2.0;                     // (its stars, one by one)
  col += vec3(0.4, 0.46, 0.62) * exp(-r * r * 5.0) * 0.04;                              // (its faint halo)
  gl_FragColor = vec4(min(col * 0.5, 1.0), 1.0);
}`;
// the nebulae we fly through: two zooms an octave apart, the coarse one fading out as the fine one grows into its place
const CLOUD = LIB + `
uniform vec2 uRes; uniform float uT;
vec3 neb(vec2 p) {
  vec2 q = vec2(fbm(p * 1.5 + 1.7), fbm(p * 1.5 + 9.2));
  float n = fbm(p * 1.9 + 3.0 * q);
  vec3 c = mix(vec3(0.1, 0.22, 0.48), vec3(0.28, 0.14, 0.46), smoothstep(0.3, 0.7, q.x));
  c = mix(c, vec3(0.55, 0.22, 0.4), smoothstep(0.62, 0.85, q.y) * 0.4);
  return c * pow(n, 3.4) * 0.55;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float z = fract(uT * 0.02);
  float w = z * z * (3.0 - 2.0 * z);                                         // (the fine one in, the coarse out)
  vec3 col = neb(p * exp2(-z) + 0.3) * (1.0 - w) + neb(p * exp2(1.0 - z) + 0.3) * w;
  gl_FragColor = vec4(min(col, 1.0), 1.0);
}`;
// the stars passing us, over the two: layers from far (small, dim) to near (big, then gone past the edge of sight)
const FINAL = LIB + `
uniform vec2 uRes; uniform float uT; uniform float uLayers; uniform sampler2D uBand; uniform sampler2D uCloud; uniform sampler2D uGal;
// the spiral at c, its radius size, turned by ang and tilted away from us (incl: cos of the tilt); no branch round the
// sample (a branch round an implicit-LOD sample is run whole on every pixel anyway, and its edges alias)
vec3 galaxy(vec2 p, vec2 c, float size, float ang, float incl, float bright) {
  vec2 q = rot(ang) * (p - c); q.y /= incl;
  vec2 g = q / size * 0.5 + 0.5;
  float in1 = step(0.0, g.x) * step(0.0, g.y) * step(g.x, 1.0) * step(g.y, 1.0);
  return texture2D(uGal, g).rgb * in1 * bright;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 col = texture2D(uBand, uv).rgb + texture2D(uCloud, uv).rgb;
  // far off: one spiral near, to the lower right (clear of the words in the middle), and smaller ones further away
  float ax = uRes.x / uRes.y, k = min(1.0, ax);
  col += galaxy(p, vec2(0.3 * ax, 0.24), 0.4 * k, -0.42, 0.42, 3.0);
  col += galaxy(p, vec2(-0.36 * ax, 0.33), 0.05 * k, 1.9, 0.62, 1.6);
  col += galaxy(p, vec2(0.12 * ax, 0.41), 0.032 * k, -0.7, 0.35, 1.4);
  col += galaxy(p, vec2(-0.43 * ax, -0.37), 0.04 * k, 0.3, 0.8, 1.4);
  col += galaxy(p, vec2(0.44 * ax, -0.3), 0.026 * k, 2.6, 0.5, 1.2);
  col += galaxy(p, vec2(-0.08 * ax, -0.44), 0.022 * k, -1.4, 0.3, 1.1);
  col += galaxy(p, vec2(-0.2 * ax, 0.12), 0.018 * k, 0.9, 0.7, 1.0);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uLayers) break;
    float fi = float(i);
    float depth = fract(fi / uLayers + uT * 0.04);
    float scale = mix(26.0, 1.6, depth);
    float fade = smoothstep(0.0, 0.3, depth) * (1.0 - smoothstep(0.8, 1.0, depth));
    vec4 st = star(p * scale + fi * 37.1, fi * 13.7 + 1.0, 0.5);
    float d = length(st.yz);
    float size = (0.012 + 0.05 * st.x) * (0.5 + 1.1 * depth);
    float core = exp(-d * d / (size * size));
    float halo = st.x * size * 0.02 / (d * d + 0.002) * (1.0 - smoothstep(0.04, 0.26, d));
    // (the brightest with a faint cross, as a lens sees them)
    vec2 a = abs(st.yz);
    float cross = st.x * st.x * (exp(-a.x * 160.0) * exp(-a.y * 14.0) + exp(-a.y * 160.0) * exp(-a.x * 14.0)) * (1.0 - smoothstep(0.05, 0.26, d));
    float tw = 0.78 + 0.22 * sin(uT * (1.3 + 3.0 * st.w) + st.w * 40.0);
    vec3 tint = mix(vec3(0.66, 0.74, 1.0), vec3(1.0, 0.84, 0.66), st.w);
    col += tint * (core + halo + 0.6 * cross) * (0.25 + 0.75 * st.x) * tw * fade;
  }
  col = 1.0 - exp(-col * 1.35);                                               // (soft roll-off: no hard whites)
  gl_FragColor = vec4(col, 1.0);
}`;

const T0 = performance.now();
export function createGalaxy(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return { show() {}, hide() {}, clip() {}, on: false };
  // (compiled off the main thread where the browser can, and not drawn with until it is: no stall when it first shows)
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = sh(gl.VERTEX_SHADER, VS);
  const program = (fs) => {
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    return { pr, u: null };
  };
  const band = program(BAND), spiral = program(SPIRAL), cloud = program(CLOUD), final = program(FINAL);
  const all = [band, spiral, cloud, final];
  let linked = !par;
  const ready = () => {
    if (!linked) linked = all.every((x) => gl.getProgramParameter(x.pr, par.COMPLETION_STATUS_KHR));
    if (!linked) return false;
    for (const x of all) if (!x.u) { x.u = {}; for (const n of ['uRes', 'uT', 'uLayers', 'uBand', 'uCloud', 'uGal']) x.u[n] = gl.getUniformLocation(x.pr, n); }
    return true;
  };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const target = () => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer();
    return { tex, fb, w: 0, h: 0 };
  };
  const fit = (t, w, h) => {
    if (t.w === w && t.h === h) return false;
    t.w = w; t.h = h;
    gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    return true;
  };
  const tBand = target(), tCloud = target(), tGal = target();
  const small = Math.min(screen.width, screen.height) < 700;
  const scale = small ? 0.5 : 0.62;                     // (part resolution: it is all soft light)
  const cloudScale = 0.4;                               // (of that again, for the nebulae)
  let on = false, raf = 0;
  const pass = (prog, t, w, h, time) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.pr);
    gl.uniform2f(prog.u.uRes, w, h);
    if (prog.u.uT) gl.uniform1f(prog.u.uT, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const draw = (now) => {
    if (!on) return;
    if (!ready()) { raf = requestAnimationFrame(draw); return; }
    const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const t = (now - T0) / 1000;
    if (fit(tBand, w, h)) pass(band, tBand, w, h, t);  // (once per size: it is still)
    if (fit(tGal, 512, 512)) {                          // (once: the spiral, mipmapped, for the far small ones)
      pass(spiral, tGal, 512, 512, t);
      gl.bindTexture(gl.TEXTURE_2D, tGal.tex); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    const cw = Math.max(2, Math.round(w * cloudScale)), ch = Math.max(2, Math.round(h * cloudScale));
    fit(tCloud, cw, ch);
    pass(cloud, tCloud, cw, ch, t);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tBand.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tCloud.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tGal.tex);
    gl.useProgram(final.pr); gl.uniform1i(final.u.uBand, 0); gl.uniform1i(final.u.uCloud, 1); gl.uniform1i(final.u.uGal, 2);
    gl.uniform1f(final.u.uLayers, small ? 4 : 6);
    pass(final, null, w, h, t);
    raf = requestAnimationFrame(draw);
  };
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden && on) raf = requestAnimationFrame(draw); });
  let clipped = '', warmed = false;
  return {
    /** once, while nothing is happening: its programs compiled (off the main thread where the browser can) */
    warm() {
      if (warmed) return; warmed = true;
      const go = () => { if (!ready()) setTimeout(go, 100); };
      go();
    },
    show() { if (on) return; on = true; raf = requestAnimationFrame(draw); },
    hide() { on = false; cancelAnimationFrame(raf); },
    /** where it shows: all of it (r = null), or round the window r = {l, t, r, b} (the 3D shows through that) */
    clip(r) {
      const W = innerWidth, H = innerHeight;
      const v = r ? `path(evenodd, 'M0 0H${W}V${H}H0Z M${r.l.toFixed(1)} ${r.t.toFixed(1)}H${(W - r.r).toFixed(1)}V${(H - r.b).toFixed(1)}H${r.l.toFixed(1)}Z')` : '';
      if (v !== clipped) { clipped = v; canvas.style.clipPath = v; }
    },
    get on() { return on; },
  };
}
