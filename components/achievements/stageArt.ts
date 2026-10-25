/**
 * The customize-screen avatar, animated like the lua-xp-rewards prototype: idle breathing,
 * head bob and tilt, random blinks, eyes that glide to glance around, hops with squash and
 * stretch, items that bounce down when unlocked, pop in when worn and float off when taken
 * off, a lift that eases in with shoes, and pixel confetti.
 *
 * `makeStageModel` builds the bitmaps on the JS thread. The rest are worklets run on the UI
 * thread: `stepStage` advances a mutable `StageSim` each frame and `drawStage` records it.
 */
import { FilterMode, MipmapMode, Skia, type SkCanvas } from "@shopify/react-native-skia";

import {
  BODY,
  COSTUME_ART,
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
import type { CostumeId, ItemId, PaletteSkinId, Slot } from "@/constants/luaSprites";
import type { Equipped } from "@/lib/achievementsStore";

/** Drawn with the body, under the hands. */
const SLOT_ORDER: Slot[] = ["legs", "top", "feet", "neck"];
/** Drawn on the head, over the eyes. */
const HEAD_ORDER: Slot[] = ["face", "head"];
const ALL_SLOTS: Slot[] = ["back", "legs", "top", "feet", "neck", "face", "head"];
const COSTUME_FX = "__costume";

type ItemGroup = "back" | "body" | "head";

type StageItem = {
  layer: Layer | null;
  group: ItemGroup;
  hood: Layer | null;
  sleeveL: Layer | null;
  sleeveR: Layer | null;
  lift: number;
};

type StageCostume = {
  back: Layer[];
  body: Layer[];
  handL: Layer[];
  handR: Layer[];
  head: Layer[];
  hideEyes: boolean;
};

export type StageModel = {
  W: number;
  H: number;
  /** dp per art pixel. */
  P: number;
  dpr: number;
  /** Where Lua's feet stand, in dp from the top. */
  groundY: number;
  head: Layer | null;
  body: Layer | null;
  handL: Layer | null;
  handR: Layer | null;
  eyes: Record<EyeKey, Layer | null>;
  items: Record<ItemId, StageItem>;
  costume: StageCostume | null;
};

export function makeStageModel(
  width: number,
  height: number,
  skin: PaletteSkinId,
  costume: CostumeId | null,
  dpr: number,
): StageModel {
  const P = Math.max(4, Math.floor(height / 30));
  const s = Math.max(1, Math.round(P * dpr));
  const art = costume ? COSTUME_ART[costume] : null;
  // A costume's palette recolours Lua too (the robot); otherwise the palette skin does.
  const pal = art ? art.pal : SKIN_PAL[skin];
  const palKey = art ? `costume:${costume}` : skin;

  const items = {} as Record<ItemId, StageItem>;
  for (const id of Object.keys(ITEM_ART) as ItemId[]) {
    const it = ITEM_ART[id];
    items[id] = {
      layer: makeLayer(it, s),
      group: it.slot === "face" || it.slot === "head" ? "head" : it.slot === "back" ? "back" : "body",
      hood: it.hood ? makeLayer(it.hood, s) : null,
      sleeveL: it.sleeves ? makeLayer(it.sleeves.L, s) : null,
      sleeveR: it.sleeves ? makeLayer(it.sleeves.R, s) : null,
      lift: it.lift ?? 0,
    };
  }

  let costumeLayers: StageCostume | null = null;
  if (art) {
    costumeLayers = { back: [], body: [], handL: [], handR: [], head: [], hideEyes: !!art.hideEyes };
    for (const [z, x, y, rows] of art.layers) {
      const layer = makeLayer({ rows, x, y }, s, art.pal, palKey);
      if (!layer) continue;
      const key = z === "hands" ? (x < 6 ? "handL" : "handR") : z;
      costumeLayers[key].push(layer);
    }
  }

  return {
    W: width,
    H: height,
    P,
    dpr,
    groundY: height * 0.88,
    head: makeLayer(HEAD, s, pal, palKey),
    body: makeLayer(BODY, s, pal, palKey),
    handL: makeLayer(HAND_L, s, pal, palKey),
    handR: makeLayer(HAND_R, s, pal, palKey),
    eyes: {
      open: makeLayer(EYES.open, s, pal, palKey),
      closed: makeLayer(EYES.closed, s, pal, palKey),
      happy: makeLayer(EYES.happy, s, pal, palKey),
    },
    items,
    costume: costumeLayers,
  };
}

// ------------------------------------------------------------------ simulation

type ItemFx = { start: number; drop: boolean };
type Fading = { id: ItemId; start: number };
type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; age: number; size: number; color: number;
};
/** Confetti waiting to burst: from an item's centre, or from Lua's chest when `itemId` is null. */
type PendingBurst = { at: number; itemId: ItemId | null; n: number };

