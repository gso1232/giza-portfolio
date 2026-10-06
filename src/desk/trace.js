import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { aerial } from '../studio/sky.js';
import { captureRadiance, captureAlbedo, captureGbuffer } from '../imac/capture.js';

// The desk scene, path traced: what the sketch lights with stand-ins (a
// directional sun, a panel over the window, a fill) comes here from the sky
// itself, whose sun disc is sampled by its brightness, so the light through the
// window, its soft-edged shadows and the bounce off the desk are all real.
//
// Before tracing, the scene is made safe for three-gpu-pathtracer:
// - a mesh with a list of materials is split into one mesh per material (the
//   tracer maps geometry groups to the wrong materials otherwise), and a mesh
//   with one material has its geometry groups cleared (see the imac props);
// - the window's glass is hidden (a sun seen through a smooth pane is a caustic
//   the tracer can't sample; the frame shows there's a window);
// - unlit materials become emissive standard ones;
// - the city gets its air: every building's colour is dimmed and a glow of sky
//   added by how far away it is (studio/sky.js aerial), in distance bands.

function splitMultiMaterial(scene) {
  const todo = [];
  scene.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) todo.push(o); });
  for (const o of todo) {
    const geo = o.geometry;
    const index = geo.index;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: index ? index.count : geo.attributes.position.count, materialIndex: 0 }];
    const byMat = new Map();
    for (const gr of groups) {
      if (!byMat.has(gr.materialIndex)) byMat.set(gr.materialIndex, []);
      byMat.get(gr.materialIndex).push(gr);
    }
    // merge the groups that share a material object (the city's four walls)
    const byObj = new Map();
    for (const [mi, grs] of byMat) {
      const m = o.material[mi];
      if (!m) continue;
      if (!byObj.has(m)) byObj.set(m, []);
      byObj.get(m).push(...grs);
    }
    for (const [m, grs] of byObj) {
      const g = new THREE.BufferGeometry();
      for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
      if (index) {
        const ids = [];
        for (const gr of grs) for (let i = gr.start; i < gr.start + gr.count; i++) ids.push(index.getX(i));
        g.setIndex(ids);
      } else {
        const ids = [];
        for (const gr of grs) for (let i = gr.start; i < gr.start + gr.count; i++) ids.push(i);
        g.setIndex(ids);
      }
      const part = new THREE.Mesh(g, m);
      part.position.copy(o.position);
      part.quaternion.copy(o.quaternion);
      part.scale.copy(o.scale);
      part.name = o.name;
      o.parent.add(part);
    }
    o.parent.remove(o);
  }
  scene.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) o.geometry.clearGroups(); });
}

function unlitToEmissive(scene) {
  scene.traverse((o) => {
    if (!o.isMesh || !o.material.isMeshBasicMaterial) return;
    const b = o.material;
    o.material = new THREE.MeshStandardMaterial({ color: '#000', emissive: b.color, emissiveMap: b.map, emissiveIntensity: 1, roughness: 1 });
  });
}

/** the city's haze: clone its materials per distance band, dimmed and glowing */
function hazeCity(scene, from, sun, skyOpts) {
  const city = scene.getObjectByName('city');
  if (!city) return;
  const edges = [0, 15000, 30000, 60000, 110000, 200000, 350000, 600000, 1e9];
  const cache = new Map();
  const at = new THREE.Vector3(), box = new THREE.Box3();
  const hazed = (m, band, dir) => {
    const key = m.uuid + ':' + band;
    if (!cache.has(key)) {
      const d = band === edges.length - 2 ? 900000 : Math.sqrt(Math.max(1, edges[band]) * edges[band + 1]);
      const { T, glow } = aerial(d, dir, sun, skyOpts);
      const c = m.clone();
      c.color = (m.color ?? new THREE.Color(1, 1, 1)).clone().multiplyScalar(T);
      c.emissive = new THREE.Color(glow[0], glow[1], glow[2]);
      c.emissiveMap = null;
      c.emissiveIntensity = 1;
      cache.set(key, c);
    }
    return cache.get(key);
  };
  city.updateMatrixWorld(true);
  const meshes = [];
  city.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    if (o.name === 'ground') continue;
    box.setFromObject(o).getCenter(at);
    const dir = at.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    let band = 0;
    while (band < edges.length - 2 && dist > edges[band + 1]) band++;
    o.material = hazed(o.material, band, new THREE.Vector3(dir.x, 0.02, dir.z).normalize());
  }
  // the ground: rebuilt as strips going away from the window, each with its own haze
  const ground = city.getObjectByName('ground');
  if (ground) {
    const y = ground.position.y;
    city.remove(ground);
    const m = ground.material;
    for (let b = 0; b < edges.length - 1; b++) {
      const z0 = from.z - Math.max(edges[b], 2000), z1 = from.z - Math.min(edges[b + 1], 2e6);
      if (z1 >= z0) continue;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(4e6, z0 - z1).rotateX(-Math.PI / 2), hazed(m, b, new THREE.Vector3(0, 0.02, -1).normalize()));
      strip.position.set(from.x, y, (z0 + z1) / 2);
      strip.name = 'ground';
      city.add(strip);
    }
  }
}

