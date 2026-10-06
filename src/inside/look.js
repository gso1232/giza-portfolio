// The reference's look, rebuilt from its shaders (illoca's scene material and final composite):
//  - every surface is one lit colour (their grey cream) and one shadow colour (the accent);
//    a face turned from the sun goes to half the shadow colour, a cast shadow to the shadow
//    colour itself, so there are two shades of the accent and one of cream
//  - a speckle texture (their voronoi.png, here drawn at start) is laid over every surface in
//    "overlay" at 0.5, stuck to the surface, so the grain moves with the world, like print
//  - the cast shadow's edge is broken up by the same speckle ("spray"), not a clean line
//  - over the finished frame, a static per-pixel grain in "soft light" at 0.19
import * as THREE from 'three';

/** a tileable voronoi (distance to the nearest of n x n jittered points), 0..1 */
export function voronoiTexture(size = 128, cells = 12, seed = 11) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + rnd()) / cells, (j + rnd()) / cells]);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let d = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + cells) % cells, jj = (cj + dj + cells) % cells;
      let [px, py] = pts[jj * cells + ii];
      px += Math.floor((ci + di) / cells); py += Math.floor((cj + dj) / cells);   // a neighbour across the edge: the tile repeated
      const dx = u - px, dy = v - py;
      d = Math.min(d, Math.hypot(dx, dy));
    }
    const k = Math.min(1, d * cells * 1.25);
    const o = (y * size + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = Math.round(k * 255); data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** the shared uniforms: change these and every surface follows (the palette, the grain) */
export function lookUniforms() {
  return {
    uBase: { value: new THREE.Color('#c2bab0') },
    uShadow: { value: new THREE.Color('#0248b6') },
    tNoise: { value: voronoiTexture() },
    uNoiseScale: { value: 80 },          // speckle tiles per metre (their 100 per UV unit): fine, a print's grain, not blotches
    uNoiseIntensity: { value: 0.5 },
    uSprayScale: { value: 34 },
    uDiffuse: { value: new THREE.Vector2(0.1, 0.1) },   // their threshold and smoothness
    uDropPos: { value: new THREE.Vector3(0, -50, 0) },  // where the drop of colour landed, and how far its colour has run
    uDropR: { value: 0 },
    uNight: { value: 0 },                              // dark mode: what has taken its colour goes to its night
    uNightTint: { value: new THREE.Color('#3c4a78') },
    uLmT: { value: 0.15 },                             // a baked surface is lit where its lightmap is over this
  };
}

/** a surface in the look: a Lambert material whose output is replaced by theirs. `tint`
 *  multiplies both colours (a paper a little brighter, a wood a little darker), `map` too.
 *  Two extras, both on the map's UVs (so only with a map):
 *   - `decal`: a premultiplied picture laid over the result in its own colours, unshaded but for
 *     a cast shadow, as a design tool draws its selections and grids over the page
 *   - `dress`: a second picture wiped in over the map from the left (uniforms tDress, uDress 0..1),
 *     its front a thin line of uEdge, as the reference dresses its massing in facades
 *   - `reveal`: as the reference shows its plan under the pointer (their paper shader, ported): round
 *     uHitW (world) out to uRadius, its edge broken by a Perlin noise (15 cells across the sheet),
 *     `reveal` (a detailed drawing) in uRevealTint takes the place of the map, lit and shaded as it is
 *  And with a map or without:
 *   - `baked`: the room's lightmap (on the second UVs), as the reference draws its static room: the
 *     light colour where the baked sun is over U.uLmT, the shadow colour under it, one shadow tone; a
 *     moving thing's shadow (the shadow map) still falls on it
 *   - `wet`: [base, shade] colours this surface takes where the drop's colour has run (U.uDropPos,
 *     U.uDropR), in place of the page's two tones; or 'attr': its own colour per vertex, from the
 *     geometry's `wetColor` (a merged town's baked colours) */
export function paint(U, { map = null, tint = 1, noise = 1, fine = 1, soft = 0, side = THREE.FrontSide, flat = false, alphaTest = 0, decal = null, dress = false, reveal = null, wet = null, baked = null, transparent = false, opacity = 1 } = {}) {
  const color = tint?.isColor ? tint.clone() : new THREE.Color(tint, tint, tint);
  const m = new THREE.MeshLambertMaterial({ color, map, side, alphaTest, lightMap: baked, transparent, opacity, depthWrite: !transparent });
  if (baked) baked.channel = 1;
  m.userData.look = true;
  const own = {
    tDecal: { value: decal }, tDress: { value: null }, uDress: { value: 0 }, uEdge: { value: new THREE.Color('#d9824a') },
    tReveal: { value: reveal }, uHitW: { value: new THREE.Vector3() }, uRadius: { value: 0 }, uRevealTint: { value: new THREE.Color('#f4ece0') },
    uWetBase: { value: new THREE.Color(Array.isArray(wet) ? wet[0] : '#ffffff') }, uWetShade: { value: new THREE.Color(Array.isArray(wet) ? wet[1] : '#000000') },
  };
  m.userData.uniforms = own;
  const extra = (map && (decal || dress || reveal)) || wet || baked;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uNoiseMul: { value: noise }, uFine: { value: fine }, uSoft: { value: soft } }, own);
    const defs = [decal && 'LOOK_DECAL', dress && 'LOOK_DRESS', reveal && 'LOOK_REVEAL', wet && 'LOOK_WET', wet === 'attr' && 'LOOK_WET_ATTR', baked && !flat && 'LOOK_BAKED'].filter(Boolean);
    if (extra) sh.fragmentShader = defs.map((d) => `#define ${d}\n`).join('') + sh.fragmentShader;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNrm;${wet === 'attr' ? '\nattribute vec3 wetColor;\nvarying vec3 vWetColor;' : ''}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNrm = normalize(mat3(modelMatrix) * objectNormal);${wet === 'attr' ? '\nvWetColor = wetColor;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNrm;
uniform vec3 uBase; uniform vec3 uShadow; uniform sampler2D tNoise; uniform float uNoiseScale; uniform float uNoiseIntensity; uniform float uNoiseMul; uniform float uSprayScale; uniform vec2 uDiffuse; uniform float uFine; uniform float uSoft; uniform float uLmT;
uniform sampler2D tDecal; uniform sampler2D tDress; uniform float uDress; uniform vec3 uEdge;
uniform sampler2D tReveal; uniform vec3 uHitW; uniform float uRadius; uniform vec3 uRevealTint;
#ifdef LOOK_REVEAL
// classic Perlin noise (Stefan Gustavson's), as their reveal uses
vec4 lkPermute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec2 lkFade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float lkNoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0), Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, 289.0);
  vec4 ix = Pi.xzxz, iy = Pi.yyww, fx = Pf.xzxz, fy = Pf.yyww;
  vec4 i = lkPermute(lkPermute(ix) + iy);
  vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0, gy = abs(gx) - 0.5, tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x), g10 = vec2(gx.y, gy.y), g01 = vec2(gx.z, gy.z), g11 = vec2(gx.w, gy.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x)), n10 = dot(g10, vec2(fx.y, fy.y)), n01 = dot(g01, vec2(fx.z, fy.z)), n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 f = lkFade(Pf.xy);
  vec2 nx = mix(vec2(n00, n01), vec2(n10, n11), f.x);
  return 2.3 * mix(nx.x, nx.y, f.y);
}
#endif
uniform vec3 uDropPos; uniform float uDropR; uniform vec3 uWetBase; uniform vec3 uWetShade; uniform float uNight; uniform vec3 uNightTint;
#ifdef LOOK_WET_ATTR
varying vec3 vWetColor;
#endif
vec3 lookOverlay(vec3 b, vec3 s) { return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
float lookTri(float scale) {   // the speckle, laid on the surface from the three axes
  vec3 w = pow(abs(normalize(vWorldNrm)), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 p = vWorldPos * scale;
  return texture2D(tNoise, p.yz).r * w.x + texture2D(tNoise, p.xz).r * w.y + texture2D(tNoise, p.xy).r * w.z;
}`)
      .replace('#include <opaque_fragment>', `
#ifdef LOOK_DRESS
  float dressed = 1.0 - smoothstep(uDress - 0.002, uDress + 0.002, vMapUv.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(tDress, vMapUv).rgb * diffuse, dressed);
#endif
vec3 lit = uBase * diffuseColor.rgb, shade = uShadow * diffuseColor.rgb;
#ifdef LOOK_WET
  // the drop's colour has run this far: its own two tones in place of the page's, the edge broken
  float wetD = distance(vWorldPos, uDropPos) + (texture2D(tNoise, vWorldPos.xz * 9.0 + vWorldPos.y * 5.0).r - 0.5) * 0.02;
  float wet = 1.0 - smoothstep(uDropR - 0.003, uDropR + 0.003, wetD);
  #ifdef LOOK_WET_ATTR
    vec3 wetB = vWetColor, wetS = vWetColor * 0.58;
  #else
    vec3 wetB = uWetBase, wetS = uWetShade;
  #endif
  vec3 nightK = mix(vec3(1.0), uNightTint, uNight);
  lit = mix(lit, wetB * nightK * diffuseColor.rgb, wet); shade = mix(shade, wetS * nightK * diffuseColor.rgb, wet);
#endif
#ifdef LOOK_REVEAL
  // under the pointer: the detailed drawing, in its light tint, where the sketch was (lit and shaded still)
  float rvN = lkNoise(vMapUv * 15.0) * 0.5 + 1.0;
  float rvR = uRadius + rvN * uRadius * 0.5;
  float rvK = smoothstep(rvR, rvR - uRadius * 0.1, distance(vWorldPos, uHitW)) * step(0.0001, uRadius);
  vec3 rvC = texture2D(tReveal, vMapUv).rgb;
  lit = mix(lit, rvC * uRevealTint, rvK); shade = mix(shade, rvC * uRevealTint * 0.8, rvK);
#endif
float ndl = 0.0, sh = 1.0;
#if NUM_DIR_LIGHTS > 0
  ndl = dot(normal, directionalLights[0].direction);
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow dls = directionalLightShadows[0];
    sh = receiveShadow ? getShadow(directionalShadowMap[0], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[0]) : 1.0;
  #endif
#endif
${flat ? 'ndl = 1.0;' : ''}
#ifdef LOOK_BAKED
  // their static room: one shadow colour under the baked light's threshold, the light colour over it
  float diffuse = smoothstep(uLmT - 0.012, uLmT + 0.012, texture2D(lightMap, vLightMapUv).r);
  vec3 col = mix(shade, lit, diffuse);
#else
  shade = mix(shade, lit, uSoft);   // (a model's clean white: its shade lifted toward its light)
  float diffuse = smoothstep(uDiffuse.x, uDiffuse.x + uDiffuse.y, max(ndl, 0.0));
  vec3 col = mix(shade * mix(0.5, 0.85, uSoft), lit, diffuse);
#endif
// the shadow's soft edge thresholded against the speckle: a sprayed edge
// (a sixth of the reference's: their full spray tore his arm's shadow into fringes along the arm, up close)
float spray = 0.5 + (lookTri(uSprayScale * uFine) - 0.5) * 0.15;   // (finer on a small model: its grain at its own scale)
float castLit = smoothstep(spray - 0.1, spray + 0.1, sh);
col = mix(col, min(col, shade), 1.0 - castLit);
// what is very dark in itself (hair, a beard, black frames, the stripes of a shirt) is drawn as ink,
// the darker shade, lit or not: in the two tones a dark thing would otherwise read as merely shaded
float ink = 1.0 - smoothstep(0.012, 0.06, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));   // only the truly black
col = mix(col, uShadow * 0.32, ink * 0.9);
#ifdef LOOK_WET
  col += uWetBase * 0.35 * (1.0 - smoothstep(0.0, 0.01, abs(wetD - uDropR))) * step(0.001, uDropR) * (1.0 - step(0.6, uDropR));   // its running edge, a bright rim
#endif
#ifdef LOOK_DECAL
  vec4 dc = texture2D(tDecal, vMapUv);
  col = col * (1.0 - dc.a) + dc.rgb * mix(0.62, 1.0, castLit);
#endif
#ifdef LOOK_DRESS
  float front = (1.0 - smoothstep(0.0015, 0.004, abs(vMapUv.x - uDress))) * step(0.002, uDress) * step(uDress, 0.998);
  col = mix(col, uEdge, front);
#endif
col = mix(col, lookOverlay(col, vec3(lookTri(uNoiseScale * uFine))), uNoiseIntensity * uNoiseMul);
gl_FragColor = vec4(col, diffuseColor.a);`);
  };
  // one program per variant (flat or not); the uniforms are shared objects
  m.customProgramCacheKey = () => `look-${flat ? 1 : 0}${extra ? `-${decal ? 'd' : ''}${dress ? 'w' : ''}${reveal ? 'r' : ''}${wet ? (wet === 'attr' ? 'a' : 'c') : ''}${baked ? 'b' : ''}` : ''}`;
  return m;
}

/** the final pass: the rendered frame, then their static soft-light grain */
export function createComposite(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.UnsignedByteType, colorSpace: THREE.LinearSRGBColorSpace });
  const rt2 = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.UnsignedByteType, colorSpace: THREE.LinearSRGBColorSpace });
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, tStage: { value: rt2.texture }, uRise: { value: 0 }, uNoiseStrength: { value: 0.19 }, uVignette: { value: 0.18 }, uFade: { value: 0 }, uFadeColor: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
varying vec2 vUv; uniform sampler2D tDiffuse; uniform sampler2D tStage; uniform float uRise; uniform float uNoiseStrength; uniform float uVignette; uniform float uFade; uniform vec3 uFadeColor;
float random(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 443.8975); p3 += dot(p3, p3.yzx + 19.19); return fract((p3.x + p3.y) * p3.z); }
vec3 softLight(vec3 b, vec3 s) { return mix(2.0 * b * s + b * b * (1.0 - 2.0 * s), sqrt(b) * (2.0 * s - 1.0) + 2.0 * b * (1.0 - s), step(0.5, s)); }
void main() {
  vec4 t = texture2D(tDiffuse, vUv);
  vec3 c = mix(t.rgb, uFadeColor, uFade);                         // (a fade to one colour between two scenes)
  float a = mix(t.a, 1.0, uFade);                                 // (and what has no ground stays clear: premultiplied)
  // the next scene rising from the bottom over this one, as a board slid up in front of the camera (theirs, into
  // the letter): below a rising edge, a little tilted while it moves, the next scene carried up with it
  if (uRise > 0.0) {
    float e = uRise + 0.07 * (0.5 - vUv.x) * sin(3.14159 * uRise);
    if (vUv.y < e) { vec4 s = texture2D(tStage, vec2(vUv.x, clamp(vUv.y + 1.0 - uRise, 0.0, 1.0))); c = s.rgb; a = s.a; }
  }
  float n = mix(0.1, 0.5, random(gl_FragCoord.xy));
  c = mix(c, softLight(c, vec3(n)), uNoiseStrength);
  vec2 q = vUv - 0.5; c *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(q * vec2(1.0, 0.8)) * 1.4);
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, uniforms: mat.uniforms,
    compile: () => (renderer.compileAsync ? renderer.compileAsync(scene, cam) : Promise.resolve(renderer.compile(scene, cam))),
    resize() { renderer.getDrawingBufferSize(size); rt.setSize(size.x, size.y); rt2.setSize(size.x, size.y); },
    render(sceneIn, camera) {
      mat.uniforms.uRise.value = 0;
      renderer.setRenderTarget(rt);
      renderer.render(sceneIn, camera);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
    /** one scene with the next rising over it from the bottom (rise 0..1) */
    renderRise(sceneA, camA, sceneB, camB, rise) {
      renderer.setRenderTarget(rt); renderer.render(sceneA, camA);
      renderer.setRenderTarget(rt2); renderer.render(sceneB, camB);
      renderer.setRenderTarget(null);
      mat.uniforms.uRise.value = rise;
      renderer.render(scene, cam);
    },
  };
}
