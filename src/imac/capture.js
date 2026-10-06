import * as THREE from 'three';

// Read-backs for the offline denoiser (tools/denoise.py): the path tracer's
// float accumulation, and two raster passes drawn with the same camera — the
// surface colour of every pixel, and its geometric normal and depth.

const SINK = 'http://127.0.0.1:5199/';

async function post(name, floats) {
  const r = await fetch(SINK + name, { method: 'POST', body: floats });
  return r.status;
}

/** The accumulated radiance, linear and before tone mapping, rows bottom-up. */
export async function captureRadiance(renderer, pathTracer, name) {
  const t = pathTracer.target;
  const buf = new Float32Array(t.width * t.height * 4);
  renderer.readRenderTargetPixels(t, 0, 0, t.width, t.height, buf);
  return post(name, buf);
}

const gbufMaterial = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying float vZ;
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vZ = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vN;
    varying float vZ;
    void main() {
      vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
      gl_FragColor = vec4(n * 0.5 + 0.5, vZ);
    }`,
  side: THREE.DoubleSide,
});

/**
 * Draw the scene with every mesh's material swapped by `pick`, into a float
 * target. With `blur`, it is drawn once for each of blur.count moments of the
 * shutter (blur.at(k) moves the camera there) and averaged, so a moving
 * frame's guides blur exactly as its path-traced light does.
 */
async function rasterPass(renderer, scene, camera, w, h, pick, name, blur = null) {
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, samples: 0 });
  const swapped = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    swapped.push([o, o.material]);
    o.material = pick(o.material);
  });
  const bg = scene.background, env = scene.environment, tm = renderer.toneMapping, cs = renderer.outputColorSpace;
  scene.background = null;
  scene.environment = null;
  renderer.toneMapping = THREE.NoToneMapping;
  const n = blur ? blur.count : 1;
  const buf = new Float32Array(w * h * 4), one = n > 1 ? new Float32Array(w * h * 4) : buf;
  for (let k = 0; k < n; k++) {
    if (blur) blur.at(k);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    if (n > 1) {
      renderer.readRenderTargetPixels(target, 0, 0, w, h, one);
      for (let i = 0; i < buf.length; i++) buf[i] += one[i] / n;
    }
  }
  for (const [o, m] of swapped) o.material = m;
  scene.background = bg;
  scene.environment = env;
  renderer.toneMapping = tm;
  renderer.outputColorSpace = cs;
  if (n === 1) renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
  target.dispose();
  return post(name, buf);
}

const albedoCache = new Map();
function albedoOf(m) {
  if (Array.isArray(m)) return m.map(albedoOf); // multi-material meshes (the shelf's darker front)
  if (!albedoCache.has(m)) {
    // colour times texture, unlit, in linear light (render targets stay linear)
    const map = m.map && m.map.isTexture && m.map.matrix ? m.map : null;
    const a = new THREE.MeshBasicMaterial({ color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), map, side: m.side ?? THREE.FrontSide });
    if (m.transmission > 0 && m.attenuationColor) a.color = m.attenuationColor.clone();
    albedoCache.set(m, a);
  }
  return albedoCache.get(m);
}

export function captureAlbedo(renderer, scene, camera, w, h, name, blur = null) {
  return rasterPass(renderer, scene, camera, w, h, albedoOf, name, blur);
}

export function captureGbuffer(renderer, scene, camera, w, h, name, blur = null) {
  return rasterPass(renderer, scene, camera, w, h, () => gbufMaterial, name, blur);
}
