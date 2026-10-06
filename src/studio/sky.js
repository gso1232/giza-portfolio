import * as THREE from 'three';

// The sky outside the studio's window, as an HDR picture of the whole sphere.
// The colours come from the Preetham daylight model (the same maths as
// three.js' Sky shader: Rayleigh and Mie scattering along the air mass toward
// each direction), turned up for Cairo's dusty afternoon haze, with the sun a
// small, very bright disc low in the west (the room's left). The path tracer
// picks directions from this map by their brightness, so the sun lights the
// room with properly soft-edged patches and the rest of the sky fills the window.
//
// The map follows three-gpu-pathtracer's equirect convention:
// u = atan2(z, x) / 2pi + 0.5, v = 1 - acos(y) / pi, row 0 at the bottom.

const totalRayleigh = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MieConst = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];

function sunIntensity(zenithCos) {
  const cutoff = 1.6110731556870734, steepness = 1.5, EE = 1000;
  return EE * Math.max(0, 1 - Math.exp(-((cutoff - Math.acos(Math.min(1, Math.max(-1, zenithCos)))) / steepness)));
}

/**
 * The Preetham sky's radiance toward `dir` for a sun toward `sun` (both unit),
 * and the air's transmittance along it (which tints the sun's own disc).
 */
export function preetham(dir, sun, { turbidity = 4, rayleigh = 2.2, mie = 0.006, mieG = 0.78 } = {}) {
  const sunE = sunIntensity(sun.y);
  const betaR = totalRayleigh.map((v) => v * rayleigh);
  const c = 0.2 * turbidity * 10e-18;
  const betaM = MieConst.map((v) => 0.434 * c * v * mie);
  const zenith = Math.acos(Math.max(0, dir.y));
  const inv = 1 / (Math.cos(zenith) + 0.15 * Math.pow(93.885 - (zenith * 180) / Math.PI, -1.253));
  const sR = 8.4e3 * inv, sM = 1.25e3 * inv;
  const Fex = [0, 1, 2].map((k) => Math.exp(-(betaR[k] * sR + betaM[k] * sM)));
  const cosT = dir.x * sun.x + dir.y * sun.y + dir.z * sun.z;
  const rPhase = (3 / (16 * Math.PI)) * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
  const g2 = mieG * mieG;
  const mPhase = (1 / (4 * Math.PI)) * ((1 - g2) / Math.pow(1 - 2 * mieG * cosT + g2, 1.5));
  const blend = Math.min(1, Math.max(0, Math.pow(1 - sun.y, 5)));
  const L = [0, 1, 2].map((k) => {
    const ratio = (betaR[k] * rPhase + betaM[k] * mPhase) / (betaR[k] + betaM[k]);
    let lin = Math.pow(sunE * ratio * (1 - Fex[k]), 1.5);
    lin *= 1 + (Math.pow(sunE * ratio * Fex[k], 0.5) - 1) * blend;
    return (lin + 0.1 * Fex[k]) * 0.04;
  });
  return { L, Fex };
}

/**
 * The sky's radiance toward `dir`, as the room sees it: Preetham's colours with
 * their range compressed (luminance to the power 0.6: the model's glow around
 * a low sun is ~500x its zenith, which would drown the room), and Cairo's dust
 * warming the band near the horizon.
 */
export function skyRadiance(dir, sun, { skyScale = 0.42, dust = [1.0, 0.9, 0.76], ...air } = {}) {
  const L = preetham(dir, sun, air).L;
  const lum = 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2];
  const k = (Math.pow(Math.max(lum, 1e-6), 0.6) / Math.max(lum, 1e-6)) * skyScale;
  const w = 0.6 * Math.pow(1 - Math.max(0, dir.y), 3);
  const c = L.map((v) => v * k), cl = lum * k;
  return c.map((v, i) => v * (1 - w) + cl * dust[i] * w);
}

/**
 * @param sunDir  direction toward the sun (world space)
 * `sunRadiance` is the disc's brightness; its colour is a low afternoon sun's.
 */
