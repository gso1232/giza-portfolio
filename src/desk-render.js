import * as THREE from 'three';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import L from './desk/layout2.json';
import { buildRoom, ROOM } from './desk/room.js';
import { laptop, sheet, stickyNote, frame, bookStack, pot, basket, mugOnCoaster, plant, phone, notebook, pen, chairBack, wireBasket, trailingPlant, floatingShelf, bookRow, openSketchbook, draftingPencil, fineliner, steelRule, cable, washi, candleJar, fairyLights } from './desk/things.js';
import { printTex, sketchTex, clippingTex, screenTex, phoneTex, caseStudyTex, uiSheetTex, loadImage } from './desk/art.js';
import { phoneOnStand } from './imac/props.js';
import { prepareForTrace, makeTracer, shootHDR, shootMoveHDR } from './desk/trace.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import paintingUrl from './site/assets/painting.jpg?url';
import sondosUrl from './studio/assets/print-sondos.jpg?url';
import adhamUrl from './studio/assets/print-adham.jpg?url';
import manUrl from './site/assets/man.webp?url';

// The desk photo (src/desk/ref/desk2-ref.webp) rebuilt: every object at the
// place and size tools/desk2-layout.py found for it (src/desk/layout2.json).
// Rasterised here (a sketch, to lay over the photo); ?mode=trace renders it.
// Driven through window.__d.

