/**
 * Unlock-path previews, drawn live like the lua-xp-rewards prototype: each milestone shows
 * Lua wearing only that item (or in that skin), posed by a smooth function of time with its
 * own rhythm, plus the item's weather (snow, wind, rain, notes, twinkles).
 *
 * Layer bitmaps are built once on the JS thread; every frame is then recorded into one
 * picture on the UI thread (`drawPreviews`), so all previews cost a single canvas redraw.
 */
import {
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  type SkCanvas,
} from "@shopify/react-native-skia";

import {
  BODY,
  EYES,
  HAND_L,
  HAND_R,
  HEAD,
  ITEM_ART,
  makeLayer,
  PAL,
  SKIN_PAL,
  type EyeKey,
  type Layer,
} from "@/components/achievements/luaArt";
import type { ItemId, PaletteSkinId, Reward } from "@/constants/luaSprites";

// ------------------------------------------------------------------ preview models

type PoseId = ItemId | "skin";
type ItemPlace = "back" | "body" | "head";

/** Everything one preview needs to draw itself; built on the JS thread, read in worklets. */
export type PreviewModel = {
  pose: PoseId;
  /** Top-left of the preview's drawing area in the shared canvas, and its square size. */
  left: number;
  top: number;
  size: number;
  /** dp per art pixel. */
  P: number;
  lift: number;
  place: ItemPlace | null;
  head: Layer | null;
  body: Layer | null;
  handL: Layer | null;
  handR: Layer | null;
  eyes: Record<EyeKey, Layer | null>;
  item: Layer | null;
  hood: Layer | null;
  sleeveL: Layer | null;
  sleeveR: Layer | null;
};

/**
 * A preview for one reward. Item previews follow the palette skin in use; a skin reward
 * shows that skin. Sizing matches the prototype: the figure plus its hat fills the box.
 */
export function makePreviewModel(
  reward: Reward,
  baseSkin: PaletteSkinId,
  left: number,
  top: number,
  size: number,
  dpr: number,
): PreviewModel {
  const it = reward.kind === "item" ? ITEM_ART[reward.id] : null;
  const skin = reward.kind === "skin" ? reward.id : baseSkin;
  const pal = SKIN_PAL[skin];
  const rows = 16 + (it ? (it.lift ?? 0) + Math.max(0, -it.y) : 0);
  const P = Math.max(2, size / (rows + 6));
  const s = Math.max(1, Math.round(P * dpr));
  const place: ItemPlace | null = !it
    ? null
    : it.slot === "face" || it.slot === "head"
      ? "head"
      : it.slot === "back"
        ? "back"
        : "body";

  return {
    pose: reward.kind === "item" ? reward.id : "skin",
    left,
    top,
    size,
    P,
    lift: it?.lift ?? 0,
    place,
    head: makeLayer(HEAD, s, pal, skin),
    body: makeLayer(BODY, s, pal, skin),
    handL: makeLayer(HAND_L, s, pal, skin),
    handR: makeLayer(HAND_R, s, pal, skin),
    eyes: {
      open: makeLayer(EYES.open, s, pal, skin),
      closed: makeLayer(EYES.closed, s, pal, skin),
      happy: makeLayer(EYES.happy, s, pal, skin),
    },
    item: it ? makeLayer(it, s) : null,
    hood: it?.hood ? makeLayer(it.hood, s) : null,
    sleeveL: it?.sleeves ? makeLayer(it.sleeves.L, s) : null,
    sleeveR: it?.sleeves ? makeLayer(it.sleeves.R, s) : null,
  };
}

// ------------------------------------------------------------------ poses

type Pose = {
  y?: number;
  sy?: number;
  dx?: number;
  eyes?: EyeKey;
  look?: number;
  handDy?: number;
  handL?: number;
  handR?: number;
  headRot?: number;
  headDy?: number;
  itemDx?: number;
  glint?: number;
  snow?: boolean;
  wind?: boolean;
  rain?: boolean;
  notes?: boolean;
  twinkle?: boolean;
};

/** u in 0..1 over one hop: squash, rise, fall, squash. */
function hopCurve(u: number, h: number): { y: number; sy: number } {
  "worklet";
  if (u < 0.12) return { y: 0, sy: 1 - 0.09 * Math.sin((u / 0.12) * Math.PI) };
  if (u < 0.8) {
    const k = (u - 0.12) / 0.68;
    return { y: -h * Math.sin(k * Math.PI), sy: 1 + 0.05 * Math.cos(k * Math.PI) * 0.6 };
  }
  return { y: 0, sy: 1 - 0.09 * Math.sin(((u - 0.8) / 0.2) * Math.PI) };
}

