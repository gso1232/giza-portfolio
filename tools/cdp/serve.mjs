// dist/ as a host serves it: brotli for text, the vercel.json caching, many requests at once.
//   node tools/cdp/serve.mjs [dir=dist] [port=4173]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
const dir = resolve(process.argv[2] || 'dist'), port = +(process.argv[3] || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2' };
const TEXT = new Set(['.html', '.js', '.css', '.json', '.svg', '.glb']);
const cache = new Map();
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(dir, p);
  try {
    const st = await stat(f);
    const ext = extname(f);
    const h = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes',
      'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' };
    if (TEXT.has(ext) && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
      const k = f + st.mtimeMs;
      if (!cache.has(k)) cache.set(k, brotliCompressSync(await readFile(f), { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
      res.writeHead(200, { ...h, 'Content-Encoding': 'br', 'Content-Length': cache.get(k).length }); res.end(cache.get(k)); return;
    }
    const body = await readFile(f);
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : body.length - 1;
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${body.length}`, 'Content-Length': b - a + 1 }); res.end(body.subarray(a, b + 1)); return;
    }
    res.writeHead(200, { ...h, 'Content-Length': body.length }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`serving ${dir} on http://127.0.0.1:${port}`));
