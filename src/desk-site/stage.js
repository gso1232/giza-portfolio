// The live desk: the two rendered pictures (the room in its shade, and the room in the
// late-afternoon sun) drawn by one small WebGL shader that
//  - lets the sunlight breathe a little, as thin cloud passes (no painted shadows: every
//    shadow in the picture is the render's own);
//  - lifts the sunlit air (marched through the room's real shadows) and lets dust drift
//    and glint in it, at three depths, only where the air there is in the sun;
//  - nudges the plants a few pixels back and forth where the leaves mask says, the
//    breeze through the open window;
// and fits the picture to the screen like object-fit: cover. For the dive into the laptop it
// stills all that and draws the dive's video instead, fitted the same way.

const VS = `attribute vec2 p; varying vec2 vUv;
void main() { vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `precision highp float;
varying vec2 vUv;
uniform sampler2D unlit, lit, leaves, beam, slices;
uniform vec4 cover;      // image uv = vUv * cover.xy + cover.zw
uniform float t, aspect, px;   // px: device pixels per CSS pixel
uniform vec2 amp;        // how far the leaves move, in image uv
uniform float calm;      // 0: the live room; 1: still (no breeze, haze or dust), for the dive's video
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// a slow random walk, the way a speck hangs in still air
vec2 wander(float h, float t) {
  return vec2(sin(t * (0.11 + 0.07 * h) + h * 31.0) + 0.5 * sin(t * (0.23 + 0.05 * h) + h * 17.0),
              cos(t * (0.09 + 0.06 * h) + h * 23.0) + 0.5 * cos(t * (0.19 + 0.04 * h) + h * 11.0)) / 1.5;
}
// one layer of dust: specks on a grid of 'cell' CSS px, a few of them present, each of
// radius r0..r1 px (soft when out of focus), wandering and turning (so they glint)
float specks(vec2 fc, float cell, float chance, float r0, float r1, float drift, float seed) {
  vec2 q = fc / (cell * px) + vec2(t * drift * 0.6, t * drift);        // the air rises gently in the warm light
  vec2 id = floor(q), f = fract(q);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {      // neighbours too, so a speck can wander over the cell edge
    vec2 o = vec2(float(i), float(j));
    float h = hash(id + o + seed), h2 = hash(id.yx + o * 1.7 + seed * 3.1);
    if (h > chance) continue;
    vec2 pos = o + 0.5 + 0.45 * wander(h2, t);
    float r = mix(r0, r1, h2) / cell;
    float dd = length(f - pos);
    float disc = r1 > 3.0 ? smoothstep(r, r * 0.55, dd) * 0.5 + smoothstep(r * 0.6, 0.0, dd) * 0.5   // bokeh: a soft disc
                          : smoothstep(r, 0.0, dd);                                                    // in focus: a point
    float glint = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (0.5 + 1.3 * h2) + h * 60.0), 6.0);          // a flake turning to the sun
    float bright = 0.2 + 0.8 * pow(hash(id + o + seed * 5.3), 3.0);                                 // most specks dim, a few bright
    acc += disc * glint * bright;
  }
  return acc;
}
void main() {
  vec2 uv = vUv * cover.xy + cover.zw;
  // the breeze: slow gusts, each leaf's own flutter from where it is
  float m = texture2D(leaves, uv).r;
  float gust = 0.55 + 0.45 * sin(t * 0.37) * sin(t * 0.21 + 1.7);
  vec2 d = vec2(sin(t * 1.9 + uv.y * 57.0 + uv.x * 13.0) + 0.6 * sin(t * 3.1 + uv.x * 91.0),
                0.7 * sin(t * 2.3 + uv.x * 71.0) + 0.4 * sin(t * 1.3 + uv.y * 33.0));
  vec2 suv = uv + d * m * amp * gust * (1.0 - calm);
  vec3 a = texture2D(unlit, suv).rgb;
  vec3 b = texture2D(lit, suv).rgb;
  // the sun breathes a little, as thin cloud passes (no painted shadows: all are the render's)
  float open = 1.0 - (1.0 - calm) * (0.06 - 0.06 * sin(t * 0.13) * sin(t * 0.071 + 2.0));
  vec3 col = mix(a, b, open);
  float live = (1.0 - calm) * open;
  // the lit air: how much sunlit haze each ray passes through, marched through the room's real
  // shadows (desk-render.js beamPass): the beam's edges are where the window's transom and
  // the shelf cut the light
  float haze = texture2D(beam, uv).r;
  col = 1.0 - (1.0 - col) * (1.0 - haze * vec3(1.0, 0.8, 0.55) * 0.22 * live);
  // dust, as in the farmhouse light of Interstellar: specks at three depths, each shown only
  // where the air at that depth is in the sun (slices: r near, g mid, b far)
  vec3 inSun = texture2D(slices, uv).rgb;
  vec2 fc = gl_FragCoord.xy;
  float far  = specks(fc, 9.0, 0.32, 0.45, 1.0, 0.010, 1.0) * inSun.b;
  float mid  = specks(fc, 17.0, 0.3, 0.7, 1.7, 0.016, 7.0) * inSun.g;
  float near = specks(fc, 46.0, 0.16, 4.0, 9.0, 0.028, 13.0) * inSun.r;   // out of focus, big and faint
  float dust = far * 0.7 + mid * 1.0 + near * 0.22;
  col += dust * vec3(1.0, 0.9, 0.72) * 0.9 * live;
  gl_FragColor = vec4(col, 1.0);
}`;

const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => i.decode().then(() => ok(i), () => ok(i)); i.onerror = fail; i.src = src; });

// A 1 x 1 black picture: the layers the Blender render doesn't need (it has its own air, and its
// life comes as a rendered loop, not painted over a still)
const BLACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export async function createStage(canvas, { unlit, lit = unlit, leaves = BLACK, beam = BLACK, slices = BLACK, aspect = 16 / 9, focusX = 0.5, still = false }) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const [imA, imB, imL, imS, imD] = await Promise.all([load(unlit), load(lit), load(leaves), load(beam), load(slices)]);
  const tex = (unit, src, repeat = false) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const pot = (n) => (n & (n - 1)) === 0;
    const mip = pot(src.width) && pot(src.height);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat && mip ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  };
  const texA = tex(0, imA), texB = tex(1, imB); tex(2, imL); tex(3, imS); tex(4, imD);
  // the dive's video goes in a texture of its own, bound in place of both pictures while it plays
  const texV = gl.createTexture();
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, texV);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  ['unlit', 'lit', 'leaves', 'beam', 'slices'].forEach((n, i) => gl.uniform1i(gl.getUniformLocation(prog, n), i));
  const uCover = gl.getUniformLocation(prog, 'cover'), uT = gl.getUniformLocation(prog, 't'), uAmp = gl.getUniformLocation(prog, 'amp');
  gl.uniform1f(gl.getUniformLocation(prog, 'aspect'), aspect);
  gl.uniform2f(uAmp, 5 / imA.width, 5 / imA.height);
  const uCalm = gl.getUniformLocation(prog, 'calm'), uPx = gl.getUniformLocation(prog, 'px');
  // still: the picture as rendered, nothing painted over it (the Blender stills)
  let calm = still ? 1 : 0, calmTo = calm, video = null;

  // object-fit: cover, and where the picture sits on the screen (for the laptop's live screen)
  const fit = { scale: 1, x: 0, y: 0 };
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gl.uniform1f(uPx, dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    const va = w / h;
    let sx = 1, sy = 1, ox = 0, oy = 0;
    if (va > aspect) { sy = aspect / va; oy = (1 - sy) / 2; }
    else { sx = va / aspect; ox = Math.min(Math.max(focusX - sx / 2, 0), 1 - sx); }   // centred on focusX, within the picture
    gl.uniform4f(uCover, sx, sy, ox, oy);
    // image uv (u, v) -> screen px: ((u - ox) / sx * w, (v - oy) / sy * h)
    Object.assign(fit, { sx, sy, ox, oy, w, h });
  }
  resize();
  addEventListener('resize', resize);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  const t0 = performance.now();
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    calm += Math.sign(calmTo - calm) * Math.min(Math.abs(calmTo - calm), dt / 0.35);   // eases over 0.35 s
    gl.uniform1f(uCalm, calm);
    gl.uniform1f(uT, reduced ? 0 : (now - t0) / 1000);
    if (video && video.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, texV);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      for (const unit of [0, 1]) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texV); }
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    fit,
    toScreen: ([u, v]) => [((u - fit.ox) / fit.sx) * fit.w, ((v - fit.oy) / fit.sy) * fit.h],
    canvas,
    stop: () => cancelAnimationFrame(raf),
    /** rest while the room is out of sight (inside the laptop): no frames, the loop paused */
    sleep: (on) => {
      cancelAnimationFrame(raf);
      if (on) { video?.pause(); return; }
      video?.play().catch(() => {});
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    /** still the room (1) or let it live again (0); resolves once it has settled */
    calm: (v) => { calmTo = v; return new Promise((ok) => { const w = () => (Math.abs(calm - calmTo) < 1e-3 ? ok() : requestAnimationFrame(w)); w(); }); },
    /** show a playing video in place of the pictures, or (null) go back to them */
    showVideo: (v) => {
      video = v;
      if (!v) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB); }
    },
    /**
     * The room's live loop (the rendered video): muted, looping, fetched after the still is up and
     * shown once it can play through, so the still stands in until then (its frame 0 is the still)
     */
    playLoop: (src) => {
      const v = document.createElement('video');
      Object.assign(v, { src, muted: true, loop: true, playsInline: true, preload: 'auto' });
      v.setAttribute('muted', '');
      v.addEventListener('canplaythrough', () => v.play().then(() => { video = v; }, () => {}), { once: true });
      return v;
    },
  };
}