/** One small pose per item; every value is a smooth function of time so the loop never pops. */
function poseFor(id: PoseId, t: number, P: number): Pose {
  "worklet";
  const TAU = Math.PI * 2;
  switch (id) {
    case "sneakers": { // happy little hops to show off the shoes
      const h = hopCurve((t % 0.7) / 0.7, 1.8 * P);
      return { y: h.y, sy: h.sy, eyes: h.y < -0.5 * P ? "happy" : "open", handDy: h.y * 0.12 };
    }
    case "jeans": { // confident side-to-side strut
      const a = Math.sin((t * TAU) / 1.6);
      return { dx: a * 0.45 * P, headRot: a * 0.05, look: a > 0.3 ? 1 : a < -0.3 ? -1 : 0,
        handL: -Math.abs(a) * 0.3 * P, handR: -Math.abs(a) * 0.3 * P,
        y: -Math.abs(Math.sin((t * TAU) / 0.8)) * 0.35 * P };
    }
    case "shades": { // cool nod, then a glint slides across the lenses
      const ph = t % 2.6;
      const nod = ph < 1.2 ? Math.sin((ph / 1.2) * TAU) : 0;
      return { headDy: Math.max(0, nod) * 0.35 * P, headRot: -0.04 + nod * 0.02,
        glint: ph > 1.4 && ph < 2.2 ? (ph - 1.4) / 0.8 : -1 };
    }
    case "beanie": { // shivers in the snow, then gets cosy
      const ph = t % 3;
      const shiver = ph < 1.1 ? Math.sin(ph * 70) * 0.12 * P * Math.sin((ph / 1.1) * Math.PI) : 0;
      return { dx: shiver, eyes: ph < 1.1 ? "closed" : "happy", snow: true, handDy: ph < 1.1 ? -0.15 * P : 0 };
    }
    case "scarf": { // leans into the wind, scarf flapping
      const a = Math.sin((t * TAU) / 2.2);
      return { headRot: 0.05 + a * 0.03, itemDx: Math.sin(t * 9) * 0.18 * P, eyes: "closed", wind: true,
        handDy: a * 0.1 * P };
    }
    case "crown": { // proud bounce with twinkles round the crown
      const u = (t % 1.6) / 1.6;
      const h = u < 0.55 ? hopCurve(u / 0.55, 1.2 * P) : { y: 0, sy: 1 };
      return { y: h.y, sy: h.sy, eyes: "happy", twinkle: true };
    }
    case "cap": { // looks one way, then the other, with a little nod
      const a = Math.sin((t * TAU) / 2.4);
      return { look: a > 0.35 ? 1 : a < -0.35 ? -1 : 0, headRot: a * 0.04, headDy: Math.abs(a) * 0.15 * P };
    }
    case "shorts": { // jogging on the spot
      const a = Math.sin((t * TAU) / 0.6);
      return { y: -Math.abs(a) * 0.6 * P, handL: a * 0.3 * P, handR: -a * 0.3 * P, eyes: "open" };
    }
    case "headphones": { // nodding along to the music
      const beat = Math.abs(Math.sin((t * TAU) / 1.1));
      return { headDy: beat * 0.3 * P, headRot: Math.sin((t * TAU) / 2.2) * 0.06, eyes: "closed",
        handDy: beat * 0.12 * P, notes: true };
    }
    case "boots": { // stomping in the rain
      const h = hopCurve((t % 0.8) / 0.8, 1 * P);
      return { y: h.y, sy: h.sy, eyes: h.y < -0.4 * P ? "happy" : "open", rain: true };
    }
    case "hoodie": { // cosy sway
      const a = Math.sin((t * TAU) / 2.4);
      return { dx: a * 0.2 * P, headRot: a * 0.04, eyes: Math.abs(a) > 0.6 ? "happy" : "closed" };
    }
    case "cape": { // heroic leap with the wind behind
      const u = (t % 1.8) / 1.8;
      const h = u < 0.6 ? hopCurve(u / 0.6, 1.6 * P) : { y: 0, sy: 1 };
      return { y: h.y, sy: h.sy, eyes: "happy", wind: true, handDy: h.y * 0.2 };
    }
    case "wizard": { // casting: sparkles round the hat
      const a = Math.sin((t * TAU) / 2);
      return { headRot: a * 0.05, headDy: Math.max(0, a) * 0.15 * P, eyes: "happy", twinkle: true };
    }
    default: { // a skin reward: happy hop in the new colours
      const u = (t % 1.6) / 1.6;
      const h = u < 0.55 ? hopCurve(u / 0.55, 1.4 * P) : { y: 0, sy: 1 };
      return { y: h.y, sy: h.sy, eyes: "happy", twinkle: true };
    }
  }
}

