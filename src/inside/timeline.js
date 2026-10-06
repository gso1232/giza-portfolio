// The reference's timeline (illoca.unseen.co, its Theatre.js project "main", sheet "Home"), as its own
// state file has it: every track the film runs on, keyed on one sequence position S (seconds, 0..27.47).
// The page's scroll moves S: section by section, linearly, from one camera keyframe to the next (their
// `scrollProgress:N` triggers, N = 0..10); every other track is read at that same S. A value between two
// keyframes follows a cubic bezier made of the left one's out-handle and the right one's in-handle
// (Theatre's `handles` = [inX, inY, outX, outY]); a 'hold' keyframe keeps its value till the next.
//   [position, value, [inX, inY, outX, outY], type?]

export const LENGTH = 27.47;
export const CAMERA_CLIP = 45.833333;            // main_camera_action, seconds

export const TRACKS = {
  // the camera: the clip's time, as a share of it (0..1)
  camera: [[2.133, 0, [.5, 1, .5, .5]], [5.667, .05, [.5, .5, .5, .5]], [7.367, .15, [.5, .5, .5, .5]], [9.467, .177, [.5, .5, .321, .144]],
    [11.733, .41, [.515, .955, .5, .5]], [13.967, .41, [.5, .5, .5, .5]], [16.1, .5, [.5, .5, .5, .5]], [18.167, .5, [.5, .5, .5, .5]],
    [20.167, .71, [.5, .5, .5, .5]], [21.533, .71, [.5, .5, .5, .5]], [22.933, .83, [.5, .5, .5, .5]], [25.133, .97, [.5, .5, .5, 0]]],
  // the camera's dolly at the opening, along its own z (m), and the distance it pivots about with the pointer
  cameraZTranslate: [[0, 1.27, [.5, 1, .25, .46]], [2.133, 0, [.45, .94, .5, 0]]],
  cameraPivotOffset: [[2.133, 5, [.5, 1, .5, 0]], [7.433, 1.75, [.5, 1, .5, 0]], [11.8, 1.64, [.5, 1, .5, 0]], [16.133, 1.35, [.5, 1, .5, 0]],
    [20.1, .98, [.5, 1, .5, 0]], [21.567, .98, [.5, 1, .5, 0]], [22.933, 2.19, [.5, 1, .5, 0]]],
  // the people: each its clip's time as a share (human_01 36.917 s, human_02 42.042 s, human_03_01 5.625 s)
  human1: [[2.167, .18, [.5, 1, .5, .5]], [6, .3, [.5, .5, .5, .5]], [6.967, .43, [.5, .5, .5, 0]], [8.067, .43, [.5, 1, .5, .5]],
    [9.267, .5169353642569531, [.5, .5, .5, 0]], [10.033, .7, [.68, .53, .5, 0]]],
  human2: [[17.467, 0, [.5, 1, .25, .46]], [19, .6786075154771504, [.5, 1, .25, .46]], [20.133, .77, [.45, .94, .5, 0]]],
  human2Visible: [[17.7, 0, [.5, 1, .5, 0]], [18.067, 1, [.5, 1, .5, 0]]],
  human3: [[22.467, 0, [.5, 1, .5, 0]], [23.8, 1, [.5, 1, .5, 0]]],
  human3Visible: [[21.433, 0, [.5, 1, .5, 0]], [21.633, 1, [.5, 1, .5, 0]]],
  // the sketch on the desk (their paper_top): the pointer's reveal, its radius, the wipe, the grid
  revealOn: [[6.433, 0, [.5, 1, .455, .03]], [6.833, 1, [.515, .955, .5, 0]]],
  raycasting: [[6.333, 0, [.5, 1, .5, 0], 'hold'], [6.467, 1, [.5, 1, .5, 0], 'hold'], [9.1, 0, [.5, 1, .5, 0]]],
  wipe: [[10.2, 0, [.5, 1, .5, 0]], [11.067, 1, [.5, 1, .5, 0]]],
  radius: [[8.567, .14, [.5, 1, .5, 0]], [9.267, .7150000000000003, [.5, 1, .5, 0]]],
  grid: [[21.767, 0, [.5, 1, .5, 0]], [22.133, 1, [.5, 1, .5, 0]]],
  // the plan under it (paper: paper_action 3.25 s; its video), the second sheet unrolling (paper_roll 2.417 s)
  paper: [[18.1, 0, [.5, 1, .5, 0]], [18.9, 1, [.5, 1, .5, 0]]],
  paperVideo: [[18.867, 0, [.5, 1, .5, 0]], [19.5, 1, [.5, 1, .5, 0]]],
  paperRoll: [[9.267, 0, [.5, 1, .5, 0]], [10.333, 1, [.5, 1, .5, 0]]],
  // the sketchbook's cover opening (book_cover_action 1 s), its swatches taking colour
  bookCover: [[22.367, 0, [.5, 1, .5, 0]], [23.1, 1, [.5, 1, .5, 0]]],
  bookSwatch: [[23.233, 0, [.5, 1, .5, 0]], [23.567, 1, [.5, 1, .5, 0]]],
  // the building: building_animation's time as a share (0.25 .. 21.333 s)
  building: [[10.5, 0, [.5, 1, .5, .5]], [12.367, .18729999999999983, [.5, .5, .5, .5]], [14.5, .18729999999999983, [.5, .5, .5, .5]],
    [16.567, .258, [.5, 1, .5, 0]], [17.6, .258, [.5, .5, .55, .085]], [18.3, .4039999999999984, [.68, .53, .5, .5]],
    [19.167, .55, [.5, .5, .18, .335]], [21.167, .7387456948482378, [.5, 1, .5, .5]], [21.5, .7387456948482378, [.5, 1, .5, 0]],
    [22.333, .8424430493448029, [.5, .5, .5, .5]], [24.033, 1, [.5, .5, .5, 0]]],
  treesVisible: [[9.433, 0, [.5, 1, .5, 0]], [9.6, 1, [.5, 1, .5, 0]], [11.267, 1, [.5, 1, .5, 0]]],
  // its rooms (office_layout) taking the accent, then gone; its massing lightening, then back; the facades
  // giving way to the morphs
  officeTint: [[17.533, 0, [.5, 1, .5, 0]], [18.2, 1, [.5, 1, .5, 0]]],
  officeVisible: [[22.7, 1, [.5, 1, .5, 0]], [22.8, 0, [.5, 1, .5, 0]]],
  massLight: [[15, 0, [.5, 1, .5, 0]], [16, 1, [.5, 1, .5, 0]], [22.2, 1, [.5, 1, .5, 0]], [23.067, 0, [.5, 1, .5, 0]]],
  facadesVisible: [[0, 1, [.5, 1, .5, 0]], [23.067, 0, [.5, 1, .5, 0]]],
  morphVisible: [[0, 0, [.5, 1, .5, 0]], [23.067, 1, [.5, 1, .5, 0]], [25.833, 1, [.5, 1, .5, 0]]],
  morphEdges: [[23.367, .5, [.5, 1, .5, 0]], [23.8, 0, [.5, 1, .5, 0]]],
  // the sun (its position; it looks at (0.9, 0.1, -0.4))
  sunX: [[0, -5.21, [.5, 1, .39, .575]], [2.133, -10.2, [.565, 1, .5, 0]]],
  sunY: [[0, 5.33, [.5, 1, .39, .575]], [2.133, 8, [.565, 1, .5, 0]], [23.333, 7.23, [.5, 1, .5, 0]]],
  sunZ: [[0, 6.81, [.5, 1, .39, .575]], [2.133, 5.7, [.565, 1, .5, 0]], [23.333, 18.73, [.5, 1, .5, 0]]],
};

