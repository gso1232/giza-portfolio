// The dive into the laptop, traced frame by frame: every frame of the camera move
// (desk.html's divePose) as the two light layers the stills use, 'base' then 'sun',
// each motion-blurred and denoised to linear light (LINEAR=1) on the CPU while the GPU
// traces the next. Restartable: a frame with a .done marker is skipped.
//
//   node tools/dive-queue.mjs <outdir> [--frames 90] [--w 1920] [--h 900] [--port 9333]
//
// Leaves <name>-linear.npy per frame and layer (dv-base-NN, dv-sun-NN); the float
// buffers are deleted once denoised. tools/dive-build.py turns them into the videos.

import { existsSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const out = args[0];
const opt = (k, d) => (args.includes(k) ? +args[args.indexOf(k) + 1] : d);
const FRAMES = opt('--frames', 90), W = opt('--w', 1920), H = opt('--h', 900), port = opt('--port', 9333);
const LAYERS = [{ layer: 'base', spp: 16, tiles: 2 }, { layer: 'sun', spp: 8, tiles: 3 }];
if (!out) { console.error('usage: node tools/dive-queue.mjs <outdir>'); process.exit(1); }
const stamp = () => new Date().toTimeString().slice(0, 8);
const pad = (f) => String(f).padStart(2, '0');

// ---- the page ------------------------------------------------------------------------
let ws, id = 0;
const pending = new Map();
async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
async function run(expr) {
  const res = await send('Runtime.evaluate', { expression: `(async () => { return (${expr}); })()`, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails));
  return res.result?.result?.value;
}
async function openPage() {
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5181/desk.html?w=960&h=450&mode=trace' });
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await run('!!window.__d').catch(() => false)) return;
  }
  throw new Error('the page did not load');
}

// ---- the CPU side ---------------------------------------------------------------------
const cpu = [];
let cpuBusy = null;
function pump() {
  if (cpuBusy || !cpu.length) return;
  const name = cpu.shift();
  cpuBusy = new Promise((resolve) => {
    const p = spawn('python', ['tools/denoise.py', out, name], { stdio: 'ignore', env: { ...process.env, LINEAR: '1' } });
    p.on('exit', (code) => {
      if (code === 0) {
        for (const f of readdirSync(out)) if (f.startsWith(name + '-') && (f.endsWith('.bin') || f.endsWith('-raw.png') || f.endsWith('-denoised.png'))) unlinkSync(join(out, f));
        writeFileSync(join(out, name + '.done'), new Date().toISOString());
        console.log(`${stamp()} done ${name}`);
      } else console.log(`${stamp()} denoise failed ${name} ${code}`);
      cpuBusy = null; resolve(); pump();
    });
  });
}

// ---- the queue ------------------------------------------------------------------------
await connect();
const t0 = Date.now();
for (const L of LAYERS) {
  let pageFor = null;
  for (let f = 0; f <= FRAMES; f++) {
    const name = `dv-${L.layer}-${pad(f)}`;
    if (existsSync(join(out, name + '.done'))) continue;
    if (existsSync(join(out, name + '.json')) && existsSync(join(out, name + '-gbuf.bin'))) { cpu.push(name); pump(); continue; }
    if (pageFor !== L.layer) { await openPage(); pageFor = L.layer; }       // a fresh page per layer: the lights are set once
    const t = Date.now();
    const res = await run(`__d.traceDiveFrame('${name}', ${f}, ${FRAMES}, ${L.spp}, { w: ${W}, h: ${H}, tiles: ${L.tiles}, rest: 0.4, layer: '${L.layer}' }).then((r) => JSON.stringify(r), (e) => 'FAIL ' + e.message)`);
    if (String(res).startsWith('FAIL')) { console.log(`${stamp()} ${name} ${res}; stopping`); process.exit(2); }
    console.log(`${stamp()} traced ${name} in ${Math.round((Date.now() - t) / 1000)} s (${Math.round((Date.now() - t0) / 60000)} min)`);
    cpu.push(name);
    pump();
  }
}
while (cpuBusy || cpu.length) { await cpuBusy; pump(); await new Promise((r) => setTimeout(r, 1000)); }
console.log('QUEUE COMPLETE');
ws.close();
