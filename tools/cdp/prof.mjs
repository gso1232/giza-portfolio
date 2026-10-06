// what the long tasks are: a CPU profile of a page's first seconds, its heaviest functions (self time) per second
//   node tools/cdp/prof.mjs <url> <w> <h> <seconds>
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H, S] = process.argv.slice(2);
const c = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(c.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 500 });
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.bringToFront'); await send('Profiler.start'); await send('Page.navigate', { url });
if (process.argv[6]) { await sleep(+process.argv[6] * 1000); await send('Runtime.evaluate', { expression: '__inside.sig.hide()' }); await sleep((+S - +process.argv[6]) * 1000); } else await sleep(+S * 1000);
const { result: { profile } } = await send('Profiler.stop');
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
// samples to time windows of 250 ms; the heaviest windows, and what ran in them
let t = profile.startTime; const win = new Map();
profile.samples.forEach((sid, i) => { t += profile.timeDeltas[i]; const n = nodes.get(sid); const k = Math.floor((t - profile.startTime) / 250000); const f = n.callFrame; const name = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`; if (!win.has(k)) win.set(k, new Map()); const m = win.get(k); m.set(name, (m.get(name) || 0) + profile.timeDeltas[i] / 1000); });
const tot = [...win.entries()].map(([k, m]) => [k, [...m.entries()].filter(([n]) => !/\(idle\)|\(program\)|\(garbage/.test(n)).reduce((a, [, v]) => a + v, 0), m]).sort((a, b) => b[1] - a[1]).slice(0, 6);
for (const [k, sum, m] of tot) { console.log(`@${(k * 0.25).toFixed(2)}s busy ${sum.toFixed(0)} ms:`, [...m.entries()].filter(([n]) => !/\(idle\)/.test(n)).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([n, v]) => `${n} ${v.toFixed(0)}`).join(' | ')); }
await fetch(`http://127.0.0.1:9333/json/close/${c.id}`, { method: 'PUT' }); process.exit(0);