const params = new URLSearchParams(location.search);
const W = +(params.get('w') ?? 500);
const H = +(params.get('h') ?? 750);
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = +(params.get('exposure') ?? 1.0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
await Promise.all(['500 20px Poppins', '700 20px Poppins', '800 20px Poppins', '500 20px Caveat', '700 20px Caveat', '500 20px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
const [painting, sondos, adham, man] = await Promise.all([paintingUrl, sondosUrl, adhamUrl, manUrl].map(loadImage));

const { scene, camera, env } = buildRoom();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(env).texture;
scene.environmentIntensity = 0.3;

// the sketch's light: soft daylight from the window in the left wall (the render
// takes it from the sky through that window)
const sun = new THREE.DirectionalLight('#ffc48a', 3.2);
sun.position.set(10, 0, 30).addScaledVector(new THREE.Vector3(0.8, -0.35, -0.5).normalize(), -400);
sun.target.position.set(10, 0, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 8;
sun.shadow.blurSamples = 16;
Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 600 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#fff1e0', '#8a7a68', 0.45));

const add = (o, [x, y, z], ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
const mid = (a, b) => (a + b) / 2;

// ---- on the wall ----------------------------------------------------------------------------------------------
const Wl = L.wall;
const onWall = (key, map, opts = {}, z = 0.3) => {
  const { x, y } = Wl[key];
  const s = sheet(x[1] - x[0], y[1] - y[0], map, opts);
  s.position.set(mid(...x), mid(...y), z);
  s.rotation.z = opts.rot ?? 0;
  s.name = `poster_${key}`;                                           // a picture the user will swap (Blender renders it as a white card)
  scene.add(s);
  // held up by washi tape over its top corners, as papers on a wall are (the user's pick)
  if (opts.tape) {
    const k = Object.keys(Wl).indexOf(key);
    for (const [cx, turn] of [[x[0] + 1.6, 0.62], [x[1] - 1.6, -0.62]]) {
      const t = washi(5.2, 1.7, opts.tape, 20 + k * 2 + (turn > 0 ? 0 : 1));
      t.position.set(cx, y[1] - 0.35, z + 0.08);
      t.rotation.z = turn + (opts.rot ?? 0);
      scene.add(t);
    }
  }
  return s;
};
// the big print on a foam board, standing a little off the wall
{
  const { x, y } = Wl.print;
  const board = new THREE.Mesh(new THREE.BoxGeometry(x[1] - x[0], y[1] - y[0], 0.5), new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.9 }));
  board.position.set(mid(...x), mid(...y), 0.25);
  board.rotation.z = 0.012;
  board.castShadow = board.receiveShadow = true;
  scene.add(board);
  onWall('print', printTex(painting, { w: 1200, h: 920, margin: 70 }), { rot: 0.012, curl: 0 }, 0.52);
}
onWall('torn', sketchTex('phone', { seed: 2 }), { torn: ['right', 'bottom'], seed: 5, rot: -0.02 });
onWall('flowers', sketchTex('icons', { w: 768, h: 560, seed: 4 }), { seed: 6, rot: 0.01 }, 0.25);
onWall('portrait', printTex(adham, { w: 700, h: 620, margin: 36 }), { torn: ['right'], seed: 8 }, 0.35);
// the clipping: a magazine page, a case study of one of his sites
onWall('clipping', caseStudyTex(sondos), { seed: 9, rot: 0.01 }, 0.2);
// the sticky notes: what he is working on
const notes = [
  ['pink', '#efb8d3', 'UI / UX', ['hero anim', 'dark mode', 'a11y']],
  ['blue', '#a9c9ea', 'DEV', ['deploy v2', 'fix #12', 'LCP < 2s']],
  ['orange', '#f6b8a0', 'IDEAS', ['live desk', 'dive in', 'ship it']],
];
notes.forEach(([key, color, title, lines], i) => {
  const { x, y } = Wl[key];
  const n = stickyNote(color, title, lines, { seed: 11 + i });
  n.scale.setScalar(((x[1] - x[0]) + (y[1] - y[0])) / 2 / 7.6);
  n.position.set(mid(...x), mid(...y), 0.06);
  n.rotation.z = [0.01, -0.012, 0.018][i];
  scene.add(n);
});

// ---- on the desk ------------------------------------------------------------------------------------------------
const Dk = L.desk;
// the laptop, where the fit found it, a page of his work on it
const lapFit = L.fit.laptop;
const lap = add(laptop({ screenMap: screenTex([sondos, painting, adham, man, sondos, painting]), lidAngle: lapFit.lidAngle }), lapFit.backLeft, Math.atan2(-lapFit.hingeDir[2], lapFit.hingeDir[0]));
// left: the ZZ plant in its white pot, another pot at the edge, a basket planter on two books
// (each pot and book a centimetre or so clear of the next: the user saw them fused, "not real")
// (the group sits 3 cm further left than the photo's, so the laptop hides less of the basket:
// the user's call)
const zzPot = add(pot({ r0: 5.2, r1: 6.2, h: 12.3 }), [-26.5, 0, 7.2]);
const zz = add(plant('zz', { seed: 5, stems: 12, height: 31, spread: 0.55, leafSize: 5.2, wall: -7.2 }), [-26.5, zzPot.userData.top, 7.2]);
const lpot = add(pot({ r0: 5.4, r1: 6.4, h: 12.9 }), [-40.7, 0, 7.4]);
const plantsExtra = [add(plant('zz', { seed: 9, stems: 7, height: 26, spread: 0.5, leafSize: 5.0, wall: -7.4 }), [-40.7, lpot.userData.top, 7.4])];
// the basket's two books lie with their page edges to the room, as in the photo (their spines
// to the camera made them read as boxes)
// (the dark one below turned round, so its spine shows: the photo's dark book under a light one)
add(bookStack([{ w: 14, d: 11, t: 3.1, color: '#2f3b4a', turn: Math.PI }, { w: 12.5, d: 10.5, t: 2.8, color: '#e9e4da' }], 3), [-11.5, 0, 6.5], Math.PI + 0.1);
const bsk = add(basket({ r0: 4.4, r1: 5.4, h: 12.8 }), [-12.5, 5.9, 6.8]);
// in it a golden pothos, as the photo's is: vines over the basket's rim, down onto the books and
// along the desk (the user: "more real"). In its own coordinates the books' tops are 11.8 and
// 14.6 below it, the desk 17.7; none of its vines go left, into the ZZ's pot
// (and where the sketchbook's back corner reaches in, its pages: 16 below)
const inSketchbook = (x, z) => 13.37 * (z - 7.64) - 28.7 * (x + 0.78) > 0 && 0.42 * (x + 0.78) + 0.91 * (z - 7.64) > 0;
const onBooks = (x, z) => (x > -5.2 && x < 7.2 && z > -5.5 && z < 4.9 ? -11.8 : x > -6 && x < 8 && z > -5.8 && z < 5.2 ? -14.6 : inSketchbook(x, z) ? -16 : -17.7);
const pothos = add(trailingPlant({ seed: 12, vines: 7, drop: 24, leafSize: 3.9, floor: onBooks, wall: -6.8, arc: [-0.9, 1.0], pot: { r0: 4.4, r1: 5.4, h: 12.8 } }), [-12.5, 5.9 + bsk.userData.top, 6.8]);
// on the left wall, above and left of the plants (the user's choice, to fill the empty
// wall): a floating oak shelf with a row of books and a pothos trailing over its edge
const shelf = add(floatingShelf({ w: 46, d: 18 }), [-67, 33, 0]);
// five real books of his three trades, the titles set on their spines in my own type
add(bookRow([
  { h: 23.5, t: 3.4, d: 16, color: '#e9e3d6', ink: '#1e1e1e', title: "DON'T MAKE ME THINK", author: 'KRUG' },
  { h: 21.5, t: 2.8, d: 14.5, color: '#b7322c', ink: '#f5efe6', title: 'THE DESIGN OF EVERYDAY THINGS', author: 'NORMAN' },
  { h: 24, t: 2.4, d: 17, color: '#1f2a44', ink: '#f2eee6', title: 'REFACTORING UI', author: 'WATHAN Â· SCHOGER' },
  { h: 23, t: 3.0, d: 15.5, color: '#2e3a2f', ink: '#efe9dc', title: 'CLEAN CODE', author: 'MARTIN' },
  { h: 23.5, t: 3.6, d: 16, color: '#d8c7a6', ink: '#2a2420', title: 'THE PRAGMATIC PROGRAMMER', author: 'HUNT Â· THOMAS' },
], { lean: 0.2 }), [-88, 33, 1]);
const shelfPot = add(pot({ r0: 4.2, r1: 5.2, h: 9 }), [-55, 33, 8.5]);
// its vines lie along the shelf and fall only over its edges (they went through the board);
// in the plant's own coordinates the shelf's top is 7.5 below it and it stands 8.5 off the wall
const onShelf = (x, z) => (x > -35 && x < 11 && z > -8.5 && z < 9.5 ? -7.5 : -Infinity);
const hanging = add(trailingPlant({ seed: 8, vines: 10, drop: 30, leafSize: 3.3, floor: onShelf, wall: -8.5, pot: { r0: 4.2, r1: 5.2, h: 9, rim: 1.5 } }), [-55, 33 + shelfPot.userData.top, 8.5]);
// warm fairy lights hung in swags along the shelf's front edge (the user's pick, for a cozy room)
add(fairyLights([-89, -78, -67, -56, -45].map((x) => new THREE.Vector3(x, 33.2, 18.3)), { sag: 3.5, step: 3.4 }), [0, 0, 0]);
// the open sketchbook where he works out how the site is built (the user's word: it
// replaces the photo's notebook and phone), the two pens beside it
{
  const d = new THREE.Vector2(Dk.notebookRB[0] - Dk.notebookRF[0], Dk.notebookRB[2] - Dk.notebookRF[2]).normalize();
  const ry = Math.atan2(-d.x, -d.y);
  const sb = openSketchbook({ w: 38, d: 26 });
  sb.position.set((Dk.notebookRF[0] + Dk.notebookRB[0]) / 2 - 16 * Math.cos(ry), 0, (Dk.notebookRF[2] + Dk.notebookRB[2]) / 2 + 16 * Math.sin(ry) + 3);
  sb.rotation.y = ry;
  scene.add(sb);
  // the pens lie on the desk in front of it, so they don't cover the drawings
  // an engineer's tools in front of it: a drafting pencil and a fineliner (the steel rule
  // went: it lay hidden behind the pencil, the user said)
  add(draftingPencil(), [-31.5, 0, 63.2], 0.18);                  // laid parallel, apart
  add(fineliner(), [-30, 0, 65.4], 0.18);
}
// right: the print leaning on the wall, the books stacked in front of it behind the laptop,
// the phone on its stand (where the photo has a plant in a jar: the user's choice), the
// big frame, the little glass frame, the mug on its coaster
{
  const tl = L.tops.whitePrintTL, tr = L.tops.whitePrintTR;
  // a print on a white mat, mounted on a stiff board, hung flat on the wall. It ends 10 cm
  // above the desk, as in the photo (its bottom edge, y 357 of 750, projected onto the wall
  // through the photo's camera), not down on the desk
  const bottom = 10;
  const w = tr[0] - tl[0] + 0.6, h = tl[1] + 0.4 - bottom;
  const pr = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.9 }));
  board.position.set(0, h / 2, 0.2);
  pr.add(board);
  const pic = sheet(w, h, printTex(sondos, { w: 600, h: Math.round((600 * h) / w), margin: 60 }), { curl: 0 });
  pic.position.set(0, h / 2, 0.42);
  pic.name = 'poster_tall';
  pr.add(pic);
  add(pr, [mid(tl[0], tr[0]), bottom, 0.1]);
}
// the books: lying flat right behind the laptop, square to it, their page edges to the
// room and spines to the wall, as in the photo; their right ends stick out past the lid
add(bookStack([{ w: 21, d: 15, t: 2.6, color: '#cfc4b2' }, { w: 19.5, d: 14, t: 2.0, color: '#5b4a3d' }, { w: 20, d: 14.5, t: 2.8, color: '#e3dccf' }, { w: 18.5, d: 13.5, t: 1.8, color: '#8f7b66' }, { w: 19, d: 14, t: 2.4, color: '#b7ab99' }], 5), [25.5, 0, 24.3], Math.PI - 0.129);
// (15 cm right of the photo's place: from the camera the tea's steam rose straight in front of it)
const stand = add(phoneOnStand({ screenMap: phoneTex([sondos, painting, adham, man]) }), [57, 0, 25], 0.15);
stand.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
{
  const x0 = L.tops.bigFrameTL[0];
    // the big frame: a printed UI sheet of his mobile portfolio, with redlines
  const fr = add(frame(27, 34, uiSheetTex([sondos, painting, adham, man]), { moulding: 1.0, depth: 1.8, mat: 3.2, lean: 0.42 }), [x0 + 13.5, 0, 17.5]);
  fr.getObjectByName('picture').name = 'poster_frame';
}
add(mugOnCoaster(), [Dk.coaster[0], 0, Dk.coaster[2]], -0.35);
// a candle, lit, in an amber tumbler (the user's pick): by the laptop's front right corner, beside the
// tea (left of the laptop, the lid hid its flame from the camera and the sketchbook left no room)
const candle = add(candleJar({ r: 3.0, h: 7.5 }), [40.5, 0, 60]);
candle.name = 'candle';
// the laptop's charger (the user's pick): from the port on its right side, down onto the desk,
// between the laptop and the mug, behind the mug and along the desk, over its right end to the floor
{
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const port = V(34.85, 0.8, 43.23), out = V(0.9916, 0, 0.129);
  const pts = [port, port.clone().addScaledVector(out, 3.0), V(39.6, 0.19, 43.6), V(42.6, 0.19, 40.6), V(47, 0.19, 37.2), V(56, 0.19, 36.4), V(68, 0.19, 38.8), V(84, 0.19, 42), V(95.2, 0.19, 43), V(96.7, -0.6, 43.2), V(97.6, -9, 43.3), V(97.9, -32, 43.4)];
  add(cable(pts, { into: out.clone().negate() }), [0, 0, 0]);
}
// in front: the chair's back, a white throw on it, a wire basket under the desk
// the chair back: its top edge where the photo has it (2 cm above the desk top, 90 cm out)
// (the whole chair: a phone's taller frame sees its seat and legs; the strips end at the seat)
// (built but left out of the room: the user took it out of both framings)
const chair = chairBack({ width: 60, height: 15.5, radius: 44, frameAt: 0.74, frameDrop: 31, floorY: ROOM.floor + 6 });
add(wireBasket({ w: 30, d: 30, h: 60 }), [66, ROOM.floor, 100]);

