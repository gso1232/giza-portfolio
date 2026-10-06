// Fit the room's light and the surfaces' colours to the reference photograph.
//
// Renders the set small and path traced in the headless browser, averages it
// into the same 72 x 54 blocks as the photo (screen, name and card corners
// left out), and scores the difference region by region. A coordinate search
// moves one light parameter at a time; between sweeps the wall, shelf and
// plastic colours are corrected by the ratio of their mean to the photo's.
//
//   node tools/fit-look.mjs <ref-blocks.json> <start.json> <out.json> [samples] [sweeps]

import { readFileSync, writeFileSync } from 'node:fs';

const [refFile, startFile, outFile, samplesArg, sweepsArg] = process.argv.slice(2);
const ref = JSON.parse(readFileSync(refFile, 'utf8'));
let cfg = JSON.parse(readFileSync(startFile, 'utf8'));
const samples = +(samplesArg ?? 24);
const sweeps = +(sweepsArg ?? 4);

const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression: `(async () => { return (${expression}); })()`, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails.exception?.description));
  return res.result?.result?.value;
};

// in the page: apply a configuration, trace, and measure it against the photo's blocks
await evaluate(`(window.__probe = async (cfg, ref, samples) => {
  const R = __r, L = R.lights;
  const rad = Math.PI / 180, K = L.key;
  const az = cfg.keyAz * rad, el = cfg.keyEl * rad;
  K.position.set(Math.sin(az) * Math.cos(el) * cfg.keyDist, 20 + Math.sin(el) * cfg.keyDist, Math.cos(az) * Math.cos(el) * cfg.keyDist);
  K.lookAt(cfg.aimX, cfg.aimY, -20);
  K.width = K.height = cfg.keySize;
  K.intensity = cfg.keyI;
  K.color.setRGB(1, 1 - 0.035 * cfg.keyWarm, 1 - 0.09 * cfg.keyWarm);
  const S = L.spot, saz = cfg.sAz * rad, sel = cfg.sEl * rad;
  S.position.set(Math.sin(saz) * Math.cos(sel) * cfg.sDist, 20 + Math.sin(sel) * cfg.sDist, Math.cos(saz) * Math.cos(sel) * cfg.sDist);
  S.target.position.set(cfg.sAimX, cfg.sAimY, -20);
  S.target.updateMatrixWorld();
  S.angle = cfg.sAngle * rad;
  S.penumbra = cfg.sPen;
  S.radius = cfg.sRadius;
  S.intensity = Math.exp(cfg.sLogI);
  S.color.copy(K.color);
  L.fill.intensity = cfg.fill;
  L.wall.intensity = cfg.pool;
  R.scene.updateMatrixWorld(true);
  R.scene.environmentIntensity = cfg.envI;
  R.mats.wall.color.setRGB(...cfg.wall);
  R.mats.shelf.color.setRGB(...cfg.shelf);
  R.mats.shelfFront.color.setRGB(...cfg.shelf).multiplyScalar(0.62);
  R.imac.group.traverse((o) => { if (o.name === 'face') o.material.color.setRGB(...cfg.white); });
  R.renderer.toneMappingExposure = cfg.exposure;
  // the same random sequence for every probe, so two probes differ only by what changed
  R.pathTracer.stableNoise = true;
  R.reset();
  R.pathTracer.updateEnvironment();
  await R.trace(samples, { budgetMs: 180000 });
  const gl = R.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const GX = ref.gx, GY = ref.gy, bw = W / GX, bh = H / GY;
  const weight = { wall: 1, shelf: 1, body: 1.5, stand: 0.5, edge: 0.5 };
  const acc = {};
  let loss = 0, wsum = 0;
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const k = j * GX + i, reg = ref.region[k];
    if (reg === 'skip') continue;
    const x0 = Math.floor(i * bw), x1 = Math.floor((i + 1) * bw), y0 = Math.floor(j * bh), y1 = Math.floor((j + 1) * bh);
    const m = [0, 0, 0]; let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = ((H - 1 - y) * W + x) * 4;
      m[0] += buf[p]; m[1] += buf[p + 1]; m[2] += buf[p + 2]; n++;
    }
    const c = m.map((v) => v / n), t = ref.blocks[k];
    const e = (Math.abs(c[0] - t[0]) + Math.abs(c[1] - t[1]) + Math.abs(c[2] - t[2])) / 3;
    const a = (acc[reg] ??= { err: 0, n: 0, mine: [0, 0, 0], ref: [0, 0, 0] });
    a.err += e; a.n++;
    for (let q = 0; q < 3; q++) { a.mine[q] += c[q]; a.ref[q] += t[q]; }
    loss += e * weight[reg]; wsum += weight[reg];
  }
  const regions = {};
  for (const [reg, a] of Object.entries(acc)) regions[reg] = { err: +(a.err / a.n).toFixed(2), mine: a.mine.map((v) => +(v / a.n).toFixed(1)), ref: a.ref.map((v) => +(v / a.n).toFixed(1)) };
  return { loss: +(loss / wsum).toFixed(3), regions };
})`);

