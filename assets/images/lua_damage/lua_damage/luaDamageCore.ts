/**
 * Procedural damage animation for Lua.
 *
 * Two halves:
 *  - buildLua(look) runs once on the JS thread. It turns the pixel grids from luaArt.ts into flat
 *    "runs" (x, y, width, r, g, b) per body part, with the same coloured outlines as make_sheets.py.
 *  - drawLua(painter, model, state, ...) is a worklet. It draws one frame from a continuous health
 *    value plus a few event times (hit, heal, knockout, revive). Every effect is a smooth function of
 *    time and health, so nothing ever snaps between frames the way a 4-frame sprite row does.
 *
 * The painter is a tiny interface so the same drawing code runs on a Skia canvas in the app
 * (LuaDamage.tsx) and on an HTML canvas in the web preview.
 */
import {
  PAL, HEAD, BODY, HAND_L, HAND_R, EYES, CLOTHES, SKINS, COSTUMES, FX,
  type ArtGrid, type EyeKind,
} from './luaArt';

type RGB = [number, number, number];

export interface LuaLook {
  /** palette skin id: classic | mint | strawberry | midnight | gold */
  skin?: string;
  /** clothing ids worn (one per slot; later ids win a slot) */
  items?: string[];
  /** costume id; while set, clothes are hidden and the palette skin is ignored */
  costume?: string | null;
}

/** Eye order used by the model and the renderer (index = eye id). */
export const EYE_ORDER: EyeKind[] = ['open', 'closed', 'happy', 'dot', 'dizzy', 'hurt', 'x'];
const E_OPEN = 0, E_CLOSED = 1, E_HAPPY = 2, E_DOT = 3, E_HURT = 5, E_X = 6;

export interface LuaModel {
  /** flat runs: [x, y, w, r, g, b, ...] in art pixels, origin = top-left of the head */
  back: number[]; body: number[]; handL: number[]; handR: number[];
  headBase: number[]; headTop: number[];
  /** one run list per EYE_ORDER entry */
  eyes: number[][];
  hasEyes: boolean;
  /** flat [x, y, r, g, b, h0, face, ...]: the pixel appears as health falls below h0; face cracks
   *  fade while Lua lies knocked out so the X eyes stay readable */
  crackHead: number[]; crackBody: number[];
  /** [x0, y0, x1, ground] of the standing figure */
  bounds: number[];
  headCx: number; headTopY: number; faceRight: number;
  /** colours for the bits of Lua lying on the ground after a knockout */
  debris: number[];
  /** [x, y, w, h] in art pixels: everything the animation can reach */
  view: number[];
}

/** Everything that changes from frame to frame. Times are seconds on the same clock as t. */
export interface DamageState {
  t: number;
  /** idle cycle, 0..2 (integrated so the bob slows down smoothly as Lua gets hurt) */
  phase: number;
  /** animated health 0..100 (tweens toward target) */
  health: number;
  /** the health Lua is heading to; eyes react to this one straight away */
  target: number;
  hitT: number; hitAmt: number; healT: number;
  /** time the fall starts (-1 when standing) */
  koT: number;
  /** time Lua starts getting back up (-1 when not reviving) */
  riseT: number;
  /** time the eye style last changed, for a quick blink between styles */
  eyeSwapT: number;
}

export interface Painter {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  /** radians, clockwise on screen */
  rotate(rad: number): void;
  scale(sx: number, sy: number): void;
  /** r, g, b 0..255, a 0..1 */
  rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number): void;
}

export const FALL_S = 0.55;
export const RISE_S = 0.6;
export const KO_DELAY_S = 0.2;

/** Health bands, for copy like "Lua is hurting". */
export type DamageStage = 'healthy' | 'hurting' | 'dazed' | 'damaged' | 'knockedOut';
export function damageStage(health: number): DamageStage {
  'worklet';
  if (health <= 0) return 'knockedOut';
  if (health < 30) return 'damaged';
  if (health < 50) return 'dazed';
  if (health < 70) return 'hurting';
  return 'healthy';
}

// ------------------------------------------------------------------------------------------------
// Build (JS thread)
// ------------------------------------------------------------------------------------------------

