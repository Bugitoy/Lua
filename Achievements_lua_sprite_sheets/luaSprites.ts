/**
 * Lua XP Rewards sprite sheets.
 *
 * Every sheet is 2048×2048: 4 columns × 4 rows of 512×512 cells, one animation per row.
 * Each cell is a 32×32 art-pixel grid at exactly 16 bitmap px per art pixel, and the avatar's
 * feet sit on y = 464 in every cell of every sheet, so layers stack with no offsets.
 *
 * Paper-doll stacking order (bottom → top):
 *   AVATAR_BODY, jeans, sneakers, scarf, shades, then beanie OR crown.
 * All layer sheets use the body sheet's rows and frames, so put every layer inside the same
 * Animated.View and move them with one translateX / translateY.
 *
 * Sneakers soles reach 2 art px (32 cell px) below the baseline. While they are worn, lift the
 * whole stack by 32 cell px (scaled to your on-screen size) to keep the soles on the ground line.
 */

export const SHEET = {
  size: 2048,
  cell: 512,
  columns: 4,
  rows: 4,
  artPixel: 16,
  artGrid: 32,
  baselineY: 464,
} as const;

export const AVATAR_BODY = require("./avatar_body.png");

/** Rows shared by AVATAR_BODY and every ITEM_LAYERS sheet. */
export const AVATAR_ROWS = {
  idle: 0,
  blinkGlance: 1,
  hop: 2,
  happy: 3,
} as const;

export type ItemId = "sneakers" | "jeans" | "shades" | "beanie" | "scarf" | "crown";
export type Slot = "feet" | "legs" | "face" | "head" | "neck";

export const ITEMS: { id: ItemId; name: string; slot: Slot; unlockXp: number }[] = [
  { id: "sneakers", name: "Sneakers", slot: "feet", unlockXp: 500 },
  { id: "jeans", name: "Denim Pants", slot: "legs", unlockXp: 1000 },
  { id: "shades", name: "Pixel Shades", slot: "face", unlockXp: 2000 },
  { id: "beanie", name: "Cozy Beanie", slot: "head", unlockXp: 3000 },
  { id: "scarf", name: "Striped Scarf", slot: "neck", unlockXp: 4000 },
  { id: "crown", name: "Gold Crown", slot: "head", unlockXp: 5000 },
];

export const ITEM_LAYERS: Record<ItemId, number> = {
  sneakers: require("./item_sneakers.png"),
  jeans: require("./item_jeans.png"),
  shades: require("./item_shades.png"),
  beanie: require("./item_beanie.png"),
  scarf: require("./item_scarf.png"),
  crown: require("./item_crown.png"),
};

/** Draw order for equipped items, bottom → top (head slot holds beanie or crown). */
export const LAYER_ORDER: Slot[] = ["legs", "feet", "neck", "face", "head"];

/** Milestone preview poses: the avatar wearing only that item. */
export const PREVIEW_SHEETS = {
  poses1: require("./preview_poses_1.png"),
  poses2: require("./preview_poses_2.png"),
};

export const PREVIEW_CELLS: Record<ItemId, { sheet: keyof typeof PREVIEW_SHEETS; row: number }> = {
  sneakers: { sheet: "poses1", row: 0 },
  jeans: { sheet: "poses1", row: 1 },
  shades: { sheet: "poses1", row: 2 },
  beanie: { sheet: "poses1", row: 3 },
  scarf: { sheet: "poses2", row: 0 },
  crown: { sheet: "poses2", row: 1 },
};

/** Sparkle burst to overlay on the avatar when an item unlocks (play once). Row 3 is empty. */
export const UNLOCK_BURST = { sheet: "poses2" as const, row: 2 };

/** Static icons: one cell each, [row, column]. Rows 0–1 unlocked, rows 2–3 locked. */
export const ITEM_ICONS = require("./item_icons.png");
export const ICON_CELLS: Record<ItemId, { unlocked: [number, number]; locked: [number, number] }> = {
  sneakers: { unlocked: [0, 0], locked: [2, 0] },
  jeans: { unlocked: [0, 1], locked: [2, 1] },
  shades: { unlocked: [0, 2], locked: [2, 2] },
  beanie: { unlocked: [0, 3], locked: [2, 3] },
  scarf: { unlocked: [1, 0], locked: [3, 0] },
  crown: { unlocked: [1, 1], locked: [3, 1] },
};
