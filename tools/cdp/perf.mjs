// How smooth a page is, in my headless Brave (9333): load it, then scroll it top to bottom with the wheel at a
// steady pace, and report the frames (rAF to rAF) and the long tasks, by part of the page.
//   node tools/cdp/perf.mjs <url> <w> <h> [--mobile] [--cpu 4] [--speed 1800] [--palette galaxy] [--switch]
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
const opt = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const mobile = process.argv.includes('--mobile'), cpu = +opt('--cpu', 1), speed = +opt('--speed', 1800);
const created = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: mobile ? 3 : 1, mobile });
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
if (cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: cpu });
await send('Page.bringToFront');
// (the probe, in the page before its own scripts: every frame's time, every long task, the paints)
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__perf = { frames: [], long: [], fcp: 0, lcp: 0, t0: performance.now() };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) __perf.long.push([Math.round(e.startTime), Math.round(e.duration), Math.round(scrollY)]); }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') __perf.fcp = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) __perf.lcp = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
  let last = 0; const tick = (t) => { if (last) __perf.frames.push([Math.round(t), +(t - last).toFixed(1), Math.round(scrollY)]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
` });
const t0 = Date.now();
await send('Page.navigate', { url });
await sleep(+opt('--wait', 9000));
const load = await js(`JSON.stringify({ fcp: __perf.fcp, lcp: __perf.lcp, long: __perf.long, hidden: document.hidden, bytes: performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0) })`);
console.log('LOAD', load);
await js(`window.__inside && __inside.sig && __inside.sig.hide()`);
await sleep(2500);
if (opt('--palette')) { await js(`document.querySelector('.palettes [data-key=${opt('--palette')}]')?.click()`); await sleep(3500); }
await js(`__perf.frames.length = 0; __perf.long.length = 0`);
// the wheel, a notch at a time, at `speed` px a second
const max = await js(`document.documentElement.scrollHeight - innerHeight`);
const step = 100, every = (step / speed) * 1000;
const tS = Date.now();
while ((await js('scrollY')) < max - 4 && Date.now() - tS < (max / speed) * 1000 * 2.5 + 8000) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: step });
  await sleep(every);
}
await sleep(1500);
if (process.argv.includes('--switch')) {
  await js(`__perf.mark = performance.now(); document.querySelector('.palettes [data-key=galaxy]')?.click()`); await sleep(3000);
}
const res = JSON.parse(await js(`JSON.stringify(__perf)`));
const f = res.frames, by = new Map();
for (const [t, d, y] of f) { const k = Math.min(9, Math.floor((y / Math.max(1, max)) * 10)); if (!by.has(k)) by.set(k, []); by.get(k).push(d); }
const stat = (a) => { const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return `n ${s.length} p50 ${q(0.5)} p95 ${q(0.95)} p99 ${q(0.99)} max ${s[s.length - 1]} over33 ${s.filter((x) => x > 33.4).length} over50 ${s.filter((x) => x > 50).length}`; };
console.log('ALL  ', stat(f.map((x) => x[1])));
for (const k of [...by.keys()].sort((a, b) => a - b)) console.log(`${k * 10}%-${k * 10 + 10}%`, stat(by.get(k)));
console.log('LONG', JSON.stringify(res.long));
console.log('WORST', JSON.stringify([...f].sort((a, b) => b[1] - a[1]).slice(0, 12)));
await fetch(`http://127.0.0.1:9333/json/close/${created.id}`, { method: 'PUT' });
process.exit(0);