// ---- the camera: the photo's (tools/desk2-fit.py) --------------------------------------------------------------
const VIEWS = { photo: { pos: L.fit.camera, fwd: L.fit.forward, up: L.fit.up, vfov: L.fit.vfov, aspect: 500 / 750 } };
// desktop: the same camera, wider (29 deg across) and tilted up 2.6 deg, so the whole desk
// shows with the wall either side (the user chose this one, from the first test render)
{
  const f = new THREE.Vector3(...L.fit.forward), side = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const fu = f.clone().applyAxisAngle(side, THREE.MathUtils.degToRad(2.6));
  const hfov = 29, vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov / 2)) / (16 / 9)));
  VIEWS.desktop = { pos: L.fit.camera, fwd: fu.toArray(), up: L.fit.up, vfov, aspect: 16 / 9 };
}
// wide: the user's framing after the first live site: nearer the laptop (for the dive),
// the laptop in the middle, and a 2.13:1 master (3840 x 1800) so a wide screen sees the
// whole of it and a 16:9 one crops only bare wall and desk at the sides
function wideView({ k = 0.35, target = [16, 24, 18], hfov = 56, aspect = 3840 / 1800 } = {}) {
  const C = new THREE.Vector3(...L.fit.camera), T = new THREE.Vector3(18, 14, 30);
  const pos = C.clone().lerp(T, k);
  const fwd = new THREE.Vector3(...target).sub(pos).normalize();
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov / 2)) / aspect));
  return { pos: pos.toArray(), fwd: fwd.toArray(), up: [0, 1, 0], vfov, aspect };
}
VIEWS.wide = wideView({ k: 0.36, hfov: 52, target: [0, 25, 20] });   // 'h', the one shown to the user
// a phone's framing: portrait, the same room from the same line of sight, the laptop low in
// the middle and the wall's prints above it (candidates for the user to choose from)
function phoneView({ k = 0.36, target = [14, 32, 22], vfov = 60, aspect = 1080 / 2340, lift = 0, pos: at = null } = {}) {
  const C = new THREE.Vector3(...L.fit.camera), T = new THREE.Vector3(18, 14, 30);
  const pos = at ? new THREE.Vector3(...at) : C.clone().lerp(T, k);          // or a place of its own (a higher one sees more desk)
  pos.y += lift;
  const fwd = new THREE.Vector3(...target).sub(pos).normalize();
  return { pos: pos.toArray(), fwd: fwd.toArray(), up: [0, 1, 0], vfov, aspect };
}
// the dive: from 'wide' into the laptop's display, t = 0..1. The camera travels on an
// ease-in-out, turning early toward the screen, and ends square on to the display, just
// close enough that the display is a little wider than the frame, so the site can take
// over the whole screen from that last frame.
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);          // smootherstep
function divePose(t) {
  const v = VIEWS.wide;
  const d = lap.getObjectByName('display');
  d.updateMatrixWorld(true);
  const c = new THREE.Vector3().setFromMatrixPosition(d.matrixWorld);
  const n = new THREE.Vector3(0, 0, 1).transformDirection(d.matrixWorld);
  const upD = new THREE.Vector3(0, 1, 0).transformDirection(d.matrixWorld);
  const halfW = d.geometry.parameters.width / 2;
  const tanH = Math.tan(THREE.MathUtils.degToRad(v.vfov / 2)) * v.aspect;
  const end = c.clone().addScaledVector(n, (halfW / tanH) * 0.96);
  const P0 = new THREE.Vector3(...v.pos), F0 = new THREE.Vector3(...v.fwd);
  const T0 = P0.clone().addScaledVector(F0, P0.distanceTo(c));        // where 'wide' looks, as far away as the screen
  const e = smooth(t), eAim = smooth(Math.min(1, t * 1.35));          // the aim settles on the screen a little early
  const pos = P0.clone().lerp(end, e);
  pos.y += Math.sin(Math.PI * e) * 2.5;                               // a slight rise over the keyboard, as a hand-held move would
  const tgt = T0.clone().lerp(c, eAim);
  const up = new THREE.Vector3(...v.up).lerp(upD, e).normalize();
  return { pos: pos.toArray(), fwd: tgt.sub(pos).normalize().toArray(), up: up.toArray(), vfov: v.vfov, aspect: v.aspect };
}
function setView(name, { aspect } = {}) {
  const v = typeof name === 'string' ? VIEWS[name] : name;
  camera.position.set(...v.pos);
  camera.up.set(...v.up);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(...v.fwd)));
  camera.fov = v.vfov;
  camera.aspect = aspect ?? v.aspect;
  camera.focusDistance = camera.position.distanceTo(new THREE.Vector3(18, 12, 30));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
