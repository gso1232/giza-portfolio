// What makes the Yellow Crane Tower his: a web engineer's and UI designer's marks on the reference's beats.
//   - breakpoints: as the tower rises, each storey measured as a viewport is (1440 at the ground, 390 under
//     the crown), Figma's pink dimension lines;
//   - the inspector: the pointer over a storey highlights it as the browser's DevTools highlight an element
//     (content blue, margin orange, a tag with its selector and size);
//   - auto layout: when the gallery re-lays after the red pen, Figma's pink frame and its gaps;
//   - Lighthouse: when the real tower comes through, the four lanterns at its door carry its scores;
//   - design tokens: beside it, the colours it came through in, as tokens;
//   - the review: the laptop's screen becomes the pull request the red pen asked for, its checks green, merged;
//   - night: the page's dark mode switch, the tower's pages lit in the dark (scene6 setNight).
//
// update(S, b) each frame; pointer(ndc) / pointerOut() for the inspector.
import * as THREE from 'three';

const MONO = '"Geist Mono", ui-monospace, Menlo, monospace', SANS = '"Geist Sans", Geist, system-ui, sans-serif';
const PINK = '#f2489a', BLUE = '#3d8bff';
const clamp = (t) => Math.min(1, Math.max(0, t));
const range = (v, a, b) => clamp((v - a) / (b - a));
const sm = (t) => t * t * (3 - 2 * t);
const win = (S, a, b, c, d) => sm(range(S, a, b)) * (1 - sm(range(S, c, d)));   // in over a..b, out over c..d

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** a label that always faces the camera, `h` metres tall, drawn over everything */
function label(tex, h, aspect) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(h * aspect, h, 1);
  s.renderOrder = 20;
  return s;
}
const pill = (text, { bg = PINK, fg = '#fff', w = 360, h = 96, font = `600 46px ${MONO}` } = {}) => canvasTex(w, h, (g) => {
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill();
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
});

