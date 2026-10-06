// a page's screen after it settles: node tools/cdp/pageshot.mjs <url> <w> <h> <out.jpg> [waitMs]
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H, out, WAIT] = process.argv.slice(2);
const c = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(c.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.bringToFront'); await send('Page.navigate', { url }); await sleep(+(WAIT || 5000));
const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
writeFileSync(out, Buffer.from(s.result.data, 'base64'));
await fetch(`http://127.0.0.1:9333/json/close/${c.id}`, { method: 'PUT' }); console.log('wrote', out); process.exit(0);