export type StageSim = {
  t: number;
  nextBlink: number;
  blinkUntil: number;
  look: number;
  lookTarget: number;
  nextLook: number;
  /** Hop in progress; `hopDur` 0 means none. Heights in dp. */
  hopStart: number;
  hopDur: number;
  hopH: number;
  happyUntil: number;
  /** Art px the figure stands raised by (shoe soles), easing toward the worn shoes'. */
  lift: number;
  equipped: Equipped;
  reduced: boolean;
  itemFx: Record<string, ItemFx>;
  fading: Fading[];
  particles: Particle[];
  bursts: PendingBurst[];
};

const ITEM_LIFT = Object.fromEntries(
  (Object.keys(ITEM_ART) as ItemId[]).map((id) => [id, ITEM_ART[id].lift ?? 0]),
) as Record<ItemId, number>;

function liftFor(equipped: Equipped, costumeOn: boolean): number {
  "worklet";
  if (costumeOn || !equipped.feet) return 0;
  return ITEM_LIFT[equipped.feet] ?? 0;
}

export function makeStageSim(equipped: Equipped, costumeOn: boolean, reduced: boolean): StageSim {
  return {
    t: 0,
    nextBlink: 1.6,
    blinkUntil: 0,
    look: 0,
    lookTarget: 0,
    nextLook: 4,
    hopStart: 0,
    hopDur: 0,
    hopH: 0,
    happyUntil: 0,
    lift: liftFor(equipped, costumeOn),
    equipped: { ...equipped },
    reduced,
    itemFx: {},
    fading: [],
    particles: [],
    bursts: [],
  };
}

const ITEM_POP_S = 0.35;
const ITEM_DROP_S = 0.9;
const FADE_S = 0.35;
/** When an unlock's confetti bursts, as the dropping item lands. */
const DROP_BURST_DELAY_S = 0.52;

/** Start a hop `height` dp high and show happy eyes for `happyFor` seconds. */
export function stageHop(sim: StageSim, height: number, happyFor: number): void {
  "worklet";
  sim.hopStart = sim.t;
  sim.hopDur = sim.reduced ? 0.01 : 0.85;
  sim.hopH = height;
  sim.happyUntil = sim.t + happyFor;
}

/** Queue confetti: from `itemId`'s centre after the drop lands, or from the chest now. */
export function stageBurst(sim: StageSim, itemId: ItemId | null, n: number): void {
  "worklet";
  if (sim.reduced) return;
  sim.bursts.push({ at: sim.t + (itemId ? DROP_BURST_DELAY_S : 0), itemId, n });
}

/** Pops the costume (or skin) in, like the prototype's applySkin. */
export function stagePopLook(sim: StageSim): void {
  "worklet";
  sim.itemFx[COSTUME_FX] = { start: sim.t, drop: false };
}

/**
 * Applies a change of worn items: replaced or removed items float off, new ones pop in, or
 * bounce down from above when `dropId` is the item just unlocked.
 */
export function stageSetEquipped(
  sim: StageSim,
  next: Equipped,
  costumeOn: boolean,
  dropId: ItemId | null,
): void {
  "worklet";
  for (const slot of ALL_SLOTS) {
    const cur = sim.equipped[slot];
    const id = next[slot];
    if (cur === id) continue;
    if (cur && !costumeOn) sim.fading.push({ id: cur, start: sim.t });
    if (id) sim.itemFx[id] = { start: sim.t, drop: !sim.reduced && id === dropId };
  }
  sim.equipped = { ...next };
}