export function createExtras({ scene, camera, tower, set, palette }) {
  const { named, info, root } = tower;
  const K = info.scale, OX = info.pivot[0], OZ = info.pivot[1];
  const L = info.levels;                                   // terrace top, the storeys' feet, the top
  const GROUPS = [1, 3, 6, 7, 8];                          // (each storey's motion group, ground up)
  const widths = info.plan.widths.map((w) => w - 2 * info.plan.bay_out);   // (each storey's square)
  const BP = [1440, 1280, 1024, 768, 390];
  const NAMES = ['section.hero', 'section.about', 'section.work', 'section.work', 'section.contact'];
  const lineMat = (col, op = 1) => new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthTest: false });
  const all = [];

  // ---- breakpoints: a dimension line across each storey's front, its width as a viewport -----------------
  const dims = GROUPS.map((k, si) => {
    const g = named[`floor_${k}`];
    const W = widths[si], bp = info.plan.bay_out;
    const x = OX + W / 2 + bp + 0.045, y = L[si + 1] - 0.008, z0 = OZ - W / 2, z1 = OZ + W / 2;
    // (thin bars, not lines: a WebGL line is one pixel wide however close)
    const bar = (x0, y0, z0, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, depthTest: false })); m.position.set(x0, y0, z0); m.scale.set(sx, sy, sz); m.renderOrder = 19; return m; };
    const ln = new THREE.Group();
    ln.add(bar(x, y, OZ, 0.0016, 0.0016, z1 - z0), bar(x, y, z0, 0.0016, 0.012, 0.0016), bar(x, y, z1, 0.0016, 0.012, 0.0016));
    ln.material = { set opacity(v) { ln.children.forEach((c) => { c.material.opacity = v; }); } };
    const tag = label(pill(`${BP[si]}`, { w: 260 }), 0.016, 260 / 96);
    tag.position.set(x, y + 0.012, OZ);
    const grp = new THREE.Group(); grp.add(ln, tag);
    g?.add(grp);
    all.push(grp);
    return { grp, mats: [ln.material, tag.material] };
  });

  // ---- the inspector ---------------------------------------------------------------------------------------
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false }));
  const margin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#f6a54b', transparent: true, opacity: 0.16, depthTest: false, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), lineMat(BLUE, 0.9));
  box.renderOrder = margin.renderOrder = 17; edges.renderOrder = 18;
  const tips = NAMES.map((n, si) => label(canvasTex(760, 96, (g, w, h) => {
    g.fillStyle = '#202124'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 12); g.fill();
    g.font = `500 42px ${MONO}`; g.textBaseline = 'middle';
    const [tag, cls] = n.split('.');
    g.fillStyle = '#c792ea'; g.fillText(tag, 26, h / 2 + 2);
    let x = 26 + g.measureText(tag).width;
    g.fillStyle = '#82aaff'; g.fillText('.' + cls, x, h / 2 + 2); x += g.measureText('.' + cls).width + 22;
    g.fillStyle = '#9aa0a6'; g.fillText(`${BP[si]} × ${Math.round(BP[si] * 0.62)}`, x, h / 2 + 2);
  }), 0.02, 760 / 96));
  const insp = new THREE.Group(); insp.add(margin, box, edges, ...tips); insp.visible = false;
  scene.add(insp);
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let ptrOn = false;
  const bb = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();

  // ---- auto layout: Figma's frame round the re-laid gallery, its gaps --------------------------------------
  const cardsB = Object.values(named).filter((o) => /^cardB_/.test(o.name) && o.children.length);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), lineMat(PINK)); frame.renderOrder = 19;
  const gapBars = [...Array(5)].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.55, depthTest: false })); m.renderOrder = 19; return m; });
  const gapTags = gapBars.map(() => label(pill('16', { w: 150, h: 84, font: `600 44px ${MONO}` }), 0.009, 150 / 84));
  const alTag = label(pill('Auto layout · 2 col · gap 16', { w: 980, h: 96, font: `600 44px ${SANS}` }), 0.013, 980 / 96);
  const al = new THREE.Group(); al.add(frame, ...gapBars, ...gapTags, alTag); al.visible = false;
  scene.add(al);

  // ---- Lighthouse at the lanterns ------------------------------------------------------------------------
  const scores = [['Performance', 98], ['Accessibility', 100], ['Best Practices', 100], ['SEO', 100]];
  const gauge = (name, v) => canvasTex(300, 340, (g, w) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, 140, 118, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d6f5df'; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, 140, 98, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#0cce6b'; g.beginPath(); g.arc(w / 2, 140, 98, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v / 100); g.stroke();
    g.fillStyle = '#0a8f4a'; g.font = `700 92px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), w / 2, 146);
    g.fillStyle = '#fbf6ee'; g.font = `600 34px ${SANS}`; g.fillText(name, w / 2, 310);
  });
  const g1 = named.floor_1;
  const W0 = widths[0], bw0 = W0 * 0.52, xL = OX + W0 / 2 + info.plan.bay_out + 0.03, yL = L[1] - 0.004;
  const gauges = scores.map(([n, v], i) => {
    const s = label(gauge(n, v), 0.024, 300 / 340);
    s.position.set(xL, yL + 0.012, OZ + [-0.32, -0.11, 0.11, 0.32][i] * bw0 * 1.5);
    g1?.add(s);
    return s;
  });

  // ---- the tokens it came through in -----------------------------------------------------------------------
  const tokens = [['--roof', '#E0A53A'], ['--column', '#A3392F'], ['--rafter', '#2F5B53'], ['--stone', '#EFE8DC'], ['--gold', '#D9B25A']];
  const tokTex = canvasTex(620, 470, (g, w, h) => {
    g.fillStyle = '#1e1e24'; g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
    g.fillStyle = '#9aa0a6'; g.font = `500 34px ${MONO}`; g.fillText('tokens.css', 34, 58);
    tokens.forEach(([n, c], i) => {
      const y = 112 + i * 70;
      g.fillStyle = c; g.beginPath(); g.roundRect(34, y - 26, 52, 52, 10); g.fill();
      g.fillStyle = '#82aaff'; g.font = `500 34px ${MONO}`; g.fillText(n, 108, y + 12);
      g.fillStyle = '#c3e88d'; g.fillText(c, 360, y + 12);
    });
  });
  const tok = label(tokTex, 0.09, 620 / 470);
  tok.position.set(OX + 0.05, 1.03, OZ + 0.3);
  scene.add(tok);

  // ---- the review: the laptop's screen, once the change is in --------------------------------------------
  const mac = set?.byName?.get('scr_mac');
  const before = mac?.material?.map ?? null;
  const prTex = canvasTex(1440, 900, (g, W, H) => {
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#161b22'; g.fillRect(0, 0, W, 76);
    g.fillStyle = '#e6edf3'; g.font = `600 30px ${SANS}`; g.fillText('samy / samy.dev', 40, 50);
    g.font = `600 52px ${SANS}`; g.fillText('Gallery: two to a row', 60, 170); g.fillStyle = '#7d8590'; g.fillText('#42', 640, 170);
    g.fillStyle = '#8957e5'; g.beginPath(); g.roundRect(60, 200, 150, 52, 26); g.fill();
    g.fillStyle = '#fff'; g.font = `600 28px ${SANS}`; g.fillText('Merged', 92, 236);
    g.fillStyle = '#7d8590'; g.font = `400 28px ${SANS}`; g.fillText('teammate requested: "2 COLUMNS" — done', 230, 236);
    g.strokeStyle = '#30363d'; g.lineWidth = 2; g.strokeRect(60, 300, W - 120, 470);
    g.fillStyle = '#e6edf3'; g.font = `600 32px ${SANS}`; g.fillText('All checks have passed', 100, 360);
    [['lint', 'eslint · 0 problems'], ['unit tests', '48 passed'], ['build', 'vite · 1.9 s'], ['Lighthouse', '98 · 100 · 100 · 100'], ['deploy', 'samy.dev · production']].forEach(([a, b], i) => {
      const y = 430 + i * 66;
      g.fillStyle = '#3fb950'; g.beginPath(); g.arc(110, y - 10, 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#0d1117'; g.lineWidth = 5; g.beginPath(); g.moveTo(101, y - 10); g.lineTo(108, y - 3); g.lineTo(120, y - 18); g.stroke();
      g.fillStyle = '#e6edf3'; g.font = `500 30px ${SANS}`; g.fillText(a, 146, y);
      g.fillStyle = '#7d8590'; g.fillText(b, 420, y);
    });
  });
  prTex.flipY = false;

  function update(S, b) {
    // breakpoints: while the tower stands up (their second section), one storey after another
    dims.forEach((d, i) => {
      const o = win(S, 10.9 + i * 0.25, 11.6 + i * 0.25, 14.2, 14.7) * (root.visible ? 1 : 0);
      d.grp.visible = o > 0.01;
      for (const m of d.mats) m.opacity = o;
    });
    // the inspector: the storey under the pointer
    insp.visible = false;
    if (ptrOn && root.visible && S > 10.6 && S < 25.2) {
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObject(root, true).find((h) => h.object.isMesh && h.object.visible);
      if (hit) {
        let p = hit.object; while (p && !/^floor_\d$/.test(p.name)) p = p.parent;
        const k = p ? +p.name.split('_')[1] : -1, si = GROUPS.indexOf(k);
        if (si >= 0) {
          bb.setFromObject(p); bb.getSize(size); bb.getCenter(mid);
          box.position.copy(mid); box.scale.copy(size);
          edges.position.copy(mid); edges.scale.copy(size);
          margin.position.copy(mid); margin.scale.copy(size).addScalar(0.016);
          tips.forEach((t, i) => { t.visible = i === si; t.position.set(mid.x, bb.max.y + 0.03, mid.z); });
          insp.visible = true;
        }
      }
    }
    // auto layout: once the two-to-a-row stands are up, until the wide shot
    const aOn = win(S, 20.3, 20.9, 22.3, 22.8);
    al.visible = aOn > 0.01 && cardsB.length > 0;
    if (al.visible) {
      bb.makeEmpty();
      const boxes = cardsB.map((c) => new THREE.Box3().setFromObject(c));
      for (const x of boxes) bb.union(x);
      bb.getSize(size); bb.getCenter(mid);
      frame.position.copy(mid); frame.scale.copy(size).addScalar(0.006);
      frame.material.opacity = aOn;
      alTag.position.set(mid.x, bb.max.y + 0.018, mid.z); alTag.material.opacity = aOn;
      // the gaps: between the two of each row, and between the rows
      const cs = boxes.map((x) => x.getCenter(new THREE.Vector3()));
      const pairs = [];
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const a = boxes[i], c = boxes[j];
        if (Math.abs(cs[i].x - cs[j].x) < 0.01 && pairs.length < 5) pairs.push([new THREE.Vector3((cs[i].x + cs[j].x) / 2, mid.y, (Math.min(a.max.z, c.max.z) + Math.max(a.min.z, c.min.z)) / 2), 'z', Math.abs(Math.max(a.min.z, c.min.z) - Math.min(a.max.z, c.max.z))]);
        else if (Math.abs(cs[i].z - cs[j].z) < 0.01 && pairs.length < 5) pairs.push([new THREE.Vector3((Math.min(a.max.x, c.max.x) + Math.max(a.min.x, c.min.x)) / 2, mid.y, (cs[i].z + cs[j].z) / 2), 'x', Math.abs(Math.max(a.min.x, c.min.x) - Math.min(a.max.x, c.max.x))]);
      }
      gapBars.forEach((m, i) => {
        const p = pairs[i];
        m.visible = gapTags[i].visible = !!p;
        if (!p) return;
        const [c, ax, gap] = p;
        m.position.copy(c); m.scale.set(ax === 'x' ? gap : 0.004, 0.0015, ax === 'z' ? gap : 0.004);
        m.material.opacity = 0.55 * aOn;
        gapTags[i].position.set(c.x, c.y + 0.008, c.z); gapTags[i].material.opacity = aOn;
      });
    }
    // Lighthouse and the tokens, with the real tower (their facade clock)
    const v = named.facade ? Math.min(1, named.facade.scale.x) : 0;
    const lo = sm(range(v, 0.35, 0.8));
    gauges.forEach((s, i) => { s.material.opacity = sm(range(v, 0.35 + i * 0.08, 0.6 + i * 0.08)); s.visible = s.material.opacity > 0.01; });
    tok.material.opacity = lo; tok.visible = lo > 0.01;
    // the review on the laptop, once the gallery is re-laid
    if (mac?.material) {
      const want = S > 20.6 ? prTex : before;
      if (mac.material.map !== want) { mac.material.map = want; mac.material.needsUpdate = true; }
    }
  }
  return {
    update,
    pointer(x, y) { ptr.set(x, y); ptrOn = true; },
    pointerOut() { ptrOn = false; },
    textures: [prTex, tokTex],
  };
}
