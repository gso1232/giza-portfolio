// open a page in my headless Brave, wait, run expressions, print what they return
//   node tools/cdp/eval.mjs <url> <w> <h> <waitMs> <expr> [expr...]
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H, wait, ...exprs] = process.argv.slice(2);
const c = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(c.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.bringToFront'); await send('Page.navigate', { url }); await sleep(+wait);
for (const e of exprs) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description)); await sleep(300); }
await fetch(`http://127.0.0.1:9333/json/close/${c.id}`, { method: 'PUT' }); process.exit(0);
