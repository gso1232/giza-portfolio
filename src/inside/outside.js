// What his window looks out on: Cairo, and the Pyramids on the far edge of it, under drifting clouds.
// Built as the reference builds its skyline: flat cut-out layers in paler and paler tones the further
// they are (theirs are drawn unlit, "Skyline" and "Fill"), and clouds as flat outlined shapes, each
// drifting sideways at its own speed (0.3 to 0.8 of the clouds' speed) and wrapping round, on the
// clock, not the scroll. The Pyramids alone take the light: a lit face and a shaded one.
// The window is in the left wall (x = -2.25), so out there is -x, and across the view is z.
import * as THREE from 'three';

const rngOf = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** the view: returns { group, update(dt), setPalette(accent) } */
export function buildOutside({ ink = '#373737' } = {}) {
  const group = new THREE.Group();
  const rnd = rngOf(17);
  const mats = [];                                         // [material, how far toward the accent]
  const flat = (k) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide }); mats.push([m, k]); return m; };
  const edge = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.38 });
  const add = (geo, mat, { edges = false } = {}) => { const m = new THREE.Mesh(geo, mat); if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edge)); group.add(m); return m; };
  // a silhouette standing on y0, facing the room (+x), at depth x, its outline in the plane
  const cut = (shape, x, mat, edges = true) => { const g = new THREE.ShapeGeometry(shape, 6); g.rotateY(-Math.PI / 2); const m = add(g, mat, { edges }); m.position.x = x; return m; };   // (the shape's x along z)

  // ---- the sky: a gradient, lightest at the horizon -------------------------------------------------
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256;
  const skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = add(new THREE.PlaneGeometry(120, 44), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
  sky.rotation.y = Math.PI / 2; sky.position.set(-70, 12, -6);

  // ---- the Pyramids, on the far edge, in the haze ----------------------------------------------------
  const pyrLit = flat(0.16), pyrShade = flat(0.34);
  const pyramid = (z, h, x) => {
    const g = new THREE.ConeGeometry(h * 1.05, h, 4, 1).rotateY(Math.PI / 4);
    // the face toward the sun (the left, -z) lit, the rest in its shade: one colour per face
    const pos = g.attributes.position, idx = [];
    const m = new THREE.Mesh(g, [pyrLit, pyrShade]);
    g.clearGroups();
    const tri = g.index ? g.index.count / 3 : pos.count / 3;
    for (let i = 0; i < tri; i++) {
      const a = g.index ? g.index.getX(i * 3) : i * 3, b = g.index ? g.index.getX(i * 3 + 1) : i * 3 + 1, c = g.index ? g.index.getX(i * 3 + 2) : i * 3 + 2;
      const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3, cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      g.addGroup(i * 3, 3, cx > 0.2 * h ? 0 : 1);            // the face toward the room lit, the side in shade
      void cz;
    }
    void idx;
    m.position.set(x, -2.6 + h / 2, z);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), edge));
    group.add(m);
    return m;
  };
  pyramid(-36, 7.2, -62); pyramid(-30.5, 6.4, -60); pyramid(-27.2, 3.3, -58);
  // the plateau they stand on
  { const s = new THREE.Shape(); s.moveTo(-56, -3.2); s.lineTo(-56, -2.7); s.bezierCurveTo(-42, -2.5, -30, -2.3, -18, -2.75); s.lineTo(-6, -2.9); s.lineTo(-6, -3.2); s.closePath(); cut(s, -57, flat(0.2), false); }

  // ---- Cairo: three layers of roofs, with its domes, minarets and the Tower ---------------------------
  // a run of blocks from z0 to z1 along the layer, heights between lo and hi, some topped by a dome or a minaret
  const skyline = (x, z0, z1, lo, hi, k, base, seed) => {
    const r = rngOf(seed), s = new THREE.Shape();
    s.moveTo(z0, base);
    let z = z0;
    const extras = [];
    while (z < z1) {
      const w = 0.6 + r() * 1.6, h = lo + r() * (hi - lo);
      s.lineTo(z, base + h);
      // a water tank or a stair head on some roofs, the city's broken roofline
      if (r() < 0.35) { const tz = z + w * (0.2 + r() * 0.4), tw = 0.18 + r() * 0.25, th = 0.15 + r() * 0.25; s.lineTo(tz, base + h); s.lineTo(tz, base + h + th); s.lineTo(tz + tw, base + h + th); s.lineTo(tz + tw, base + h); }
      s.lineTo(z + w, base + h);
      if (r() < 0.12) extras.push(['dome', z + w / 2, base + h, w * 0.42]);
      else if (r() < 0.1) extras.push(['minaret', z + w * 0.5, base + h, 0.12 + r() * 0.06]);
      z += w;
    }
    s.lineTo(z1, base); s.closePath();
    const m = flat(k);
    cut(s, x, m);
    for (const [kind, zz, y, sz] of extras) kind === 'dome' ? dome(x + 0.02, zz, y, sz, m) : minaret(x + 0.02, zz, y, sz, m);
  };
  function dome(x, z, y, r, mat) {
    const s = new THREE.Shape();
    s.moveTo(z - r, y); s.lineTo(z - r, y + r * 0.35); s.absarc(z, y + r * 0.35, r, Math.PI, 0, true); s.lineTo(z + r, y);
    // its crescent finial
    s.lineTo(z + r * 0.06, y); s.closePath();
    cut(s, x, mat);
    const f = new THREE.Shape(); f.moveTo(z - 0.02, y + r * 1.35); f.lineTo(z + 0.02, y + r * 1.35); f.lineTo(z + 0.02, y + r * 1.75); f.lineTo(z - 0.02, y + r * 1.75); f.closePath();
    cut(f, x, mat);
  }
  function minaret(x, z, y, w, mat) {
    // a shaft in tiers, a balcony at each, a pencil cone on top: Cairo's Mamluk minarets
    const s = new THREE.Shape(), h1 = w * 9, h2 = w * 6, h3 = w * 4;
    s.moveTo(z - w, y); s.lineTo(z - w, y + h1);
    s.lineTo(z - w * 1.5, y + h1); s.lineTo(z - w * 1.5, y + h1 + w * 0.5); s.lineTo(z - w * 0.8, y + h1 + w * 0.5);
    s.lineTo(z - w * 0.8, y + h1 + h2);
    s.lineTo(z - w * 1.25, y + h1 + h2); s.lineTo(z - w * 1.25, y + h1 + h2 + w * 0.45); s.lineTo(z - w * 0.55, y + h1 + h2 + w * 0.45);
    s.lineTo(z - w * 0.55, y + h1 + h2 + h3); s.lineTo(z, y + h1 + h2 + h3 + w * 2.6); s.lineTo(z + w * 0.55, y + h1 + h2 + h3);
    s.lineTo(z + w * 0.55, y + h1 + h2 + w * 0.45); s.lineTo(z + w * 1.25, y + h1 + h2 + w * 0.45); s.lineTo(z + w * 1.25, y + h1 + h2);
    s.lineTo(z + w * 0.8, y + h1 + h2); s.lineTo(z + w * 0.8, y + h1 + w * 0.5); s.lineTo(z + w * 1.5, y + h1 + w * 0.5); s.lineTo(z + w * 1.5, y + h1);
    s.lineTo(z + w, y + h1); s.lineTo(z + w, y); s.closePath();
    cut(s, x, mat);
  }
  // the Cairo Tower: a slim lattice shaft, the lotus cup at its top, a mast
  function cairoTower(x, z, y, H, mat) {
    const s = new THREE.Shape(), w0 = H * 0.045, w1 = H * 0.028;
    s.moveTo(z - w0, y); s.bezierCurveTo(z - w1, y + H * 0.4, z - w1 * 0.9, y + H * 0.7, z - w1, y + H * 0.82);
    s.lineTo(z - w1 * 2.1, y + H * 0.86); s.lineTo(z - w1 * 1.9, y + H * 0.92); s.lineTo(z - w1 * 1.2, y + H * 0.93);
    s.lineTo(z - w1 * 0.3, y + H * 0.94); s.lineTo(z - w1 * 0.3, y + H * 1.06); s.lineTo(z + w1 * 0.3, y + H * 1.06); s.lineTo(z + w1 * 0.3, y + H * 0.94);
    s.lineTo(z + w1 * 1.2, y + H * 0.93); s.lineTo(z + w1 * 1.9, y + H * 0.92); s.lineTo(z + w1 * 2.1, y + H * 0.86);
    s.lineTo(z + w1, y + H * 0.82); s.bezierCurveTo(z + w1 * 0.9, y + H * 0.7, z + w1, y + H * 0.4, z + w0, y); s.closePath();
    cut(s, x, mat);
  }
  // far, middle and near: the further, the paler; the Pyramids show over the far roofs to the left
  // (seen from his room the view at depth x spans z from about 2.4 - 0.88 (2.1 - x) to 2.4 - 0.21 (2.1 - x))
  skyline(-34, -34, -21.5, 0.6, 2.2, 0.3, -3.1, 3);
  skyline(-34, -21.5, -13.5, 0.2, 0.7, 0.3, -3.1, 7);          // low here: the Pyramids show over it
  skyline(-34, -13.5, -2, 0.6, 2.4, 0.3, -3.1, 4);
  cairoTower(-33.9, -9.5, -2.4, 7.4, mats.at(-1)[0]);
  skyline(-20, -20, -1, 0.8, 2.4, 0.56, -3.6, 5);
  skyline(-9, -9, 1.5, 1.6, 3.6, 0.8, -4.4, 6);
  for (const [z, w] of [[-14.2, 0.13], [-6.6, 0.15]]) minaret(-19.95, z, -3.6 + 2.2, w, mats[mats.length - 2][0]);

  // ---- the clouds: flat, white, outlined, drifting --------------------------------------------------
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
  const clouds = [];
  const Z0 = -40, Z1 = 2;                                  // they wrap round between these
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Shape(), w = 2.2 + rnd() * 3.2, bumps = 3 + Math.floor(rnd() * 3);
    // a flat bottom and a row of round tops, as the reference draws them
    s.moveTo(0, 0); s.lineTo(w, 0);
    let z = w;
    for (let b = 0; b < bumps; b++) {
      const r = (w / bumps) * (0.55 + rnd() * 0.35), zz = w - (w / bumps) * (b + 0.5);
      s.absarc(zz, r * 0.25 + rnd() * 0.25, r, 0, Math.PI, false);
      z = zz - r;
    }
    s.lineTo(0, 0);
    void z;
    const g = new THREE.ShapeGeometry(s, 10); g.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(g, cloudMat);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), edge));
    const depth = -24 - rnd() * 14;
    m.position.set(depth, 3.2 + rnd() * 6.5, Z0 + rnd() * (Z1 - Z0));
    m.scale.setScalar(0.7 + rnd() * 0.6);
    m.userData.speed = 0.3 + rnd() * 0.5;
    group.add(m);
    clouds.push(m);
  }

  return {
    group,
    /** the clouds' drift, on the clock (metres a second at speed 1) */
    update(dt, speed = 0.35) {
      for (const c of clouds) {
        c.position.z += c.userData.speed * speed * dt;
        if (c.position.z > Z1) c.position.z -= Z1 - Z0;
      }
    },
    setPalette(accent) {
      const A = new THREE.Color(accent), base = new THREE.Color('#f3efe6');
      for (const [m, k] of mats) m.color.copy(base).lerp(A, k);
      // the sky: pale at the horizon, a touch of the accent up high
      const g = skyC.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
      const hi = base.clone().lerp(A, 0.22), lo = base.clone().lerp(A, 0.04);
      grd.addColorStop(0, `#${hi.getHexString()}`); grd.addColorStop(0.62, `#${lo.getHexString()}`); grd.addColorStop(1, `#${lo.getHexString()}`);
      g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
      skyTex.needsUpdate = true;
      cloudMat.color.copy(base).lerp(new THREE.Color('#ffffff'), 0.7);
    },
  };
}
