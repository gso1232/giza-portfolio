// The outline's normals for a figure's mesh, off the main thread (scene6.js smoothHullNormals): each vertex's
// normal averaged with its neighbours' within 2 cm, so the inked hull swells evenly round the creases.
self.onmessage = (e) => {
  const { id, P, Nn } = e.data;
  const N = P.length / 3, R = 0.02, R2 = R * R;
  const key = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  const cells = new Map(), C = new Int32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const cx = Math.floor(P[i * 3] / R), cy = Math.floor(P[i * 3 + 1] / R), cz = Math.floor(P[i * 3 + 2] / R);
    C[i * 3] = cx; C[i * 3 + 1] = cy; C[i * 3 + 2] = cz;
    const k = key(cx, cy, cz); let c = cells.get(k); if (!c) cells.set(k, (c = [])); c.push(i);
  }
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = C[i * 3], cy = C[i * 3 + 1], cz = C[i * 3 + 2];
    let sx = 0, sy = 0, sz = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const list = cells.get(key(cx + a, cy + b, cz + c)); if (!list) continue;
      for (let q = 0; q < list.length; q++) {
        const j = list[q] * 3, dx = P[j] - x, dy = P[j + 1] - y, dz = P[j + 2] - z;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 > R2) continue;
        const w = 1 - d2 / R2;
        sx += Nn[j] * w; sy += Nn[j + 1] * w; sz += Nn[j + 2] * w;
      }
    }
    const l = Math.hypot(sx, sy, sz) || 1;
    out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
  }
  self.postMessage({ id, out }, [out.buffer]);
};
