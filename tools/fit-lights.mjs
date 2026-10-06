// Search the lighting that best matches the reference photo at sample points.
// Renders every configuration small and path traced in the headless browser,
// reads the pixels back and scores them against the photo.
//
//   node tools/fit-lights.mjs <ref-points.json> <configs.json> [samples]

import { readFileSync } from 'node:fs';

const [pointsFile, configsFile, samplesArg] = process.argv.slice(2);
const points = JSON.parse(readFileSync(pointsFile, 'utf8'));
const configs = JSON.parse(readFileSync(configsFile, 'utf8'));
const samples = +(samplesArg ?? 24);

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

const probe = `(async (cfg, points, samples) => {
  const R = __r, L = R.lights;
  L.key.position.set(...cfg.pos); L.key.lookAt(...cfg.aim); L.key.intensity = cfg.key;
  L.key.width = L.key.height = cfg.size ?? 90;
  L.fill.intensity = cfg.fill; L.wall.intensity = cfg.wall ?? 0;
  R.scene.environmentIntensity = cfg.env;
  R.reset(); R.pathTracer.updateEnvironment();
  await R.trace(samples, { budgetMs: 60000 });
  const gl = R.renderer.getContext();
  const W = R.renderer.domElement.width, H = R.renderer.domElement.height;
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let err = 0; const per = [];
  for (const [px, py, r, g, b] of points) {
    const cx = Math.round(px * W / 1146), cy = H - 1 - Math.round(py * H / 860);
    let s = [0, 0, 0], n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = ((cy + dy) * W + (cx + dx)) * 4; s[0] += buf[i]; s[1] += buf[i + 1]; s[2] += buf[i + 2]; n++;
    }
    const m = s.map((v) => v / n);
    const e = Math.abs(m[0] - r) + Math.abs(m[1] - g) + Math.abs(m[2] - b);
    err += e; per.push(Math.round(e));
  }
  return { err: Math.round(err / points.length), per };
})`;

const results = [];
for (const cfg of configs) {
  const r = await evaluate(`${probe}(${JSON.stringify(cfg)}, ${JSON.stringify(points)}, ${samples})`);
  results.push({ ...r, cfg });
  process.stdout.write(`${r.err} ${JSON.stringify(cfg)}\n`);
}
results.sort((a, b) => a.err - b.err);
console.log('BEST', JSON.stringify(results[0]));
ws.close();