// their constants (static overrides of the Home sheet)
export const STATIC = {
  sunTarget: [0.9, 0.1, -0.4],
  diffuseThreshold: 0.135, diffuseSmoothness: 0.006,
  focalLength: 50,                               // (three's default film gauge, 35)
  pivot: { strength: 1, angle: [0.05, 0.05], lerp1: 0.019, lerp2: 0.021, roll: 0 },
  reveal: { radius: 0.14, smoothness: 0.091, expand: 1 },
  outline: 0.6,
};

// the scroll's segments: camera keyframe k to k+1, over trigger N = k
export const SEGMENTS = TRACKS.camera.slice(0, -1).map((k, i) => [k[0], TRACKS.camera[i + 1][0]]);

// ---- evaluating a track at S ---------------------------------------------------------------------------
function bezierY(x1, y1, x2, y2, x) {
  // the y of a CSS-style cubic-bezier at x (Newton on t, then bisection)
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
  let lo = 0, hi = 1; t = x;
  for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
  return Y(t);
}
export function at(track, S) {
  const k = TRACKS[track] ?? track;
  if (S <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i], b = k[i + 1];
    if (S < b[0]) {
      if (a[3] === 'hold') return a[1];
      const x = (S - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * bezierY(a[2][2], a[2][3], b[2][0], b[2][1], x);
    }
  }
  return k[k.length - 1][1];
}