const probe = (c) => evaluate(`__probe(${JSON.stringify(c)}, ${JSON.stringify(ref)}, ${samples})`);

// the light's geometry and strengths, with the step each starts searching at
const STEPS = { sAz: 10, sEl: 8, sDist: 50, sAimX: 25, sAimY: 12, sAngle: 5, sPen: 0.2, sRadius: 20, sLogI: 0.4, keyI: 3, fill: 0.3, envI: 0.12, exposure: 0.08 };
const LIMITS = { sAngle: [8, 60], sPen: [0, 1], sRadius: [2, 120], sDist: [100, 450], sEl: [-10, 70], keySize: [10, 200], keyI: [0, 80], fill: [0, 5], pool: [0, 10], envI: [0, 2], exposure: [0.4, 2.5], keyDist: [80, 400], keyEl: [-10, 75], keyWarm: [-2, 3] };
const clampP = (k, v) => (LIMITS[k] ? Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v)) : v);

const lin = (v) => ((v / 255) <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
function correctColours(c, regions) {
  // move each surface's albedo by the (damped) ratio of photo to render, in linear light
  const fix = (key, reg) => {
    const r = regions[reg];
    if (!r) return;
    // brightness only: a per-channel ratio lets the fit trade the light's hue
    // against the surface's and it drifted the warm wall green
    const Y = (c3) => 0.2126 * lin(c3[0]) + 0.7152 * lin(c3[1]) + 0.0722 * lin(c3[2]);
    const k = (Y(r.ref) / Math.max(1e-4, Y(r.mine))) ** 0.6;
    c[key] = c[key].map((v) => Math.min(1, Math.max(0.02, v * k)));
  };
  fix('wall', 'wall');
  fix('shelf', 'shelf');
  fix('white', 'body');
}

let best = await probe(cfg);
console.log('start', best.loss, JSON.stringify(best.regions));
const step = { ...STEPS };
for (let s = 0; s < sweeps; s++) {
  for (const k of Object.keys(STEPS)) {
    for (const dir of [1, -1]) {
      const trial = { ...cfg, [k]: clampP(k, cfg[k] + dir * step[k]) };
      if (trial[k] === cfg[k]) continue;
      const r = await probe(trial);
      if (r.loss < best.loss - 0.05) {
        cfg = trial; best = r;
        console.log(`  ${k} ${dir > 0 ? '+' : '-'}${step[k]} -> ${r.loss}`);
        break;
      }
    }
  }
  const c2 = JSON.parse(JSON.stringify(cfg));
  correctColours(c2, best.regions);
  const r2 = await probe(c2);
  if (r2.loss < best.loss) { cfg = c2; best = r2; console.log('  colours ->', r2.loss); }
  for (const k of Object.keys(step)) step[k] *= 0.6;
  console.log(`sweep ${s + 1}: ${best.loss}`, JSON.stringify(best.regions));
  writeFileSync(outFile, JSON.stringify({ cfg, best }, null, 1));
}
ws.close();