function hexRgb(h: string): RGB {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** Python's round(): halves go to the even neighbour (keeps outline colours identical to the sheets). */
function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function rgbToHsv(r: number, g: number, b: number): RGB {
  const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
  if (maxc === minc) return [0, 0, maxc];
  const range = maxc - minc;
  const s = range / maxc;
  const rc = (maxc - r) / range, gc = (maxc - g) / range, bc = (maxc - b) / range;
  let h = r === maxc ? bc - gc : g === maxc ? 2 + rc - bc : 4 + gc - rc;
  h = (((h / 6) % 1) + 1) % 1;
  return [h, s, maxc];
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  if (s === 0) return [v, v, v];
  let i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  i %= 6;
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as RGB[])[i];
}

/** Same as outline_for in make_sheets.py: a darker, richer shade of the fill an outline touches. */
export function outlineFor(c: RGB): RGB {
  const [h, s, v] = rgbToHsv(c[0] / 255, c[1] / 255, c[2] / 255);
  const [r, g, b] = hsvToRgb(h, Math.min(1, s * 1.4 + 0.25), Math.max(0.14, Math.min(v * 0.38, 0.34)));
  return [pyRound(r * 255), pyRound(g * 255), pyRound(b * 255)];
}

type Pal = Record<string, string>;
type Cells = Record<string, RGB>;   // "x,y" -> colour; later writes cover earlier ones

const RING4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RING8 = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

/** Paint one grid into cells, with art_image()'s outline rule. */
function paint(cells: Cells, rows: string[], ox: number, oy: number, pal: Pal) {
  const colour = (ch: string) => hexRgb(pal[ch] ?? PAL[ch]);
  const at = (i: number, j: number) => (j >= 0 && j < rows.length && i >= 0 && i < rows[j].length ? rows[j][i] : '.');
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      let col = colour(ch);
      if (ch === 'O') {
        for (const ring of [RING4, RING8]) {
          const near = ring.map(([dx, dy]) => at(i + dx, j + dy)).filter((c) => c !== '.' && c !== 'O');
          if (near.length) {
            let best = near[0], bestN = 0;
            for (const c of near) {
              const n = near.filter((d) => d === c).length;
              if (n > bestN) { best = c; bestN = n; }
            }
            col = outlineFor(colour(best));
            break;
          }
        }
      }
      cells[`${ox + i},${oy + j}`] = col;
    }
  });
}

function grid(cells: Cells, g: ArtGrid, pal: Pal) {
  paint(cells, g.rows, g.x, g.y, pal);
}

/** Merge cells into horizontal same-colour runs: [x, y, w, r, g, b, ...]. */
function runs(cells: Cells): number[] {
  const pts = Object.keys(cells).map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y, c: cells[k] };
  }).sort((a, b) => a.y - b.y || a.x - b.x);
  const out: number[] = [];
  for (let i = 0; i < pts.length;) {
    const p = pts[i];
    let w = 1;
    while (i + w < pts.length) {
      const q = pts[i + w];
      if (q.y !== p.y || q.x !== p.x + w || q.c[0] !== p.c[0] || q.c[1] !== p.c[1] || q.c[2] !== p.c[2]) break;
      w++;
    }
    out.push(p.x, p.y, w, p.c[0], p.c[1], p.c[2]);
    i += w;
  }
  return out;
}

