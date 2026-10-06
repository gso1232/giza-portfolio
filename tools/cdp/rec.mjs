// a real-time film of a page: node tools/cdp/rec.mjs <url> <w> <h> <out.mp4> <seconds> [js-at-seconds:expr ...]
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H, out, S, ...acts] = process.argv.slice(2);
const dir = out.replace(/\.mp4$/, '-sc'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const c = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(c.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map(); const frames = [];
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } else if (x.method === 'Page.screencastFrame') { frames.push({ t: x.params.metadata.timestamp, data: x.params.data }); send('Page.screencastFrameAck', { sessionId: x.params.sessionId }); } };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.bringToFront');
await send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: +W, maxHeight: +H, everyNthFrame: 1 });
await send('Page.navigate', { url });
const t0 = Date.now();
for (const a of acts.map((x) => [+x.slice(0, x.indexOf(':')), x.slice(x.indexOf(':') + 1)]).sort((p, q) => p[0] - q[0])) { const w = a[0] * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); await send('Runtime.evaluate', { expression: a[1] }); }
const left = +S * 1000 - (Date.now() - t0); if (left > 0) await sleep(left);
await send('Page.stopScreencast');
await fetch(`http://127.0.0.1:9333/json/close/${c.id}`, { method: 'PUT' });
const fps = 30, T0 = frames[0].t, T1 = frames[frames.length - 1].t; let j = 0, k = 0;
for (let t = T0; t <= T1; t += 1 / fps) { while (j + 1 < frames.length && frames[j + 1].t <= t) j++; writeFileSync(`${dir}/o${String(k++).padStart(5, '0')}.jpg`, Buffer.from(frames[j].data, 'base64')); }
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/o%05d.jpg`, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', out]);
rmSync(dir, { recursive: true, force: true });
const big = frames.slice(1).map((f, i) => [f.t - frames[i].t, frames[i].t - T0]).filter((g) => g[0] > 0.1).map((g) => Math.round(g[0] * 1000) + 'ms@' + g[1].toFixed(1) + 's');
console.log('frames', frames.length, 'in', (T1 - T0).toFixed(1), 's; gaps over 100ms:', big.join(' ') || 'none');
process.exit(0);