function setViewport(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
async function post(name, body) { return (await fetch('http://127.0.0.1:5199/' + name, { method: 'POST', body })).status; }
async function shoot(name) {
  // shaders may still be compiling on the first frames: render until the picture is not black
  for (let i = 0; i < 20; i++) { renderer.render(scene, camera); const px = new Uint8Array(4), gl = renderer.getContext(); gl.readPixels(renderer.domElement.width >> 1, renderer.domElement.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] > 0) break; await new Promise((r) => setTimeout(r, 250)); }
  return post(name, renderer.domElement.toDataURL('image/jpeg', 0.93));
}

// ?mode=trace: the path-traced render
let tracer = null;
// layer 'base': the room as it is, lit by the window's daylight (and the screen);
// layer 'sun': only a low sun through a gap in the window's blinds, which lays a
// bright patch with the window bar's shadow on the right-hand wall. The site adds
// the two (tools/desk-layers.py) and moves leaf shadows over the patch.
export const SUN_DIR = new THREE.Vector3(0.8, -0.35, -0.5).normalize();   // the way its light travels: 20 deg up, from the window at the left, late afternoon
async function ensureTracer(layer, tiles) {
  if (tracer) return;
  prepareForTrace(scene, { env, from: new THREE.Vector3(...L.fit.camera), sun: new THREE.Vector3(0, 1, 0), skyOpts: {}, hide: ['frameGlass'] });
  const w = ROOM.window;
  if (layer === 'base') {
    // the daylight through the window in the left wall: the sky seen through it, as a soft
    // panel light filling the opening (the tracer samples it directly, so it converges fast)
    const day = new THREE.RectAreaLight('#ffe4c8', +(params.get('window') ?? 2.4), w.z1 - w.z0, w.y1 - w.y0);
    day.position.set(ROOM.left + 0.5, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2);
    day.lookAt(0, (w.y0 + w.y1) / 2 - 30, (w.z0 + w.z1) / 2 - 40);
    scene.add(day);
  } else {
    // no sky, no screen: only the sun
    const black = new THREE.DataTexture(new Float32Array([0, 0, 0, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    black.mapping = THREE.EquirectangularReflectionMapping;
    black.needsUpdate = true;
    scene.environment = black;
    scene.background = black;
    scene.traverse((o) => { if (o.isMesh && o.material?.emissiveIntensity > 0 && o.material.emissiveMap) o.material = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.2 }); });
    const sun = new THREE.DirectionalLight('#ffb36e', +(params.get('sun') ?? 7));
    sun.position.copy(SUN_DIR).multiplyScalar(-2000).add(new THREE.Vector3(0, 20, 20));
    sun.target.position.set(0, 20, 20);
    scene.add(sun, sun.target);
    // (the window's own bars, in room.js, lay their shadows across the desk and wall)
  }
  tracer = makeTracer(renderer, { tex: +(params.get('tex') ?? 1024), tiles });
}
async function traceShot(name, samples, { view = 'photo', w = 1000, h = 1500, tiles = 2, rest = 0.5, exposure = 1.0, layer = 'base' } = {}) {
  await ensureTracer(layer, tiles);
  renderer.toneMappingExposure = exposure;
  setViewport(w, h);
  setView(view, { aspect: w / h });
  tracer.tiles.set(tiles, tiles);
  const t0 = performance.now();
  const out = await shootHDR(renderer, scene, camera, tracer, name, samples, { rest, onProgress: (n) => (window.__progress = n) });
  await post(`${name}-canvas.jpg`, renderer.domElement.toDataURL('image/jpeg', 0.93));
  return { ...out, seconds: Math.round((performance.now() - t0) / 1000) };
}

async function traceDiveFrame(name, f, frames, samples, { w = 1920, h = 900, tiles = 2, rest = 0.4, layer = 'base' } = {}) {
  await ensureTracer(layer, tiles);
  setViewport(w, h);
  tracer.tiles.set(tiles, tiles);
  const at = (k) => setView(divePose(Math.min(1, Math.max(0, (f + k) / frames))), { aspect: w / h });
  const t0 = performance.now();
  const out = await shootMoveHDR(renderer, scene, camera, tracer, name, samples, at, { rest, onProgress: (n) => (window.__progress = n) });
  return { ...out, seconds: Math.round((performance.now() - t0) / 1000) };
}
/** the display's corners (fractions of the frame: TL, TR, BR, BL) at every frame of the dive */
function diveCorners(frames, { w = 1920, h = 900 } = {}) {
  setViewport(w, h);
  const d = lap.getObjectByName('display');
  const p = d.geometry.parameters;
  const out = [];
  for (let f = 0; f <= frames; f++) {
    setView(divePose(f / frames), { aspect: w / h });
    d.updateMatrixWorld(true);
    out.push([[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => {
      const v = new THREE.Vector3((sx * p.width) / 2, (sy * p.height) / 2, 0).applyMatrix4(d.matrixWorld).project(camera);
      return [+((v.x + 1) / 2).toFixed(5), +((1 - v.y) / 2).toFixed(5)];
    }));
  }
  return out;
}

/**
 * The sunbeams in the air, computed the way light does it (single scattering in an even
 * haze): every camera ray is marched from the lens to the surface it hits, and at every
 * step the sun's shadow map says whether that bit of air is in the sun. So the beams come
 * in through the window's opening, are cut by the transom, and carry the real shadows of
 * the shelf and the plants. Saved as <name> (8-bit, gamma 2.2): the site lifts the air by
 * it and lets dust glint only inside it.
 */
async function beamPass(name, { view = 'wide', w = 1920, h = 900, steps = 160, density = 0.003, slices = [70, 140, 215], out = 'beam' } = {}) {
  const hidden = [];
  scene.traverse((o) => { if (o.isMesh && (o.name === 'glass' || o.name === 'frameGlass' || o.material?.transparent)) { hidden.push(o); o.visible = false; } });
  const depthTarget = (tw, th) => { const t = new THREE.WebGLRenderTarget(tw, th); t.depthTexture = new THREE.DepthTexture(tw, th, THREE.FloatType); return t; };
  // the sun's view: an orthographic camera looking along the light, from outside the room
  const dir = new THREE.Vector3(0.8, -0.35, -0.5).normalize();
  const sunCam = new THREE.OrthographicCamera(-260, 260, 220, -220, 1, 1600);
  sunCam.position.set(0, 60, 60).addScaledVector(dir, -700);
  sunCam.lookAt(0, 60, 60);
  sunCam.updateMatrixWorld(); sunCam.updateProjectionMatrix();
  const sunT = depthTarget(4096, 4096);
  const bg = scene.background; scene.background = null;
  renderer.setRenderTarget(sunT); renderer.clear(); renderer.render(scene, sunCam);
  // the camera's depth
  setViewport(w, h); setView(view, { aspect: w / h });
  const camT = depthTarget(w, h);
  renderer.setRenderTarget(camT); renderer.clear(); renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.background = bg;
  for (const o of hidden) o.visible = true;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: {
      camDepth: { value: camT.depthTexture }, sunDepth: { value: sunT.depthTexture },
      invProj: { value: camera.projectionMatrixInverse.clone() }, camWorld: { value: camera.matrixWorld.clone() },
      sunVP: { value: new THREE.Matrix4().multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse) },
      steps: { value: steps }, density: { value: density }, slices: { value: new THREE.Vector3(...slices) }, mode: { value: out === 'slices' ? 1 : 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float;
      varying vec2 vUv;
      uniform sampler2D camDepth, sunDepth;
      uniform mat4 invProj, camWorld, sunVP;
      uniform float steps, density; uniform vec3 slices; uniform int mode;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float d = texture2D(camDepth, vUv).r;
        vec4 v = invProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w;
        vec3 end = (camWorld * vec4(v.xyz, 1.0)).xyz, start = (camWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float len = distance(start, end);
        float acc = 0.0, jitter = hash(gl_FragCoord.xy);
        for (int i = 0; i < 400; i++) {
          if (float(i) >= steps) break;
          vec3 p = mix(start, end, (float(i) + jitter) / steps);
          vec4 s = sunVP * vec4(p, 1.0);
          vec3 sc = s.xyz / s.w * 0.5 + 0.5;
          float lit = (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z <= texture2D(sunDepth, sc.xy).r + 0.0015) ? 1.0 : 0.0;
          acc += lit;
        }
        if (mode == 1) {
          // is the air in the sun at these distances along the ray (and in front of the surface)?
          vec3 ray = normalize(end - start), r = vec3(0.0);
          for (int k = 0; k < 3; k++) {
            float dk = k == 0 ? slices.x : k == 1 ? slices.y : slices.z;
            vec4 s = sunVP * vec4(start + ray * dk, 1.0);
            vec3 sc = s.xyz / s.w * 0.5 + 0.5;
            float lit = (dk < len && sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z <= texture2D(sunDepth, sc.xy).r + 0.0015) ? 1.0 : 0.0;
            if (k == 0) r.x = lit; else if (k == 1) r.y = lit; else r.z = lit;
          }
          gl_FragColor = vec4(r, 1.0);
          return;
        }
        float tau = acc / steps * len * density;
        gl_FragColor = vec4(vec3(pow(1.0 - exp(-tau), 1.0 / 2.2)), 1.0);
      }`,
  }));
  const qs = new THREE.Scene(); qs.add(quad);
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.render(qs, oc);
  renderer.toneMapping = tm;
  const url = renderer.domElement.toDataURL('image/png');
  sunT.dispose(); camT.dispose();
  return post(name, url);
}

// ---- the loop: the room's own life, rendered (after the user's reference, lutstudios.com) ------------------
// Nothing is drawn over the picture: a breeze from the window stirs the plants (and their
// shadows move with them), dust drifts through the sun, steam rises off the tea. Every
// motion runs a whole number of cycles over the loop, so the frame after the last is the first.
const TAU = Math.PI * 2;
const hash1 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// [plant, how far the whole plant leans (rad), how far its leaves flutter (deg)]
// (the shelf's pothos lies along the board, so it doesn't lean as a whole; its hanging leaves flutter)
const swayed = [[zz, 0.012, 3], [plantsExtra[0], 0.012, 3], [pothos, 0, 5], [hanging, 0, 5]];   // (both pothos trail over what they stand on, so neither leans as a whole)
for (const [p] of swayed) {
  p.userData.rest = p.rotation.clone();
  p.userData.leaves.forEach((l) => (l.userData.rest = l.quaternion.clone()));
}
const qTmp = new THREE.Quaternion(), axX = new THREE.Vector3(1, 0, 0), axY = new THREE.Vector3(0, 1, 0);
function sway(phase) {
  for (const [p, lean, flutter] of swayed) {
    const x = (p.position.x + 100) / 200;                                   // 0 at the window, 1 across the room
    // gusts in through the window: they reach the plants further right a moment later
    const gust = 0.6 + 0.4 * Math.sin(TAU * (phase - x * 0.5));
    p.rotation.z = p.userData.rest.z - lean * gust * Math.sin(TAU * (2 * phase - x));   // leaning away from the window, and back
    p.rotation.x = p.userData.rest.x + lean * 0.5 * gust * Math.sin(TAU * (3 * phase + 0.25));
    const deg = THREE.MathUtils.degToRad(flutter);
    p.userData.leaves.forEach((l, i) => {
      if (l.userData.resting) return;
      const a = hash1(i + x * 97), b = hash1(i * 3.1 + x * 57), k = 3 + Math.floor(hash1(i * 7.7 + x) * 3);   // 3 to 5 flutters a loop
      const pitch = deg * gust * (0.7 * Math.sin(TAU * (k * phase + a)) + 0.3 * Math.sin(TAU * ((k + 2) * phase + b)));
      const roll = deg * 1.3 * gust * Math.sin(TAU * ((k + 1) * phase + b));
      l.quaternion.copy(l.userData.rest).multiply(qTmp.setFromAxisAngle(axY, pitch)).multiply(qTmp.setFromAxisAngle(axX, roll));
    });
  }
  scene.updateMatrixWorld(true);
}
/** one frame of the loop, traced like the stills (the leaves moved, so the tracer's scene is rebuilt) */
async function traceLoopFrame(name, f, frames, samples, { view = 'wide', w = 1920, h = 900, tiles = 2, rest = 0.4, layer = 'base' } = {}) {
  await ensureTracer(layer, tiles);
  sway(f / frames);
  tracer.__sceneSet = false;
  return traceShot(name, samples, { view, w, h, tiles, rest, layer });
}

/**
 * The air's light at one moment of the loop, for the compositor to add: R the dust, G the
 * steam lit by the sun, B the steam lit by the room. Physical, as beamPass is: the sun's
 * shadow map says what is in the sun, the camera's depth what is in front of the surfaces.
 * - Dust: motes through the whole room, drifting on small closed paths, glinting as they
 *   turn; each gives light only where the sun reaches it, falling off with distance, and a
 *   mote near the lens spreads into a soft disc (a lens at about f/10, focused on the laptop).
 * - Steam: a plume off the tea, raymarched through a wispy density that rises through it.
 * Saved as a PNG, gamma 2.2 of (light x `scale`).
 */
async function airPass(name, { view = 'wide', w = 1920, h = 900, phase = 0, count = 7000, aperture = 0.9, dust = 1, steam = 1, scale = 4 } = {}) {
  sway(phase);
  const hidden = [];
  scene.traverse((o) => { if (o.isMesh && o.visible && (o.name === 'glass' || o.name === 'frameGlass' || o.material?.transparent)) { hidden.push(o); o.visible = false; } });
  const depthTarget = (tw, th) => { const t = new THREE.WebGLRenderTarget(tw, th); t.depthTexture = new THREE.DepthTexture(tw, th, THREE.FloatType); return t; };
  const sunCam = new THREE.OrthographicCamera(-260, 260, 220, -220, 1, 1600);
  sunCam.position.set(0, 60, 60).addScaledVector(SUN_DIR, -700);
  sunCam.lookAt(0, 60, 60);
  sunCam.updateMatrixWorld(); sunCam.updateProjectionMatrix();
  const sunT = depthTarget(4096, 4096);
  const bg = scene.background; scene.background = null;
  renderer.setRenderTarget(sunT); renderer.clear(); renderer.render(scene, sunCam);
  setViewport(w, h); setView(view, { aspect: w / h });
  const camT = depthTarget(w, h);
  renderer.setRenderTarget(camT); renderer.clear(); renderer.render(scene, camera);
  scene.background = bg;
  for (const o of hidden) o.visible = true;
  const sunVP = new THREE.Matrix4().multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse);
  const litGLSL = `
    uniform sampler2D sunDepth; uniform mat4 sunVP;
    float inSun(vec3 p) {
      vec4 s = sunVP * vec4(p, 1.0); vec3 c = s.xyz / s.w * 0.5 + 0.5;
      return (c.x > 0.0 && c.x < 1.0 && c.y > 0.0 && c.y < 1.0 && c.z <= texture2D(sunDepth, c.xy).r + 0.0015) ? 1.0 : 0.0;
    }`;
  const acc = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  const clear = renderer.getClearColor(new THREE.Color()), clearA = renderer.getClearAlpha();
  renderer.setRenderTarget(acc); renderer.setClearColor(0x000000, 0); renderer.clear();
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;                                               // the dust and the steam add up in it

  // the dust
  const r = (() => { let s = 91; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4), size = new Float32Array(count);
  const cz = camera.position.z;
  for (let i = 0; i < count; i++) {
    pos.set([-115 + r() * 230, -2 + r() * 180, 1 + r() * (cz - 12)], i * 3);
    seed.set([r(), r(), r(), r()], i * 4);
    size[i] = 0.5 + 2.8 * r() ** 3;                                      // most specks small, some big flakes
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  pg.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const pxPerUnit = h / (2 * camera.focusDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const motes = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: { sunDepth: { value: sunT.depthTexture }, sunVP: { value: sunVP }, camDepth: { value: camT.depthTexture }, phase: { value: phase }, aperture: { value: aperture }, focus: { value: camera.focusDistance }, pxPerUnit: { value: pxPerUnit }, gain: { value: dust } },
    vertexShader: `${litGLSL}
      uniform sampler2D camDepth; uniform float phase, aperture, focus, pxPerUnit, gain;
      attribute vec4 seed; attribute float size;
      varying float vI; varying float vD;
      void main() {
        float T = 6.2831853;
        vec3 p = position + vec3(
          1.6 * sin(T * (phase + seed.x)) + 0.7 * sin(T * (2.0 * phase + seed.y)),
          1.2 * sin(T * (phase + seed.z)) + 0.5 * sin(T * (3.0 * phase + seed.w)),
          1.4 * sin(T * (phase + seed.y + 0.3)) + 0.6 * sin(T * (2.0 * phase + seed.x + 0.6)));
        vec4 vp = viewMatrix * vec4(p, 1.0);
        float d = -vp.z;
        gl_Position = projectionMatrix * vp;
        vec3 ndc = gl_Position.xyz / gl_Position.w;
        float behind = ndc.z * 0.5 + 0.5 > texture2D(camDepth, ndc.xy * 0.5 + 0.5).r + 1e-6 ? 0.0 : 1.0;
        float glint = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(T * ((1.0 + floor(seed.x * 4.0)) * phase + seed.w)), 6.0);
        float coc = aperture * abs(d - focus) / d * pxPerUnit;
        vD = max(1.6, coc);
        gl_PointSize = vD + 2.0;
        vI = gain * inSun(p) * behind * glint * size * size / (d * d) * 12000.0 / (vD * vD);
      }`,
    fragmentShader: `
      varying float vI; varying float vD;
      void main() {
        float rr = length(gl_PointCoord - 0.5) * (vD + 2.0);             // pixels from the centre
        float k = vD < 2.5 ? exp(-rr * rr / (0.36 * vD * vD)) * 1.6 : smoothstep(vD * 0.5 + 0.8, vD * 0.5 - 0.8, rr) * (0.85 + 0.25 * smoothstep(0.0, vD * 0.5, rr));
        gl_FragColor = vec4(vI * k, 0.0, 0.0, 1.0);
      }`,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  }));
  const ds = new THREE.Scene(); ds.add(motes);
  renderer.render(ds, camera);

  // the steam off the tea
  const mug = new THREE.Vector3(Dk.coaster[0], 0.5 + 7.8, Dk.coaster[2]);
  const quad = (fragmentShader, uniforms) => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true }));
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sq = new THREE.Scene();
  sq.add(quad(`precision highp float;
    varying vec2 vUv;
    ${litGLSL}
    uniform sampler2D camDepth; uniform mat4 invProj, camWorld; uniform vec3 mug; uniform float phase, gain;
    float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vnoise(vec3 x) {
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
    // wisps: thin ridges of a noise that rises through the plume; two copies half a loop
    // apart, each fading out as it starts over, so the loop has no seam
    float wisps(vec3 p) {
      float a = fract(phase), b = fract(phase + 0.5), wa = 1.0 - abs(2.0 * a - 1.0), wb = 1.0 - wa;
      vec3 rise = vec3(0.0, 30.0, 0.0);
      vec3 q = p * vec3(0.42, 0.2, 0.42);
      float na = fbm(q - rise * 0.2 * a + vec3(0.0, 0.0, 0.0)), nb = fbm(q - rise * 0.2 * b + vec3(13.1, 7.7, 5.3));
      float n = ((na - 0.5) * wa + (nb - 0.5) * wb) / sqrt(wa * wa + wb * wb) + 0.5;
      float ridge = 1.0 - abs(2.0 * n - 1.0);
      return pow(ridge, 7.0) * 2.5;
    }
    float density(vec3 p) {
      vec3 q = p - mug; float hgt = q.y;
      if (hgt < 0.0 || hgt > 24.0) return 0.0;
      // the plume leans away from the window with the draught, and sways with it
      vec2 axis = vec2(0.05 * hgt + 0.002 * hgt * hgt + 0.08 * hgt * sin(6.2831853 * phase), 0.03 * hgt * sin(6.2831853 * (2.0 * phase + 0.2)));
      float rad = length(q.xz - axis), R = 1.8 + 0.14 * hgt;
      float env = smoothstep(R, R * 0.2, rad) * smoothstep(0.0, 2.0, hgt) * exp(-hgt / 6.0);
      return env * wisps(p);
    }
    void main() {
      float d = texture2D(camDepth, vUv).r;
      vec4 v = invProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w;
      vec3 end = (camWorld * vec4(v.xyz, 1.0)).xyz, start = (camWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 dir = normalize(end - start); float far = distance(start, end);
      // the plume's box
      vec3 lo = mug + vec3(-10.0, 0.0, -10.0), hi = mug + vec3(22.0, 24.0, 10.0);
      vec3 t0 = (lo - start) / dir, t1 = (hi - start) / dir;
      vec3 tn = min(t0, t1), tx = max(t0, t1);
      float a = max(max(tn.x, tn.y), tn.z), b = min(min(min(tx.x, tx.y), tx.z), far);
      if (b <= a) { gl_FragColor = vec4(0.0); return; }
      float steps = 96.0, dt = (b - a) / steps, T = 1.0; vec2 L = vec2(0.0);
      float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      for (int i = 0; i < 96; i++) {
        vec3 p = start + dir * (a + (float(i) + j) * dt);
        float s = density(p) * gain;
        if (s > 0.0) {
          L += T * s * dt * vec2(inSun(p), 1.0);
          T *= exp(-s * dt * 1.2);
        }
      }
      gl_FragColor = vec4(0.0, L.x, L.y * 0.35, 1.0);
    }`, {
    sunDepth: { value: sunT.depthTexture }, sunVP: { value: sunVP }, camDepth: { value: camT.depthTexture },
    invProj: { value: camera.projectionMatrixInverse.clone() }, camWorld: { value: camera.matrixWorld.clone() },
    mug: { value: mug }, phase: { value: phase }, gain: { value: steam * 0.15 },
  }));
  renderer.render(sq, oc);

  // out: gamma-encoded, to an 8-bit PNG
  renderer.setRenderTarget(null);
  const outQ = new THREE.Scene();
  outQ.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { acc: { value: acc.texture }, scale: { value: scale } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D acc; uniform float scale; varying vec2 vUv; void main(){ gl_FragColor = vec4(pow(clamp(texture2D(acc, vUv).rgb * scale, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0); }',
  })));
  renderer.autoClear = true;
  renderer.render(outQ, oc);
  renderer.toneMapping = tm;
  renderer.setClearColor(clear, clearA);
  const url = renderer.domElement.toDataURL('image/png');
  sunT.dispose(); camT.dispose(); acc.dispose(); pg.dispose();
  return post(name, url);
}

/**
 * The whole room for Blender (tools/blender/desk.py renders it in Cycles): every object as it is
 * here, in centimetres, as one binary glTF with its textures, posted to the sink. The plants'
 * materials are named ('leaf', 'stem') so Blender can give the leaves their translucency; the
 * raster lights stay behind (Blender lights the room itself: a sun and the sky through the window).
 */
async function exportScene(name = 'desk-scene.bin') {
  sway(0);
  const kinds = new Map([[zz, 'zz'], [plantsExtra[0], 'zz'], [pothos, 'pothos'], [hanging, 'trail']]);
  // names Blender's loop reads to move them as sway() does: pl_<key> for a plant (its lean and
  // flutter in the name), lf_<key>_<i> for its i-th leaf (_r when it rests on something)
  const keys = new Map([[zz, 'zz0'], [plantsExtra[0], 'zz1'], [pothos, 'po'], [hanging, 'tr']]);
  for (const [p, lean, flutter] of swayed) {
    const leaves = new Set(p.userData.leaves);
    p.traverse((o) => { if (o.isMesh) o.material.name = leaves.has(o) ? `leaf_${kinds.get(p)}` : 'stem'; });
    p.name = `pl_${keys.get(p)}_${lean}_${flutter}`;
    p.userData.leaves.forEach((l, i) => (l.name = `lf_${keys.get(p)}_${i}${l.userData.resting ? '_r' : ''}`));
  }
  const off = [];
  scene.traverse((o) => { if (o.isLight && o.visible) { off.push(o); o.visible = false; } });
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 4096 });
  for (const o of off) o.visible = true;
  const res = await fetch('http://127.0.0.1:5199/' + name, { method: 'POST', body: glb });
  return { bytes: glb.byteLength, status: res.status };
}
/**
 * The pictures the user will swap later, each as the image its surface is painted with, posted to
 * the sink as poster_<key>.png: Blender renders those surfaces as plain white paper and marks where
 * every point of each lies on it, so a new picture goes in afterwards without a render
 * (tools/blender/cards.py). Returns their names and sizes.
 */
async function exportPosters() {
  const out = [];
  for (const o of scene.children.flatMap((c) => { const a = []; c.traverse((x) => x.name?.startsWith('poster_') && a.push(x)); return a; })) {
    const img = o.material.map?.image;
    if (!img) continue;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    await post(`${o.name}.png`, c.toDataURL('image/png'));
    out.push([o.name, img.width, img.height]);
  }
  return out;
}
/** what Blender needs besides the objects: the cameras and the sun (in the room's centimetres) */
function sceneInfo() {
  const views = { wide: VIEWS.wide };
  return { views, sun: SUN_DIR.toArray(), room: ROOM, mug: [Dk.coaster[0], 8.3, Dk.coaster[2]], focus: [18, 12, 30] };
}

// masks for the site, rasterised from the same camera (white on black):
// 'leaves': every plant's leaves, brighter the further from its pot (how far a breeze moves it);
// 'screen': the laptop's display
const maskScene = { leaves: () => [zz, pothos, hanging, ...plantsExtra], screen: () => [lap.getObjectByName('display')] };
async function shootMask(name, kind, { view = 'desktop', w = 3840, h = 2160 } = {}) {
  setViewport(w, h);
  setView(view, { aspect: w / h });
  const keep = new Set();
  for (const root of maskScene[kind]()) root.traverse((o) => keep.add(o));
  const saved = [];
  const heightMat = (root) => {
    const base = new THREE.Box3().setFromObject(root).min.y;
    return new THREE.ShaderMaterial({
      uniforms: { base: { value: base } },
      vertexShader: 'varying float vy; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vy = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float base; varying float vy; void main(){ float k = clamp((vy - base) / 40.0, 0.15, 1.0); gl_FragColor = vec4(vec3(k), 1.0); }',
      side: THREE.DoubleSide,
    });
  };
  const black = new THREE.MeshBasicMaterial({ color: '#000' });
  const white = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  const roots = maskScene[kind]();
  const matFor = new Map();
  for (const root of roots) { const m = kind === 'leaves' ? heightMat(root) : white; root.traverse((o) => matFor.set(o, m)); }
  scene.traverse((o) => { if (o.isMesh) { saved.push([o, o.material]); o.material = matFor.get(o) ?? black; } });
  const bg = scene.background; scene.background = new THREE.Color('#000');
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  for (const [o, m] of saved) o.material = m;
  scene.background = bg; renderer.toneMapping = tm;
  return post(name, url);
}
/** the display's four corners in pixels of a w x h frame of the view: TL, TR, BR, BL */
function screenCorners({ view = 'desktop', w = 3840, h = 2160 } = {}) {
  setViewport(w, h);
  setView(view, { aspect: w / h });
  const d = lap.getObjectByName('display');
  d.updateMatrixWorld(true);
  const p = d.geometry.parameters;
  return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => {
    const v = new THREE.Vector3((sx * p.width) / 2, (sy * p.height) / 2, 0).applyMatrix4(d.matrixWorld).project(camera);
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  });
}

setView(params.get('view') ?? 'photo');
renderer.render(scene, camera);
window.__d = { exportScene, exportPosters, sceneInfo, beamPass, sway, traceLoopFrame, airPass, phoneView, wideView, divePose, traceDiveFrame, diveCorners, shootMask, screenCorners, THREE, renderer, scene, camera, VIEWS, setView, setViewport, shoot, traceShot, lap, zz, pothos, stand, chair, L, ROOM };
hud.textContent = `desk Â· ${W}x${H}`;