// ------------------------------------------------------------------ drawing

const LINEAR = FilterMode.Linear;
const NO_MIPMAPS = MipmapMode.None;
const INTERSECT = ClipOp.Intersect;
const STROKE = PaintStyle.Stroke;
const FILL = PaintStyle.Fill;
const ROUND = StrokeCap.Round;

const C_WIND = Skia.Color("#7869a0");
const C_RAIN = Skia.Color("#5f96dc");
const C_SHADOW = Skia.Color("#3c325a");
const C_GLINT = Skia.Color("#ffffff");
const C_SNOW = Skia.Color("#a9b8dc");
const C_NOTE = Skia.Color(PAL.V);
const C_TWINKLE_A = Skia.Color("#e0952a");
const C_TWINKLE_B = Skia.Color(PAL.Y);

/** Matches the box's rounded corner inside its 1.5 dp border. */
const CORNER_RADIUS = 12.5;
/** The prototype's frame-to-frame cap on elapsed time, in seconds. */
export const MAX_FRAME_STEP_S = 0.05;
/** With reduced motion the prototype holds every preview on this moment of its pose. */
const REDUCED_POSE_T = 0.35;

function drawPreview(
  c: SkCanvas,
  pv: PreviewModel,
  t: number,
  reduced: boolean,
  dpr: number,
): void {
  "worklet";
  const { P, size: W } = pv;
  const H = W;
  if (!pv.head || !pv.body) return;
  const pose = poseFor(pv.pose, reduced ? REDUCED_POSE_T : t, P);
  const snp = (v: number) => Math.round(v * dpr) / dpr;
  const imgPaint = Skia.Paint();
  const put = (layer: Layer | null, ox: number, oy: number, dx = 0, dy = 0) => {
    if (!layer) return;
    c.drawImageRectOptions(
      layer.image,
      Skia.XYWHRect(0, 0, layer.image.width(), layer.image.height()),
      Skia.XYWHRect(snp(ox + layer.x * P + dx), snp(oy + layer.y * P + dy), layer.w * P, layer.h * P),
      LINEAR,
      NO_MIPMAPS,
      imgPaint,
    );
  };
  const paint = Skia.Paint();
  const fillRect = (x: number, y: number, w: number, h: number) => {
    c.drawRect(Skia.XYWHRect(snp(x), snp(y), w, h), paint);
  };

  const groundY = H * 0.86;
  const y = pose.y ?? 0, sy = pose.sy ?? 1, dx = pose.dx ?? 0;
  const ox = W / 2 - 6 * P + dx;
  const oy = groundY - (16 + pv.lift) * P + y;

  // backdrop effects
  if (pose.wind) {
    paint.setColor(C_WIND);
    paint.setAlphaf(0.45);
    paint.setStyle(STROKE);
    paint.setStrokeWidth(Math.max(1, P * 0.35));
    paint.setStrokeCap(ROUND);
    for (let k = 0; k < 3; k++) {
      const u = (t * 0.9 + k / 3) % 1;
      const yy = H * (0.25 + k * 0.17), x0 = W * (1.1 - u * 1.4);
      c.drawLine(x0, yy, x0 + W * 0.22, yy, paint);
    }
    paint.setStyle(FILL);
  }
  if (pose.rain) {
    paint.setColor(C_RAIN);
    for (let k = 0; k < 7; k++) {
      const u = (t * 1.1 + k / 7) % 1;
      paint.setAlphaf(0.75 * Math.sin(u * Math.PI));
      fillRect(W * ((k * 0.29 + 0.07) % 1), H * u * 0.92, Math.max(1, P * 0.35), P * 1.6);
    }
  }
  const air = Math.min(1, Math.max(0, -y / (3 * P)));
  paint.setColor(C_SHADOW);
  paint.setAlphaf(0.22 - air * 0.1);
  const rx = P * (6.4 - air * 1.6), ry = P * (1 - air * 0.25);
  const cx = W / 2 + dx * 0.5, cy = groundY + P * 0.2;
  c.drawOval(Skia.XYWHRect(cx - rx, cy - ry, 2 * rx, 2 * ry), paint);

  // the figure, squashed and stretched about its feet
  c.save();
  c.translate(W / 2, groundY + y);
  c.scale(1 + (1 - sy) * 0.9, sy);
  c.translate(-W / 2, -(groundY + y));
  if (pv.place === "back") put(pv.item, ox, oy); // the cape hangs behind the body
  put(pv.body, ox, oy);
  if (pv.place === "body") put(pv.item, ox, oy, pose.itemDx ?? 0, 0);
  const handDy = pose.handDy ?? 0;
  const hl = handDy + (pose.handL ?? 0), hr = handDy * -0.6 + (pose.handR ?? 0);
  put(pv.handL, ox, oy, 0, hl);
  put(pv.handR, ox, oy, 0, hr);
  put(pv.sleeveL, ox, oy, 0, hl);
  put(pv.sleeveR, ox, oy, 0, hr);

  c.save();
  const px = ox + 6 * P, py = oy + 9.5 * P;
  c.translate(px, py + (pose.headDy ?? 0));
  c.rotate(((pose.headRot ?? 0) * 180) / Math.PI, 0, 0);
  c.translate(-px, -py);
  put(pv.head, ox, oy);
  const ek = pose.eyes ?? "open";
  put(pv.eyes[ek], ox, oy, ek === "open" ? (pose.look ?? 0) * P : 0, 0);
  put(pv.hood, ox, oy);
  if (pv.place === "head") put(pv.item, ox, oy);
  if ((pose.glint ?? -1) >= 0) {
    // a two-pixel diagonal shine moving across each lens
    paint.setColor(C_GLINT);
    paint.setAlphaf(0.9);
    const k = Math.floor((pose.glint ?? 0) * 4);
    for (const lx of [2, 7]) {
      const gx = lx + Math.min(2, k);
      if (k < 4) {
        fillRect(ox + gx * P, oy + 5 * P, P, P);
        if (k > 0) fillRect(ox + (gx - 1) * P, oy + 6 * P, P, P);
      }
    }
  }
  c.restore();
  c.restore();

  if (pose.snow) {
    paint.setColor(C_SNOW);
    for (let k = 0; k < 7; k++) {
      const u = (t * 0.35 + k / 7) % 1;
      const sz = P * (k % 2 ? 0.7 : 0.5);
      paint.setAlphaf(0.9 * Math.sin(u * Math.PI));
      fillRect(W * ((k * 0.37 + 0.08) % 1) + Math.sin(t * 2 + k) * P * 0.8, H * (u * 0.95), sz, sz);
    }
  }
  if (pose.notes) { // two little music notes drifting up beside the head
    paint.setColor(C_NOTE);
    const NOTES = [[16, 0.5], [-5, 2.5]];
    for (let k = 0; k < NOTES.length; k++) {
      const u = (t * 0.8 + k * 0.5) % 1;
      paint.setAlphaf(Math.sin(Math.PI * (0.15 + 0.85 * u)));
      const nx = ox + NOTES[k][0] * P, ny = oy + (NOTES[k][1] - 3 * u) * P;
      fillRect(nx, ny + 2 * P, P, P);
      fillRect(nx + P / 2, ny, P / 2, 2 * P);
      fillRect(nx + P / 2, ny, P, P / 2);
    }
  }
  if (pose.twinkle) {
    const SPOTS = [[-1.5, -4.5], [13, -3], [-0.5, 1], [12.5, 2]];
    for (let k = 0; k < SPOTS.length; k++) {
      const a = Math.max(0, Math.sin(t * 3.2 + k * 1.7));
      if (a < 0.05) continue;
      const tx = ox + SPOTS[k][0] * P, ty = oy + SPOTS[k][1] * P, r = P * (0.5 + a * 0.6);
      paint.setColor(k % 2 ? C_TWINKLE_B : C_TWINKLE_A);
      paint.setAlphaf(a);
      fillRect(tx - r, ty - P * 0.25, r * 2, P * 0.5);
      fillRect(tx - P * 0.25, ty - r, P * 0.5, r * 2);
    }
  }
}

/** Draws every preview, each clipped to its rounded box, into one canvas. */
export function drawPreviews(
  c: SkCanvas,
  previews: PreviewModel[],
  t: number,
  reduced: boolean,
  dpr: number,
): void {
  "worklet";
  for (const pv of previews) {
    c.save();
    c.clipRRect(
      Skia.RRectXY(Skia.XYWHRect(pv.left, pv.top, pv.size, pv.size), CORNER_RADIUS, CORNER_RADIUS),
      INTERSECT,
      true,
    );
    c.translate(pv.left, pv.top);
    drawPreview(c, pv, t, reduced, dpr);
    c.restore();
  }
}
