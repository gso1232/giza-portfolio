// one stretch of the inside site, scrolled slowly: each slow frame with where the story was
//   node tools/cdp/spot.mjs <url> <w> <h> <fromY> <toY> [pxPerSec=800]
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H, Y0, Y1, SP] = process.argv.slice(2); const sp = +(SP || 800);
const c = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(c.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.bringToFront'); await send('Page.navigate', { url }); await sleep(9000);
await js('__inside.sig.hide()'); await sleep(2000);
await js(`__inside.scrollToY ? __inside.scrollToY(${Y0}) : scrollTo(0, ${Y0})`); await sleep(2500);
await js(`window.__f = []; (() => { let l = 0; const k = (t) => { if (l) __f.push([+(t - l).toFixed(1), Math.round(scrollY), +__inside.storyAt(scrollY).toFixed(2)]); l = t; if (__f.length < 4000) requestAnimationFrame(k); }; requestAnimationFrame(k); })()`);
const n = Math.ceil((+Y1 - +Y0) / 50); for (let i = 0; i < n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +W / 2, y: +H / 2, deltaX: 0, deltaY: 50 }); await sleep(50000 / sp); }
await sleep(1000);
const f = await js('__f');
console.log('frames', f.length, 'slow', f.filter((x) => x[0] > 25).length);
console.log(JSON.stringify(f.filter((x) => x[0] > 25)));
await fetch(`http://127.0.0.1:9333/json/close/${c.id}`, { method: 'PUT' }); process.exit(0);
