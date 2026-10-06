// Screenshot a page in its own tab of the headless browser (the render tab is
// left alone), at a desktop viewport, for the city's billboards.
//
//   node tools/snap.mjs <url> <out.jpg> [width=1600] [height=900] [waitMs=4000]

import { writeFileSync } from 'node:fs';

const [url, out, wArg, hArg, waitArg] = process.argv.slice(2);
const W = +(wArg ?? 1600), H = +(hArg ?? 900), wait = +(waitArg ?? 4000);
const port = 9333;

const created = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, wait));
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90, captureBeyondViewport: false });
  if (!shot.result?.data) throw new Error('no screenshot: ' + JSON.stringify(shot).slice(0, 200));
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', out);
} finally {
  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${created.id}`).catch(() => {});
}