export function skyTexture({ sunDir, sunRadiusDeg = 0.35, sunRadiance = 62000, sunColour = [1.0, 0.86, 0.68], W = 2048, H = 1024, clouds = null, ...opts } = {}) {
  const sun = sunDir.clone().normalize();
  const cosSun = Math.cos(THREE.MathUtils.degToRad(sunRadiusDeg));
  const ground = [0.19, 0.16, 0.12];
  const data = new Float32Array(W * H * 4);
  const d = new THREE.Vector3(), h = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const y = Math.sin(((j + 0.5) / H - 0.5) * Math.PI), r = Math.sqrt(Math.max(0, 1 - y * y));
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      d.set(r * Math.cos(phi), y, r * Math.sin(phi));
      let rgb;
      if (y >= 0) rgb = skyRadiance(d, sun, opts);
      else {
        // below the horizon (hidden by the ground outside, but it lights the underside of things)
        const hz = skyRadiance(h.set(d.x, 0, d.z).normalize(), sun, opts), t = Math.min(1, -y * 5);
        rgb = hz.map((v, k) => v * 0.5 * (1 - t) + ground[k] * t * 0.3);
      }
      if (y >= 0 && d.dot(sun) >= cosSun) rgb = sunColour.map((v) => v * sunRadiance);
      if (clouds && y > 0) rgb = clouds(d, sun, rgb);
      const o = (j * W + i) * 4;
      data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * What the haze does to something `distCm` away, seen toward `dir`: the
 * fraction of its own light that survives (T), and the sky's glow that takes
 * the place of the rest. Far things take this as an albedo darkened by T plus
 * an emissive glow, so the pyramids sit two kilometres back in the air, as
 * they do.
 */
export function aerial(distCm, dir, sunDir, { visibilityKm = 6, ...opts } = {}) {
  const T = Math.exp(-distCm / ((visibilityKm * 1e5) / 3));
  const h = dir.clone().setY(Math.max(0.02, dir.y)).normalize();
  const glow = skyRadiance(h, sunDir.clone().normalize(), opts).map((v) => v * (1 - T));
  return { T, glow };
}

/**
 * Dusk streaks: long thin clouds low in the sky, their undersides lit pink and
 * salmon by the sun that has just set, violet-grey away from it. For
 * skyTexture({ clouds: duskClouds() }).
 */
export function duskClouds({ seed = 3, cover = 0.55, glow = 1.0 } = {}) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const N = 256, grid = Array.from({ length: N * N }, r);
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const at = (i, j) => grid[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
  const fbm = (x, y) => { let a = 0, k = 1, w = 0.5; for (let o = 0; o < 5; o++) { a += w * vn(x * k, y * k); k *= 2.03; w *= 0.5; } return a; };
  return (d, sun, rgb) => {
    const el = Math.asin(Math.min(1, d.y));
    if (el > 0.5) return rgb;
    const az = Math.atan2(d.z, d.x);
    // streaks: stretched along the horizon, thinner and fewer higher up
    const band = Math.max(0, 1 - el / 0.5) * Math.min(1, el / 0.03);
    const n = fbm(az * 9, el * 70) * 0.7 + fbm(az * 30, el * 160) * 0.3;
    const dens = Math.max(0, Math.min(1, (n - (1 - cover)) * 3.2)) * band;
    if (dens <= 0) return rgb;
    const toSun = Math.max(0, d.x * sun.x + d.z * sun.z) / Math.max(1e-6, Math.hypot(d.x, d.z) * Math.hypot(sun.x, sun.z));
    const lum = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    const warm = [1.0, 0.55, 0.5].map((c) => c * (0.35 + 0.65 * toSun ** 2));
    const cool = [0.55, 0.5, 0.62];
    const col = warm.map((c, i) => (c + cool[i] * (1 - toSun) * 0.6) * lum * 2.2 * glow);
    return rgb.map((v, i) => v * (1 - dens) + col[i] * dens);
  };
}
