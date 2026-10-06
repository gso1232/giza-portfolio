import * as THREE from 'three';
import { PhysicalCamera } from 'three-gpu-pathtracer';
import { plasterTexture } from '../imac/textures.js';
import { rng } from './things.js';

// The room of the desk photo, squared to it by tools/desk2-fit.py:
// centimetres, the desk top is y = 0, the wall behind the desk is z = 0 (the
// room is at +z), x runs along the wall, x = 0 under the laptop's left side.
//
// A plain white wall, a light ash desk 60 cm deep with an apron and a drawer
// on round tapered legs, the floor 75 cm down. The daylight comes from a
// window in the left wall, out of the picture, soft (an overcast sky): the
// photo's shadows are soft and fall to the right.

export const ROOM = {
  floor: -75,
  ceiling: 195,
  left: -140,
  right: 170,
  front: 420,
  desk: { x0: -92, x1: 96, depth: 68, top: 2.4, apron: 8 },        // it runs on past both edges of the photo (the user chose this look)
  window: { z0: 40, z1: 260, y0: -10, y1: 175 },       // in the left wall
};

function box(parent, w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** light ash: pale, faintly pink-beige, a fine straight grain */
function ashTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#e6cfb5'; g.fillRect(0, 0, c.width, c.height);
  const r = rng(17);
  for (let i = 0; i < 700; i++) {
    const y = r() * c.height, a = 0.02 + r() * 0.05;
    g.strokeStyle = r() < 0.6 ? `rgba(160,120,85,${a})` : `rgba(255,245,230,${a})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= c.width; x += 48) g.lineTo(x, y + Math.sin(x / (240 + r() * 90) + i) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

/** an overcast sky: bright, even, a little brighter toward the horizon */
function overcastSky(W = 1024, H = 512) {
  const data = new Float32Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    const y = Math.sin(((j + 0.5) / H - 0.5) * Math.PI);
    for (let i = 0; i < W; i++) {
      const o = (j * W + i) * 4;
      let v;
      if (y < 0) v = [0.3, 0.26, 0.22];
      else { const h = Math.pow(1 - y, 3); v = [0.55 + 0.7 * h, 0.62 + 0.45 * h, 0.78 + 0.15 * h]; }   // warm at the horizon, clear blue up high
      data[o] = v[0]; data[o + 1] = v[1]; data[o + 2] = v[2]; data[o + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function buildRoom() {
  const scene = new THREE.Scene();
  const R = ROOM, T = 14;
  const env = overcastSky();
  scene.environment = env;
  scene.background = env;

  const plaster = plasterTexture();
  plaster.repeat.set(2, 1.2);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f1f1ef', map: plaster, roughness: 0.95, name: 'wall' });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#cfc6ba', roughness: 0.8, name: 'floor' });
  const shell = new THREE.Group();
  shell.name = 'shell';
  scene.add(shell);
  const W = R.right - R.left, D = R.front, H = R.ceiling - R.floor;
  const cx = (R.left + R.right) / 2, cy = (R.floor + R.ceiling) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(cx, R.floor, D / 2);
  floor.receiveShadow = true;
  shell.add(floor);
  box(shell, W + 2 * T, T, D + 2 * T, wallMat, cx, R.ceiling + T / 2, D / 2);
  box(shell, W + 2 * T, H, T, wallMat, cx, cy, -T / 2);                     // the wall behind the desk
  box(shell, T, H, D, wallMat, R.right + T / 2, cy, D / 2);
  box(shell, W, H, T, wallMat, cx, cy, R.front + T / 2);
  // the left wall, around the window
  const w = R.window, lx = R.left - T / 2;
  box(shell, T, w.y0 - R.floor, D, wallMat, lx, (R.floor + w.y0) / 2, D / 2);
  box(shell, T, R.ceiling - w.y1, D, wallMat, lx, (w.y1 + R.ceiling) / 2, D / 2);
  box(shell, T, w.y1 - w.y0, w.z0, wallMat, lx, (w.y0 + w.y1) / 2, w.z0 / 2);
  box(shell, T, w.y1 - w.y0, D - w.z1, wallMat, lx, (w.y0 + w.y1) / 2, (w.z1 + D) / 2);

  // the window's frame in the left wall: slim bars whose shadows the low sun lays across the room
  const barMat = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.6, name: 'windowframe' });
  const wy = (w.y0 + w.y1) / 2, wzc = (w.z0 + w.z1) / 2;
  // a big modern window: its frame, and one transom high up whose shadow crosses the upper
  // wall above the prints (the user: no shadow line across the pictures or the sketchbook)
  for (const z of [w.z0 + 2, w.z1 - 2]) box(shell, 5, w.y1 - w.y0, 4, barMat, R.left - T / 2, wy, z);
  for (const y of [w.y0 + 2, 150, w.y1 - 2]) box(shell, 5, 4, w.z1 - w.z0, barMat, R.left - T / 2, y, wzc);

  // the desk: light ash, the top, an apron with a drawer and its black knob, tapered round legs
  const d = R.desk;
  const ash = ashTexture();
  ash.repeat.set((d.x1 - d.x0) / 140, 1);
  const topMat = new THREE.MeshPhysicalMaterial({ map: ash, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5, name: 'desktop' });
  const sideMat = new THREE.MeshPhysicalMaterial({ map: ash, color: '#efe3d4', roughness: 0.55, name: 'deskside' });
  const deskG = new THREE.Group();
  deskG.name = 'desk';
  scene.add(deskG);
  box(deskG, d.x1 - d.x0, d.top, d.depth, topMat, (d.x0 + d.x1) / 2, -d.top / 2, d.depth / 2);
  const ay = -d.top - d.apron / 2;
  box(deskG, d.x1 - d.x0 - 6, d.apron, 1.8, sideMat, (d.x0 + d.x1) / 2, ay, d.depth - 2.5);
  box(deskG, d.x1 - d.x0 - 6, d.apron, 1.8, sideMat, (d.x0 + d.x1) / 2, ay, 2.5);
  box(deskG, 1.8, d.apron, d.depth - 5, sideMat, d.x0 + 3, ay, d.depth / 2);
  box(deskG, 1.8, d.apron, d.depth - 5, sideMat, d.x1 - 3, ay, d.depth / 2);
  // the drawer front, a hairline gap round it, and its knob
  const gap = new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 0.9 });
  box(deskG, 46, d.apron - 1.4, 0.3, gap, 11, ay, d.depth - 1.5);
  box(deskG, 45.6, d.apron - 1.8, 0.5, sideMat, 11, ay, d.depth - 1.25);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.2, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 }));
  knob.position.set(11, ay, d.depth + 0.1);
  knob.castShadow = true;
  deskG.add(knob);
  const legH = -R.floor - d.top;
  for (const [x, z] of [[d.x0 + 4, 4], [d.x1 - 4, 4], [d.x0 + 4, d.depth - 4], [d.x1 - 4, d.depth - 4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.3, legH, 24), sideMat);
    leg.position.set(x, R.floor + legH / 2, z);
    leg.castShadow = leg.receiveShadow = true;
    deskG.add(leg);
  }

  const camera = new PhysicalCamera(20.4, 500 / 750, 2, 5e5);
  camera.fStop = 4;
  return { scene, camera, env, mats: { wall: wallMat, desk: topMat } };
}