export function prepareForTrace(scene, { env, from, sun, skyOpts, hide = [] }) {
  for (const name of ['glass', ...hide]) scene.traverse((o) => { if (o.name === name) o.visible = false; });
  // drop every raster light: the sky lights the room
  const lights = [];
  scene.traverse((o) => { if (o.isLight) lights.push(o); });
  for (const l of lights) l.parent.remove(l);
  scene.environment = env;
  scene.background = env;
  scene.environmentIntensity = 1;
  scene.backgroundIntensity = 1;
  scene.fog = null;
  unlitToEmissive(scene);
  splitMultiMaterial(scene);
  hazeCity(scene, from, sun, skyOpts);
  // hidden things out of the scene altogether, so the tracer doesn't carry them
  const hidden = [];
  scene.traverse((o) => { if (!o.visible && o !== scene) hidden.push(o); });
  for (const o of hidden) o.parent?.remove(o);
}

export function makeTracer(renderer, { tex = 1024, bounces = 8, tiles = 4 } = {}) {
  const pt = new WebGLPathTracer(renderer);
  pt.textureSize.set(tex, tex);
  pt.bounces = bounces;
  pt.transmissiveBounces = 10;
  pt.filterGlossyFactor = 0.5;
  pt.minSamples = 1;
  pt.renderDelay = 0;
  pt.fadeDuration = 0;
  pt.dynamicLowRes = false;
  pt.tiles.set(tiles, tiles);
  renderer.domElement.addEventListener('webglcontextlost', () => (window.__lost = true));
  return pt;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (name, body) => (await fetch('http://127.0.0.1:5199/' + name, { method: 'POST', body })).status;

/**
 * Trace `samples`, gently (a rest after every tile for `rest` times as long as it
 * took, so the laptop stays usable), and save what tools/denoise.py needs.
 */
export async function shootHDR(renderer, scene, camera, pt, name, samples, { rest = 0.5, onProgress = () => {} } = {}) {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const t0 = performance.now();
  if (!pt.__sceneSet) { pt.setScene(scene, camera); pt.__sceneSet = true; }
  window.__timing = { setScene: Math.round(performance.now() - t0) };
  pt.updateCamera();
  pt.reset();
  const t1 = performance.now();
  const trace = async (upto) => {
    while (pt.samples < upto) {
      if (window.__lost) throw new Error('WebGL context lost at sample ' + pt.samples);
      const t = performance.now();
      pt.renderSample();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      onProgress(pt.samples);
      await sleep(Math.max(4, (performance.now() - t) * rest));
    }
  };
  await trace(Math.ceil(samples / 2));
  window.__timing.perSample = Math.round((performance.now() - t1) / pt.samples);
  const halfSamples = pt.samples;
  await captureRadiance(renderer, pt, `${name}-half.bin`);
  await trace(samples);
  await captureRadiance(renderer, pt, `${name}-full.bin`);
  const w = renderer.domElement.width, h = renderer.domElement.height;
  await captureAlbedo(renderer, scene, camera, w, h, `${name}-albedo.bin`);
  await captureGbuffer(renderer, scene, camera, w, h, `${name}-gbuf.bin`);
  const json = JSON.stringify({ w, h, exposure: renderer.toneMappingExposure, halfSamples, samples: pt.samples });
  await post(`${name}.json`, 'data:application/json;base64,' + btoa(json));
  return { halfSamples, samples: pt.samples };
}

/**
 * One frame of a camera move, traced with the camera's own motion blur: every sample
 * is taken from the pose at a random moment within the shutter (`at(k)` places the
 * camera k frames from this one), so the accumulation smears as the camera travels.
 * The denoiser's guides are blurred across the same shutter (sharp guides left ghost
 * edges in the studio's moves). Saved like shootHDR.
 */
export async function shootMoveHDR(renderer, scene, camera, pt, name, samples, at, { shutter = 0.5, rest = 0.4, onProgress = () => {} } = {}) {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  if (!pt.__sceneSet) { pt.setScene(scene, camera); pt.__sceneSet = true; }
  at(0);
  pt.updateCamera();
  pt.reset();
  const step = async (upto) => {
    while (pt.samples < upto) {
      if (window.__lost) throw new Error('WebGL context lost at sample ' + pt.samples);
      at((Math.random() - 0.5) * shutter);
      pt._pathTracer.setCamera(camera);          // move the tracer's camera without resetting what it has
      const t = performance.now();
      pt.renderSample();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      onProgress(pt.samples);
      await sleep(Math.max(4, (performance.now() - t) * rest));
    }
  };
  await step(Math.ceil(samples / 2));
  const halfSamples = pt.samples;
  await captureRadiance(renderer, pt, `${name}-half.bin`);
  await step(samples);
  await captureRadiance(renderer, pt, `${name}-full.bin`);
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const blur = { count: 12, at: (k) => at(((k + 0.5) / 12 - 0.5) * shutter) };
  await captureAlbedo(renderer, scene, camera, w, h, `${name}-albedo.bin`, blur);
  await captureGbuffer(renderer, scene, camera, w, h, `${name}-gbuf.bin`, blur);
  at(0);
  const json = JSON.stringify({ w, h, exposure: renderer.toneMappingExposure, halfSamples, samples: pt.samples });
  await post(`${name}.json`, 'data:application/json;base64,' + btoa(json));
  return { halfSamples, samples: pt.samples };
}