const PARTICLE_COLORS = [PAL.P, PAL.Y, "#5fb8e8", PAL.G].map((c) => Skia.Color(c));

function spawnParticles(sim: StageSim, P: number, cx: number, cy: number, n: number): void {
  "worklet";
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 130;
    sim.particles.push({
      x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
      life: 0.7 + Math.random() * 0.5, age: 0,
      size: (Math.random() < 0.5 ? 0.5 : 0.8) * P,
      color: i % PARTICLE_COLORS.length,
    });
  }
}

/** Advances the stage by `dt` seconds (the prototype's tick). */
export function stepStage(sim: StageSim, model: StageModel, dt: number): void {
  "worklet";
  sim.t += dt;
  const t = sim.t;

  // blinking + glancing around
  if (t > sim.nextBlink) {
    sim.blinkUntil = t + 0.13;
    sim.nextBlink = t + 2.2 + Math.random() * 3.2;
  }
  if (!sim.reduced && t > sim.nextLook) {
    sim.lookTarget = sim.lookTarget === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    sim.nextLook = t + (sim.lookTarget === 0 ? 3 + Math.random() * 3 : 1.1 + Math.random());
  }
  sim.look += (sim.lookTarget - sim.look) * Math.min(1, dt * 9);

  // lift when shoes add a row under the feet
  sim.lift += (liftFor(sim.equipped, model.costume !== null) - sim.lift) * Math.min(1, dt * 10);

  if (sim.hopDur > 0 && t - sim.hopStart >= sim.hopDur) sim.hopDur = 0;

  // finished item effects, fading items and particles
  for (const id of Object.keys(sim.itemFx)) {
    const fx = sim.itemFx[id];
    if (t - fx.start >= (fx.drop ? ITEM_DROP_S : ITEM_POP_S)) delete sim.itemFx[id];
  }
  sim.fading = sim.fading.filter((f) => t - f.start < FADE_S);
  for (const p of sim.particles) {
    p.age += dt;
    p.vy += 420 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  sim.particles = sim.particles.filter((p) => p.age < p.life);

  // confetti that is due
  const { P, W, groundY } = model;
  const due = sim.bursts.filter((b) => t >= b.at);
  if (due.length) {
    sim.bursts = sim.bursts.filter((b) => t < b.at);
    const ox = W / 2 - 6 * P;
    const oy = groundY - (16 + sim.lift) * P;
    for (const b of due) {
      const layer = b.itemId ? model.items[b.itemId].layer : null;
      if (layer) {
        spawnParticles(sim, P, ox + (layer.x + layer.w / 2) * P, oy + (layer.y + layer.h / 2) * P, b.n);
      } else {
        spawnParticles(sim, P, W / 2, groundY - 9 * P, b.n);
      }
    }
  }
}

// ------------------------------------------------------------------ drawing

const LINEAR = FilterMode.Linear;
const NO_MIPMAPS = MipmapMode.None;
const C_SHADOW = Skia.Color("#3c325a");

function clamp01(v: number): number {
  "worklet";
  return Math.max(0, Math.min(1, v));
}

function easeOutBack(u: number): number {
  "worklet";
  const c1 = 1.7, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

function easeOutCubic(u: number): number {
  "worklet";
  return 1 - Math.pow(1 - u, 3);
}

function easeOutBounce(u: number): number {
  "worklet";
  const n1 = 7.5625, d1 = 2.75;
  if (u < 1 / d1) return n1 * u * u;
  if (u < 2 / d1) { const v = u - 1.5 / d1; return n1 * v * v + 0.75; }
  if (u < 2.5 / d1) { const v = u - 2.25 / d1; return n1 * v * v + 0.9375; }
  const v = u - 2.625 / d1;
  return n1 * v * v + 0.984375;
}

/** Hop curve -> {y, sy}: squash, rise, fall, land squash. */
function hopState(sim: StageSim): { y: number; sy: number } {
  "worklet";
  if (sim.hopDur <= 0) return { y: 0, sy: 1 };
  const u = (sim.t - sim.hopStart) / sim.hopDur;
  if (u >= 1) return { y: 0, sy: 1 };
  if (u < 0.14) return { y: 0, sy: 1 - 0.1 * Math.sin(((u / 0.14) * Math.PI) / 2) };
  if (u < 0.62) {
    const k = (u - 0.14) / 0.48;
    return { y: -sim.hopH * Math.sin(k * Math.PI), sy: 1 + 0.07 * (1 - k) * (k < 0.5 ? 1 : 0.3) };
  }
  const k = (u - 0.62) / 0.38;
  return { y: 0, sy: 1 - 0.1 * Math.sin(k * Math.PI) * (1 - k * 0.4) };
}

type Fx = { dy: number; alpha: number; scale: number };

function itemFxFor(sim: StageSim, id: string, P: number): Fx {
  "worklet";
  const fx = sim.itemFx[id];
  if (!fx) return { dy: 0, alpha: 1, scale: 1 };
  const u = clamp01((sim.t - fx.start) / (fx.drop ? ITEM_DROP_S : ITEM_POP_S));
  if (u >= 1) return { dy: 0, alpha: 1, scale: 1 };
  if (fx.drop) return { dy: -9 * P * (1 - easeOutBounce(u)), alpha: clamp01(u * 4), scale: 1 };
  return { dy: 0, alpha: 1, scale: 1 + 0.35 * (1 - easeOutBack(u)) };
}

/** Records one frame of the stage (the prototype's draw). */
export function drawStage(c: SkCanvas, model: StageModel, sim: StageSim): void {
  "worklet";
  const { W, P, dpr, groundY } = model;
  const t = sim.t;
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const paint = Skia.Paint();

  const drawLayer = (L: Layer | null, ox: number, oy: number, dx = 0, dy = 0, alpha = 1, scale = 1) => {
    if (!L) return;
    const x = ox + L.x * P + dx, y = oy + L.y * P + dy;
    const w = L.w * P, h = L.h * P;
    paint.setAlphaf(alpha);
    const src = Skia.XYWHRect(0, 0, L.image.width(), L.image.height());
    const dst = scale !== 1
      ? Skia.XYWHRect(x + w / 2 - (w * scale) / 2, y + h / 2 - (h * scale) / 2, w * scale, h * scale)
      : Skia.XYWHRect(snap(x), snap(y), w, h);
    c.drawImageRectOptions(L.image, src, dst, LINEAR, NO_MIPMAPS, paint);
  };

  const hs = hopState(sim);
  const ox = W / 2 - 6 * P;
  const oy = groundY - (16 + sim.lift) * P + hs.y;

  // shadow
  const air = clamp01(-hs.y / (6 * P));
  const shadow = Skia.Paint();
  shadow.setColor(C_SHADOW);
  shadow.setAlphaf(0.22 - air * 0.12);
  const rx = P * (6.6 - air * 2), ry = P * (1.05 - air * 0.3);
  c.drawOval(Skia.XYWHRect(W / 2 - rx, groundY + P * 0.2 - ry, 2 * rx, 2 * ry), shadow);

  // squash & stretch about the feet
  c.save();
  c.translate(W / 2, groundY + hs.y);
  c.scale(1 + (1 - hs.sy) * 0.9, hs.sy);
  c.translate(-W / 2, -(groundY + hs.y));

  const idle = sim.reduced ? 0 : 1;
  const breathe = Math.sin((t * Math.PI * 2) / 2.6);
  const headDy = idle * (1 - Math.cos(((t - 0.18) * Math.PI * 2) / 2.6)) * 0.12 * P;
  const headRot = idle * Math.sin((t * Math.PI * 2) / 5.4) * 0.03;
  const handDy = idle * breathe * 0.16 * P;

  const C = model.costume;
  const cf = itemFxFor(sim, COSTUME_FX, P);
  const costumeDraw = (list: Layer[], dx = 0, dy = 0) => {
    for (const L of list) drawLayer(L, ox, oy, dx, dy + cf.dy, cf.alpha, cf.scale);
  };
  const wornDraw = (id: ItemId | undefined) => {
    if (!id) return;
    const f = itemFxFor(sim, id, P);
    drawLayer(model.items[id].layer, ox, oy, 0, f.dy, f.alpha, f.scale);
  };
  const drawFading = (group: ItemGroup) => {
    for (const f of sim.fading) {
      const item = model.items[f.id];
      const u = clamp01((t - f.start) / FADE_S);
      const dy = -1.6 * P * easeOutCubic(u);
      if (group === "head" && item.hood) drawLayer(item.hood, ox, oy, 0, dy, 1 - u);
      if (item.group === group) drawLayer(item.layer, ox, oy, 0, dy, 1 - u);
    }
  };

  // back items (the cape) sit behind the body; a costume replaces the clothes
  if (C) costumeDraw(C.back);
  else wornDraw(sim.equipped.back);
  drawFading("back");
  drawLayer(model.body, ox, oy);
  if (C) costumeDraw(C.body);
  else for (const slot of SLOT_ORDER) wornDraw(sim.equipped[slot]);
  drawFading("body");

  const hLx = -idle * breathe * 0.06 * P, hLy = handDy;
  const hRx = idle * breathe * 0.06 * P, hRy = -handDy * 0.6;
  drawLayer(model.handL, ox, oy, hLx, hLy);
  drawLayer(model.handR, ox, oy, hRx, hRy);
  // sleeves ride on the hands: worn top first, then any top that is fading out
  if (C) {
    costumeDraw(C.handL, hLx, hLy);
    costumeDraw(C.handR, hRx, hRy);
  }
  const top = C ? undefined : sim.equipped.top;
  if (top && model.items[top].sleeveL) {
    const f = itemFxFor(sim, top, P);
    drawLayer(model.items[top].sleeveL, ox, oy, hLx, hLy + f.dy, f.alpha, f.scale);
    drawLayer(model.items[top].sleeveR, ox, oy, hRx, hRy + f.dy, f.alpha, f.scale);
  }
  for (const fd of sim.fading) {
    const item = model.items[fd.id];
    if (!item.sleeveL) continue;
    const u = clamp01((t - fd.start) / FADE_S), dy = -1.6 * P * easeOutCubic(u);
    drawLayer(item.sleeveL, ox, oy, hLx, hLy + dy, 1 - u);
    drawLayer(item.sleeveR, ox, oy, hRx, hRy + dy, 1 - u);
  }

  // head group: gentle bob + tilt from the neck
  c.save();
  const px = ox + 6 * P, py = oy + 9.5 * P;
  c.translate(px, py + headDy);
  c.rotate((headRot * 180) / Math.PI, 0, 0);
  c.translate(-px, -py);
  drawLayer(model.head, ox, oy);
  const eyeKey: EyeKey = t < sim.happyUntil ? "happy" : t < sim.blinkUntil ? "closed" : "open";
  if (!C || !C.hideEyes) {
    drawLayer(model.eyes[eyeKey], ox, oy, eyeKey === "open" ? sim.look * P : 0, 0);
  }
  if (C) costumeDraw(C.head);
  if (top && model.items[top].hood) {
    const f = itemFxFor(sim, top, P);
    drawLayer(model.items[top].hood, ox, oy, 0, f.dy, f.alpha, f.scale);
  }
  if (!C) for (const slot of HEAD_ORDER) wornDraw(sim.equipped[slot]);
  drawFading("head");
  c.restore();
  c.restore();

  // particles (pixel squares)
  for (const p of sim.particles) {
    paint.setColor(PARTICLE_COLORS[p.color]);
    paint.setAlphaf(Math.max(0, 1 - p.age / p.life));
    c.drawRect(Skia.XYWHRect(snap(p.x - p.size / 2), snap(p.y - p.size / 2), p.size, p.size), paint);
  }
}
