import * as THREE from 'three';
import { PhysicalCamera, GradientEquirectTexture, PhysicalSpotLight } from 'three-gpu-pathtracer';
import { oakTextures, plasterTexture } from './textures.js';

// The room of the reference photograph: a warm greige wall, an oak shelf, one
// big soft window light from the left, and a long lens straight on.
// Solving the shelf's perspective in the photo (the wall line 4.0 cm above the
// shelf at the bezel's plane, the front edge 3.6 cm below it) puts the camera
// 2.3 m back at 24 cm: a 12.6 degree lens, tilted down one degree.

export const SHOT = {
  camPos: new THREE.Vector3(0.09, 24, 231.5),
  target: new THREE.Vector3(0.09, 19.64, 1.5),
  frameHeightAtTarget: 50.95, // cm visible top to bottom at the bezel, from the photo
  wallZ: -47.8,      // refitted: the shelf reads deeper in the photo than first set
  shelfTop: 0,
  shelfFrontZ: 32.7,
};

export function buildSet({ aspect }) {
  const scene = new THREE.Scene();

  const env = new GradientEquirectTexture(512);
  env.topColor.set('#eeede9');
  env.bottomColor.set('#6f6558');
  env.exponent = 1.6;
  env.update();
  scene.environment = env;
  scene.background = new THREE.Color('#bdb1a6');
  scene.environmentIntensity = 0.45;

  const plaster = plasterTexture();
  plaster.repeat.set(2.5, 1.5);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 260),
    new THREE.MeshStandardMaterial({ color: '#cbc6be', map: plaster, roughness: 0.96 })
  );
  wall.position.set(0, 90, SHOT.wallZ);
  wall.receiveShadow = true;
  scene.add(wall);

  const oak = oakTextures();
  const depth = SHOT.shelfFrontZ - SHOT.wallZ;
  const shelfGeo = new THREE.BoxGeometry(420, 2.4, depth);
  const shelfMat = new THREE.MeshPhysicalMaterial({ map: oak, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.4 });
  const shelf = new THREE.Mesh(shelfGeo, shelfMat);
  // the front edge reads much darker than the top in the photo (end grain, turned away
  // from the light). A separate strip, not a material array: three-gpu-pathtracer gives
  // each merged mesh one material slot but lists every material of an array, so an
  // array shifts the materials of every mesh merged after it.
  const shelfFront = shelfMat.clone();
  shelfFront.color.multiplyScalar(0.62);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(420, 2.4), shelfFront);
  edge.position.set(0, SHOT.shelfTop - 1.2, SHOT.shelfFrontZ + 0.02);
  scene.add(edge);
  shelf.position.set(0, SHOT.shelfTop - 1.2, (SHOT.shelfFrontZ + SHOT.wallZ) / 2);
  shelf.receiveShadow = shelf.castShadow = true;
  scene.add(shelf);

  // key: a big soft source up on the left, aimed across to the right so its
  // pool lands on the right-hand wall (the photo's wall is brightest top-right,
  // the machine's left flank brightest, its shadow long to the right)
  const key = new THREE.RectAreaLight('#fffcf7', +(new URLSearchParams(location.search).get('key') ?? 16), 90, 90);
  key.position.set(-150, 100, 75);
  key.lookAt(60, 22, -46);
  scene.add(key);
  // the photograph's real key: a gridded soft source on the left aimed across
  // at the machine and the right-hand wall, falling away on the left wall
  // (fitted against the photo by tools/fit-look.mjs; the numbers live in look.json)
  const spot = new PhysicalSpotLight('#fffaf2', 0, 0, Math.PI / 7, 0.8, 2);
  spot.radius = 40;
  spot.position.set(-240, 110, 90);
  spot.target.position.set(40, 35, -20);
  scene.add(spot, spot.target);
  // a faint neutral bounce from the right so the shadow side keeps its detail
  const fill = new THREE.RectAreaLight('#f4f6ff', 0.7, 140, 100);
  fill.position.set(170, 60, 130);
  fill.lookAt(0, 16, 0);
  scene.add(fill);
  // a soft pool on the upper-right wall (the photo's brightest wall is there)
  const wallLight = new THREE.RectAreaLight('#fff8ef', 0, 120, 120);
  wallLight.position.set(40, 150, 60);
  wallLight.lookAt(60, 70, -46);
  scene.add(wallLight);

  const dist = SHOT.camPos.distanceTo(SHOT.target);
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(SHOT.frameHeightAtTarget / 2 / dist));
  const camera = new PhysicalCamera(vfov, aspect, 5, 3000);
  camera.position.copy(SHOT.camPos);
  camera.lookAt(SHOT.target);
  camera.focusDistance = dist;
  camera.fStop = 3.2;
  camera.apertureBlades = 7;

  return { scene, camera, lights: { key, fill, wall: wallLight, spot }, env, mats: { wall: wall.material, shelf: shelfMat, shelfFront } };
}
