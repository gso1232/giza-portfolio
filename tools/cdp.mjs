// Drive a headless Chromium (started with --remote-debugging-port) over the
// DevTools protocol, with nothing but Node's built-in fetch and WebSocket.
//
//   node tools/cdp.mjs [--port 9333] [--nav URL] [--wait-for EXPR] "<js expression>"
//
// The expression is evaluated in the page (top-level await allowed) and its
// value printed as JSON.

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const port = +opt('--port', 9333);
const nav = opt('--nav', null);
const waitFor = opt('--wait-for', null);
const expr = args.join(' ');

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression: `(async () => { return (${expression}); })()`, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails));
  return res.result?.result?.value;
}

if (nav) {
  // mark the old document, so waiting can't be satisfied by the page we are leaving
  await evaluate('(window.__leaving = true)').catch(() => {});
  await send('Page.enable');
  await send('Page.navigate', { url: nav });
  await new Promise((r) => setTimeout(r, 500));
}
if (waitFor) {
  const t0 = Date.now();
  while (!(await evaluate(`!window.__leaving && (${waitFor})`).catch(() => false))) {
    if (Date.now() - t0 > 180000) throw new Error('timed out waiting for ' + waitFor);
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (expr) console.log(JSON.stringify(await evaluate(expr), null, 1));
ws.close();
