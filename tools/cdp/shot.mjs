// pictures of the inside site at story positions: node tools/cdp/shot.mjs <url> <w> <h> <outprefix> <y;y;...> [expr]
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const [url, W, H, out, list, extra] = process.argv.slice(2);
const c = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(c.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.bringToFront'); await send('Page.navigate', { url }); await sleep(16000);
if (!process.env.KEEPSIG) { await js('window.__inside && __inside.sig.hide()'); await sleep(2500); }
if (extra) { console.log(await js(extra)); await sleep(3000); }
let i = 0;
for (const y of list.split(';')) {
  await js(`(() => { const y = ${y.startsWith('u') ? `__inside.yAt(${y.slice(1)})` : y}; __inside.scrollToY ? __inside.scrollToY(y) : scrollTo(0, y); })()`);
  await sleep(2200);
  const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  writeFileSync(`${out}-${i}.jpg`, Buffer.from(s.result.data, 'base64')); console.log(y, `${out}-${i++}.jpg`);
}
await fetch(`http://127.0.0.1:9333/json/close/${c.id}`, { method: 'PUT' }); process.exit(0);