function box(list: Cells[]) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const cells of list) {
    for (const k of Object.keys(cells)) {
      const [x, y] = k.split(',').map(Number);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Crack and grime pixels, in the order they appear as health drops. kind 0 = crack (a darker shade of
 * whatever it crosses), 1 / 2 = the two dirt browns. The first crack starts at the top of the head and
 * grows down; then more cracks branch off and grime builds up. They keep clear of every eye style.
 */
const CRACKS: [number, number, number, number][] = [
  // [x, y, kind, appears below this health]
  [7, 1, 0, 50], [7, 2, 0, 47], [6, 3, 0, 44], [5, 4, 0, 41],
  [2, 1, 0, 35], [3, 2, 0, 32], [4, 3, 0, 29],
  [9, 1, 1, 30], [10, 1, 2, 28], [8, 2, 1, 26],
  [3, 11, 1, 27], [8, 11, 2, 24],
  [8, 7, 0, 25], [7, 8, 0, 22],
  [1, 4, 1, 22], [0, 5, 1, 20], [1, 5, 2, 18],
  [4, 12, 2, 21], [7, 12, 1, 17], [8, 12, 2, 15],
  [3, 8, 0, 19], [2, 7, 0, 16],
  [10, 7, 1, 14], [10, 8, 1, 12], [11, 8, 2, 10],
  [5, 5, 0, 13],
  [3, 13, 1, 11], [4, 13, 2, 8],
];

export function buildLua(look: LuaLook = {}): LuaModel {
  const back: Cells = {}, body: Cells = {}, handL: Cells = {}, handR: Cells = {};
  const headBase: Cells = {}, headTop: Cells = {};
  const costume = look.costume ? COSTUMES.find((c) => c.id === look.costume) : undefined;
  let eyePal: Pal;
  let hasEyes = true;

  if (costume) {
    const pal = costume.pal;
    eyePal = pal;
    hasEyes = costume.eyes;
    const L = (z: string) => costume.layers.filter((l) => l.z === z && l.rows.some((r) => r.length));
    L('back').forEach((l) => grid(back, l, pal));
    paint(body, BODY, 0, 10, pal);
    L('body').forEach((l) => grid(body, l, pal));
    grid(handL, HAND_L, pal);
    grid(handR, HAND_R, pal);
    L('hands').forEach((l) => grid(l.x < 6 ? handL : handR, l, pal));
    paint(headBase, HEAD, 0, 0, pal);
    L('head').forEach((l) => grid(headTop, l, pal));
  } else {
    const pal = (SKINS.find((s) => s.id === look.skin) ?? SKINS[0]).pal;
    eyePal = pal;
    const worn: Record<string, (typeof CLOTHES)[number]> = {};
    for (const id of look.items ?? []) {
      const it = CLOTHES.find((c) => c.id === id);
      if (it) worn[it.slot] = it;
    }
    const none: Pal = {};                       // clothes keep their own colours on every skin
    if (worn.back) grid(back, worn.back, none);
    paint(body, BODY, 0, 10, pal);
    for (const slot of ['legs', 'top', 'feet', 'neck']) if (worn[slot]) grid(body, worn[slot], none);
    grid(handL, HAND_L, pal);
    grid(handR, HAND_R, pal);
    const sl = worn.top?.sleeves;
    if (sl) { grid(handL, sl.L, none); grid(handR, sl.R, none); }
    paint(headBase, HEAD, 0, 0, pal);
    if (worn.top?.hood) grid(headTop, worn.top.hood, none);
    for (const slot of ['face', 'head']) if (worn[slot]) grid(headTop, worn[slot], none);
  }

  const eyes = EYE_ORDER.map((k) => {
    const c: Cells = {};
    grid(c, EYES[k], eyePal);
    return runs(c);
  });

  // what each crack pixel sits on (the figure at rest, without eyes)
  const all: Cells = Object.assign({}, back, body, handL, handR, headBase, headTop);
  const crackHead: number[] = [], crackBody: number[] = [];
  for (const [x, y, kind, h0] of CRACKS) {
    const under = all[`${x},${y}`];
    if (!under) continue;                       // only on Lua itself
    const c = kind === 0 ? outlineFor(under) : FX.dirt[kind - 1];
    const face = kind === 0 && y >= 3 && y <= 8 ? 1 : 0;
    (y < 10 ? crackHead : crackBody).push(x, y, c[0], c[1], c[2], h0, face);
  }

  const b = box([back, body, handL, handR, headBase, headTop]);
  const hb = box([headBase, headTop]);
  const hx = box([headBase]);
  let faceRight = hx.x1;
  for (const k of Object.keys(headTop)) {
    const [x, y] = k.split(',').map(Number);
    if (y >= 3 && y <= 7) faceRight = Math.max(faceRight, x + 1);
  }
  const fills = [all['5,6'], all['4,12']].filter(Boolean) as RGB[];
  const debris: number[] = [];
  for (const c of fills.length ? fills : [[207, 203, 221] as RGB]) debris.push(...c, ...outlineFor(c));

  const fw = b.x1 - b.x0, fh = b.y1 - b.y0;
  const vw = Math.max(fw + 8, fh + 10), vh = fh + 6;
  const cx = (b.x0 + b.x1) / 2;

  return {
    back: runs(back), body: runs(body), handL: runs(handL), handR: runs(handR),
    headBase: runs(headBase), headTop: runs(headTop), eyes, hasEyes,
    crackHead, crackBody,
    bounds: [b.x0, b.y0, b.x1, b.y1],
    headCx: (hx.x0 + hx.x1) / 2, headTopY: hb.y0, faceRight,
    debris,
    view: [cx - vw / 2 + 0.75, b.y0 - 5, vw, vh],
  };
}

// ------------------------------------------------------------------------------------------------
// Draw (worklet: runs on the UI thread in the app)
// ------------------------------------------------------------------------------------------------

function clamp(v: number, a: number, b: number) {
  'worklet';
  return v < a ? a : v > b ? b : v;
}

/** 0 while health >= from, 1 once health <= to, smooth in between. */
function ramp(h: number, from: number, to: number) {
  'worklet';
  const u = clamp((from - h) / (from - to), 0, 1);
  return u * u * (3 - 2 * u);
}

function frac(v: number) {
  'worklet';
  return v - Math.floor(v);
}

function easeOutBack(u: number) {
  'worklet';
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

// 2D affine matrix [a, b, c, d, e, f] (x' = a x + c y + e, y' = b x + d y + f), kept in step with the
// painter so particles can be launched from points on the figure.
function mT(m: number[], x: number, y: number) {
  'worklet';
  return [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function mR(m: number[], r: number) {
  'worklet';
  const c = Math.cos(r), s = Math.sin(r);
  return [m[0] * c + m[2] * s, m[1] * c + m[3] * s, -m[0] * s + m[2] * c, -m[1] * s + m[3] * c, m[4], m[5]];
}
function mS(m: number[], sx: number, sy: number) {
  'worklet';
  return [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
}
function mApply(m: number[], x: number, y: number) {
  'worklet';
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Tip-over transform for a given angle, applied to both the painter (if given) and a matrix. */
function tipOver(P: Painter | null, m: number[], bounds: number[], angDeg: number, down: number) {
  'worklet';
  if (angDeg === 0) return m;
  const x0 = bounds[0], y0 = bounds[1], x1 = bounds[2], G = bounds[3];
  const rad = (angDeg * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const Cx = (x0 + x1) / 2, Cy = G - (G - y0) / 2;
  let low = -1e9;                                     // keep the lowest corner on the ground
  const xs = [x0 - Cx, x1 - Cx], ys = [y0 - Cy, G - Cy];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) low = Math.max(low, xs[i] * s + ys[j] * c);
  const tx = Cx + 1.5 * down, ty = G - low;
  if (P) { P.translate(tx, ty); P.rotate(rad); P.translate(-Cx, -Cy); }
  return mT(mR(mT(m, tx, ty), rad), -Cx, -Cy);
}

interface Tone { desat: number; flash: number }

function px(P: Painter, k: Tone, x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number) {
  'worklet';
  if (a <= 0.004) return;
  if (k.desat > 0) {
    const grey = 0.3 * r + 0.59 * g + 0.11 * b;
    r += (grey - r) * k.desat; g += (grey - g) * k.desat; b += (grey - b) * k.desat;
  }
  if (k.flash > 0) {
    r += (255 - r) * k.flash; g += (255 - g) * k.flash; b += (255 - b) * k.flash;
  }
  P.rect(x, y, w, h, r, g, b, a > 1 ? 1 : a);
}

function drawRuns(P: Painter, k: Tone, list: number[], dx: number, dy: number) {
  'worklet';
  for (let i = 0; i < list.length; i += 6) {
    px(P, k, list[i] + dx, list[i + 1] + dy, list[i + 2], 1, list[i + 3], list[i + 4], list[i + 5], 1);
  }
}

function drawCracks(P: Painter, k: Tone, list: number[], h: number, dy: number, down: number) {
  'worklet';
  for (let i = 0; i < list.length; i += 7) {
    let a = clamp((list[i + 5] - h) / 3, 0, 1);      // each pixel pops in over 3 health points
    if (list[i + 6]) a *= 1 - down;
    if (a > 0) px(P, k, list[i], list[i + 1] + dy, 1, 1, list[i + 2], list[i + 3], list[i + 4], a);
  }
}

/** Small shaded smoke/dust puff (the plus_puff shape), u = size of one cell in art px. */
function puff(P: Painter, k: Tone, x: number, y: number, u: number, a: number) {
  'worklet';
  const S = FX.smoke;
  const cells = [1, 1, 0, 1, 0, 1, 0, 1, 1, 2, 1, 2, 1, 2, 3];
  for (let i = 0; i < cells.length; i += 3) {
    const c = S[cells[i + 2]];
    px(P, k, x + (cells[i] - 1.5) * u, y + (cells[i + 1] - 1.5) * u, u, u, c[0], c[1], c[2], a);
  }
}

/** Four-armed sparkle (dazed stars, heal sparkles). */
function sparkle(P: Painter, k: Tone, x: number, y: number, u: number, c: number[], a: number, centre: boolean) {
  'worklet';
  px(P, k, x - u / 2, y - 1.5 * u, u, u, c[0], c[1], c[2], a);
  px(P, k, x - u / 2, y + u / 2, u, u, c[0], c[1], c[2], a);
  px(P, k, x - 1.5 * u, y - u / 2, u, u, c[0], c[1], c[2], a);
  px(P, k, x + u / 2, y - u / 2, u, u, c[0], c[1], c[2], a);
  if (centre) px(P, k, x - u / 2, y - u / 2, u, u, c[0], c[1], c[2], a);
}

function stars(P: Painter, k: Tone, m: LuaModel, t: number, headDy: number, w: number, front: boolean) {
  'worklet';
  const top = m.headTopY + headDy - 2.2;
  for (let i = 0; i < 3; i++) {
    const ang = t * 2.2 + (i * 2 * Math.PI) / 3;
    const s = Math.sin(ang);
    if (front !== s >= 0) continue;                    // the far half of the orbit goes behind Lua
    const depth = 0.8 + 0.2 * (s + 1) / 2;
    sparkle(P, k, m.headCx + Math.cos(ang) * 6.5, top + s * 1.4, 0.5 * depth, FX.star, w * (front ? 1 : 0.8), false);
  }
}

function eyeFor(target: number) {
  'worklet';
  if (target >= 70) return E_OPEN;
  if (target >= 50) return E_HURT;
  if (target >= 30) return E_DOT;
  return E_HURT;
}

/**
 * Draw one frame. scale = screen px per art px; (ox, oy) = screen position of art (0, 0).
 */
export function drawLua(P: Painter, m: LuaModel, s: DamageState, scale: number, ox: number, oy: number) {
  'worklet';
  const t = s.t;
  const h = clamp(s.health, 0, 100);
  const dmg = 1 - h / 100;
  const bounds = m.bounds;
  const x0 = bounds[0], y0 = bounds[1], x1 = bounds[2], G = bounds[3];
  const cx = (x0 + x1) / 2;

  // ---- knockout: tip over with gravity, a little settle, and back up again on revive
  let ang = 0;
  let landed = -1;                                    // seconds since hitting the ground
  if (s.koT >= 0) {
    const u = (t - s.koT) / FALL_S;
    if (u >= 1) {
      landed = t - s.koT - FALL_S;
      ang = 90 - 9 * Math.exp(-landed * 6) * Math.abs(Math.sin(landed * 13));
    } else if (u > 0) ang = 90 * u * u;
  } else if (s.riseT >= 0) {
    const u = (t - s.riseT) / RISE_S;
    if (u < 1) ang = 90 * (1 - easeOutBack(clamp(u, 0, 1)));
  }
  const down = clamp(ang / 90, 0, 1);
  const standing = 1 - down;
  const falling = s.koT >= 0 && t >= s.koT;

  // ---- how strongly each damage effect shows (all smooth in health)
  const hurtW = ramp(h, 72, 62) * standing;
  const dazedW = ramp(h, 52, 45) * (1 - ramp(h, 28, 20)) * standing;
  const heavyW = ramp(h, 32, 20) * standing;
  let smokeW = ramp(h, 18, 6) * standing;
  if (landed >= 0) smokeW = Math.max(smokeW, clamp(landed / 0.6, 0, 1));

  // ---- idle motion: a bob that gets heavier and slower, a sag, a daze sway, drooping hands
  const ph = s.phase * Math.PI * 2;
  const bobY = (1 - Math.cos(ph)) * (0.12 + 0.2 * dmg) * standing;
  const headDy = bobY + 0.5 * ramp(h, 60, 5);
  const sway = 0.3 * dazedW * Math.sin(ph / 2);
  const lively = (1 - dmg) * standing;
  const droop = 0.35 * ramp(h, 50, 10);
  const handL = Math.sin(ph) * 0.16 * lively + droop;
  const handR = -Math.sin(ph) * 0.1 * lively + droop;

  // ---- hit: white flash, a shake that dies away, squash at the feet
  let shake = 0, flash = 0, sy = 1;
  const ht = t - s.hitT;
  if (ht >= 0 && ht < 0.5) {
    const u = ht / 0.5;
    shake = Math.sin(ht * 50) * (0.35 + 1.2 * s.hitAmt) * (1 - u) * (1 - u);
    flash = ht < 0.18 ? 0.85 * (1 - ht / 0.18) : 0;
    sy = 1 - (0.05 + 0.1 * s.hitAmt) * Math.exp(-ht * 9) * Math.cos(ht * 24);
  }
  // ---- heal: a hop and happy eyes
  const et = t - s.healT;
  const hop = et >= 0 && et < 0.5 ? -1.6 * Math.sin((Math.PI * et) / 0.5) : 0;

  const k: Tone = { desat: 0.4 * ramp(h, 45, 0), flash };

  // ---- eyes
  let eye = eyeFor(s.target);
  if (falling) eye = E_X;
  else if (s.koT >= 0) eye = E_HURT;
  else {
    if (et >= 0 && et < 0.7) eye = E_HAPPY;
    if (eye === E_OPEN && frac(t / 3.6) > 0.965) eye = E_CLOSED;   // idle blink
    const st = t - s.eyeSwapT;
    if (st >= 0 && st < 0.1) eye = E_CLOSED;                         // blink between eye styles
  }

  // ================= figure =================
  P.save();
  P.translate(ox, oy);
  P.scale(scale, scale);
  P.save();
  let M = [1, 0, 0, 1, 0, 0];
  const tx = shake + sway;
  P.translate(tx, hop);
  M = mT(M, tx, hop);
  M = tipOver(P, M, bounds, ang, down);
  if (sy !== 1) {
    const sx = 1 + (1 - sy) * 0.9;
    P.translate(cx, G); P.scale(sx, sy); P.translate(-cx, -G);
    M = mT(mS(mT(M, cx, G), sx, sy), -cx, -G);
  }

  if (dazedW > 0.01) stars(P, k, m, t, headDy, dazedW, false);
  drawRuns(P, k, m.back, 0, 0);
  drawRuns(P, k, m.body, 0, 0);
  drawRuns(P, k, m.handL, 0, handL);
  drawRuns(P, k, m.handR, 0, handR);
  drawRuns(P, k, m.headBase, 0, headDy);
  if (m.hasEyes) drawRuns(P, k, m.eyes[eye], 0, headDy);
  drawRuns(P, k, m.headTop, 0, headDy);
  drawCracks(P, k, m.crackHead, h, headDy, down);
  drawCracks(P, k, m.crackBody, h, 0, 0);
  if (dazedW > 0.01) stars(P, k, m, t, headDy, dazedW, true);

  if (hurtW > 0.01) {                                  // sweat drop sliding down the side of the face
    const c = frac(t / 1.6);
    const a = hurtW * (c < 0.1 ? c / 0.1 : c < 0.7 ? 1 : 1 - (c - 0.7) / 0.3);
    const sx = m.faceRight + 0.2, syy = 3.5 + c * 3 + headDy;
    const sw = FX.sweat;
    px(P, k, sx, syy, 0.5, 0.5, sw[0], sw[1], sw[2], a);
    px(P, k, sx, syy + 0.5, 0.5, 0.5, sw[0], sw[1], sw[2], a);
    px(P, k, sx - 0.5, syy + 0.5, 0.5, 0.5, sw[0], sw[1], sw[2], a * 0.8);
  }
  P.restore();

  // ================= world particles (not tipped with the figure) =================
  const plain: Tone = { desat: 0, flash: 0 };

  if (heavyW > 0.01) {                                // chips crumbling off and falling to the ground
    const chips = [-0.4, 6.5, -0.5, 12.4, 9.0, 0.5, 11.0, 2.5, 0.6, 1.0, 3.5, -0.6];
    for (let i = 0; i < 4; i++) {
      const c = frac(t * 0.5 + i * 0.27);
      const more = i < 2 ? 1 : ramp(h, 24, 12);
      const p0 = mApply(M, chips[i * 3], chips[i * 3 + 1] + (chips[i * 3 + 1] < 10 ? headDy : 0));
      const yy = p0[1] + (G - 0.6 - p0[1]) * c * c;
      const xx = p0[0] + chips[i * 3 + 2] * c * 3;
      const a = heavyW * more * (c < 0.8 ? 1 : (1 - c) / 0.2);
      const d = FX.dirt[i % 2];
      const sz = i % 2 ? 0.5 : 0.75;
      px(P, plain, xx, yy, sz, sz, d[0], d[1], d[2], a);
    }
  }

  if (smokeW > 0.01) {                                 // smoke rising from the top crack / the head
    let o = mApply(M, 7, 1 + headDy);
    if (landed >= 0 || down > 0.5) {               // lying down: rise off the side of the head
      const hp = mApply(M, m.headCx, m.headTopY + 3);
      o = [hp[0], Math.min(hp[1], G - (x1 - x0) + 0.5)];
    }
    for (let i = 0; i < 3; i++) {
      const c = frac(t * 0.42 + i / 3);
      const xx = o[0] + (i % 2 ? 0.4 : -0.4) + c * 1.6 + Math.sin(c * 6 + i) * 0.3;
      const yy = o[1] - 1 - c * 6;
      puff(P, plain, xx, yy, 0.4 + 0.4 * c, smokeW * Math.sin(Math.PI * c) * 0.9);
    }
  }

  const st = t - s.hitT;                               // sparks off the head on a hit
  if (st >= 0 && st < 0.5) {
    const n = 4 + Math.round(4 * s.hitAmt);
    const ox2 = m.headCx, oy2 = m.headTopY - 0.3;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
      const v = 8 + (i % 3) * 2.5;
      const sz = st < 0.08 ? 1 : 0.5;
      const c = FX.spark[i % 3];
      px(P, plain, ox2 + Math.cos(a) * v * st * 1.3 - sz / 2, oy2 + Math.sin(a) * v * st + 16 * st * st,
        sz, sz, c[0], c[1], c[2], 1 - st / 0.5);
    }
  }

  // lying-down positions, for dust and debris (fixed, so they don't slide while Lua gets up)
  const L = tipOver(null, [1, 0, 0, 1, 0, 0], bounds, 90, 1);
  const feet = mApply(L, cx, G);
  const head = mApply(L, m.headCx, m.headTopY);
  const mid = mApply(L, cx, (y0 + G) / 2);

  if (landed >= 0 && landed < 0.7) {                   // dust puffs where Lua hits the ground
    const a = (1 - landed / 0.7) * 0.9;
    for (let j = 0; j < 2; j++) {
      puff(P, plain, feet[0] - 0.6 - landed * 5 - j * 1.2, G - 0.7 - landed * 1.2 - j * 0.5, 0.45 + landed * 0.5, a);
      puff(P, plain, head[0] + 0.6 + landed * 5 + j * 1.2, G - 0.7 - landed * 1.2 - j * 0.5, 0.45 + landed * 0.5, a);
    }
  }

  let debrisA = 0, spread = 1;
  if (landed >= 0) { debrisA = 1; spread = clamp(landed / 0.35, 0, 1); }
  else if (s.riseT >= 0 && s.koT < 0) debrisA = 1 - clamp((t - s.riseT) / 0.35, 0, 1);
  if (debrisA > 0) {                                   // bits of Lua scattered on the ground
    const xs = [feet[0] - 1.6, feet[0] - 3.0, head[0] + 1.0, head[0] + 2.4, mid[0] - 0.5];
    const D = m.debris;
    const nc = D.length / 6;
    for (let i = 0; i < xs.length; i++) {
      const p = clamp(spread * 1.25 - i * 0.06, 0, 1);
      const xx = mid[0] + (xs[i] - mid[0]) * p;
      const yy = G - 0.5 - Math.sin(Math.PI * p) * 1.8;
      const o = (i % nc) * 6;
      px(P, plain, xx, yy, 0.5, 0.5, D[o], D[o + 1], D[o + 2], debrisA);
      if (i % 3 === 0) px(P, plain, xx + 0.5, yy, 0.5, 0.5, D[o + 3], D[o + 4], D[o + 5], debrisA);
      if (i % 4 === 1) px(P, plain, xx, yy - 0.5, 0.5, 0.5, D[o], D[o + 1], D[o + 2], debrisA);
    }
  }

  if (et >= 0 && et < 0.9 && !falling) {               // heal sparkles drifting up
    const spots = [-2.0, 8.0, 13.6, 6.0, -1.2, 2.0, 13.0, 11.5];
    for (let i = 0; i < 4; i++) {
      const u = clamp(et / 0.9 - i * 0.06, 0, 1);
      const p = mApply(M, spots[i * 2], spots[i * 2 + 1] - u * 3);
      sparkle(P, plain, p[0], p[1], 0.5, FX.heal[i % 2], Math.sin(Math.PI * u), true);
    }
  }

  P.restore();
}
