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

/** Rows shared by every body, item and costume sheet. */
export const AVATAR_ROWS = {
  idle: 0,
  blinkGlance: 1,
  hop: 2,
  happy: 3,
} as const;

export type ItemId =
  | "sneakers"
  | "jeans"
  | "cap"
  | "shades"
  | "beanie"
  | "shorts"
  | "scarf"
  | "headphones"
  | "boots"
  | "hoodie"
  | "cape"
  | "wizard"
  | "crown";
export type Slot = "feet" | "legs" | "head" | "face" | "neck" | "top" | "back";
export type PaletteSkinId = "classic" | "mint" | "strawberry" | "midnight" | "gold";
export type CostumeId =
  | "soldier"
  | "samurai"
  | "office"
  | "ninja"
  | "spy"
  | "student"
  | "astronaut"
  | "knight"
  | "pirate"
  | "chef"
  | "firefighter"
  | "doctor"
  | "cowboy"
  | "robot"
  | "viking"
  | "hero";

export type Reward =
  | { kind: "item"; id: ItemId; slot: Slot; xp: number }
  | { kind: "skin"; id: Exclude<PaletteSkinId, "classic">; xp: number };
/** Item id, or `skin_<id>` for a colour skin; names its preview row. */
export type RewardKey = ItemId | `skin_${Exclude<PaletteSkinId, "classic">}`;

/** The unlock path, in XP order. */
export const REWARDS: Reward[] = [
  { kind: "item", id: "sneakers", slot: "feet", xp: 500 },
  { kind: "item", id: "jeans", slot: "legs", xp: 1000 },
  { kind: "item", id: "cap", slot: "head", xp: 1500 },
  { kind: "item", id: "shades", slot: "face", xp: 2000 },
  { kind: "skin", id: "mint", xp: 2500 },
  { kind: "item", id: "beanie", slot: "head", xp: 3000 },
  { kind: "item", id: "shorts", slot: "legs", xp: 4000 },
  { kind: "item", id: "scarf", slot: "neck", xp: 5000 },
  { kind: "item", id: "headphones", slot: "head", xp: 6000 },
  { kind: "skin", id: "strawberry", xp: 7000 },
  { kind: "item", id: "boots", slot: "feet", xp: 8000 },
  { kind: "item", id: "hoodie", slot: "top", xp: 9000 },
  { kind: "skin", id: "midnight", xp: 10000 },
  { kind: "item", id: "cape", slot: "back", xp: 11500 },
  { kind: "item", id: "wizard", slot: "head", xp: 13000 },
  { kind: "skin", id: "gold", xp: 14000 },
  { kind: "item", id: "crown", slot: "head", xp: 15000 },
];

export function rewardKey(reward: Reward): RewardKey {
  return reward.kind === "item" ? reward.id : `skin_${reward.id}`;
}

export function rewardI18nKey(reward: Reward): string {
  return reward.kind === "item"
    ? `achievements.items.${reward.id}`
    : `achievements.skinRewards.${reward.id}`;
}

export type Item = { id: ItemId; slot: Slot; unlockXp: number };

/** Clothes in path order. */
export const ITEMS: Item[] = REWARDS.flatMap((r) =>
  r.kind === "item" ? [{ id: r.id, slot: r.slot, unlockXp: r.xp }] : [],
);

/** Colour skins: Classic is always owned, the rest unlock on the path. */
export const PALETTE_SKINS: { id: PaletteSkinId; unlockXp: number }[] = [
  { id: "classic", unlockXp: 0 },
  ...REWARDS.flatMap((r) => (r.kind === "skin" ? [{ id: r.id, unlockXp: r.xp }] : [])),
];

/** Costume skins sold in the shop. Prices are placeholders. */
export const COSTUMES: { id: CostumeId; price: string }[] = [
  { id: "soldier", price: "$1.99" },
  { id: "samurai", price: "$2.99" },
  { id: "office", price: "$0.99" },
  { id: "ninja", price: "$2.99" },
  { id: "spy", price: "$2.49" },
  { id: "student", price: "$0.99" },
  { id: "astronaut", price: "$2.99" },
  { id: "knight", price: "$2.49" },
  { id: "pirate", price: "$1.99" },
  { id: "chef", price: "$0.99" },
  { id: "firefighter", price: "$1.99" },
  { id: "doctor", price: "$1.49" },
  { id: "cowboy", price: "$1.99" },
  { id: "robot", price: "$2.49" },
  { id: "viking", price: "$2.49" },
  { id: "hero", price: "$2.99" },
];

/** Draw order for equipped items, bottom → top. */
export const LAYER_ORDER: Slot[] = ["back", "legs", "top", "feet", "neck", "face", "head"];

/** Items whose soles lift the avatar 2 art px while worn. */
export const SHOE_ITEMS: readonly ItemId[] = ["sneakers", "boots"];

export const BODY_SHEETS: Record<PaletteSkinId, number> = {
  classic: require("../assets/images/achievements/avatar_body.png"),
  mint: require("../assets/images/achievements/avatar_body_mint.png"),
  strawberry: require("../assets/images/achievements/avatar_body_strawberry.png"),
  midnight: require("../assets/images/achievements/avatar_body_midnight.png"),
  gold: require("../assets/images/achievements/avatar_body_gold.png"),
};

export const ITEM_LAYERS: Record<ItemId, number> = {
  sneakers: require("../assets/images/achievements/item_sneakers.png"),
  jeans: require("../assets/images/achievements/item_jeans.png"),
  cap: require("../assets/images/achievements/item_cap.png"),
  shades: require("../assets/images/achievements/item_shades.png"),
  beanie: require("../assets/images/achievements/item_beanie.png"),
  shorts: require("../assets/images/achievements/item_shorts.png"),
  scarf: require("../assets/images/achievements/item_scarf.png"),
  headphones: require("../assets/images/achievements/item_headphones.png"),
  boots: require("../assets/images/achievements/item_boots.png"),
  hoodie: require("../assets/images/achievements/item_hoodie.png"),
  cape: require("../assets/images/achievements/item_cape.png"),
  wizard: require("../assets/images/achievements/item_wizard.png"),
  crown: require("../assets/images/achievements/item_crown.png"),
};

export const COSTUME_SHEETS: Record<CostumeId, number> = {
  soldier: require("../assets/images/achievements/costume_soldier.png"),
  samurai: require("../assets/images/achievements/costume_samurai.png"),
  office: require("../assets/images/achievements/costume_office.png"),
  ninja: require("../assets/images/achievements/costume_ninja.png"),
  spy: require("../assets/images/achievements/costume_spy.png"),
  student: require("../assets/images/achievements/costume_student.png"),
  astronaut: require("../assets/images/achievements/costume_astronaut.png"),
  knight: require("../assets/images/achievements/costume_knight.png"),
  pirate: require("../assets/images/achievements/costume_pirate.png"),
  chef: require("../assets/images/achievements/costume_chef.png"),
  firefighter: require("../assets/images/achievements/costume_firefighter.png"),
  doctor: require("../assets/images/achievements/costume_doctor.png"),
  cowboy: require("../assets/images/achievements/costume_cowboy.png"),
  robot: require("../assets/images/achievements/costume_robot.png"),
  viking: require("../assets/images/achievements/costume_viking.png"),
  hero: require("../assets/images/achievements/costume_hero.png"),
};

/**
 * Milestone preview poses, one set of five sheets per colour skin, rewards in path order four
 * per sheet. Each shows Lua wearing only that item; a skin reward shows Lua in that skin.
 */
export const PREVIEW_SHEETS: Record<PaletteSkinId, readonly number[]> = {
  classic: [
    require("../assets/images/achievements/preview_poses_1.png"),
    require("../assets/images/achievements/preview_poses_2.png"),
    require("../assets/images/achievements/preview_poses_3.png"),
    require("../assets/images/achievements/preview_poses_4.png"),
    require("../assets/images/achievements/preview_poses_5.png"),
  ],
  mint: [
    require("../assets/images/achievements/preview_poses_1_mint.png"),
    require("../assets/images/achievements/preview_poses_2_mint.png"),
    require("../assets/images/achievements/preview_poses_3_mint.png"),
    require("../assets/images/achievements/preview_poses_4_mint.png"),
    require("../assets/images/achievements/preview_poses_5_mint.png"),
  ],
  strawberry: [
    require("../assets/images/achievements/preview_poses_1_strawberry.png"),
    require("../assets/images/achievements/preview_poses_2_strawberry.png"),
    require("../assets/images/achievements/preview_poses_3_strawberry.png"),
    require("../assets/images/achievements/preview_poses_4_strawberry.png"),
    require("../assets/images/achievements/preview_poses_5_strawberry.png"),
  ],
  midnight: [
    require("../assets/images/achievements/preview_poses_1_midnight.png"),
    require("../assets/images/achievements/preview_poses_2_midnight.png"),
    require("../assets/images/achievements/preview_poses_3_midnight.png"),
    require("../assets/images/achievements/preview_poses_4_midnight.png"),
    require("../assets/images/achievements/preview_poses_5_midnight.png"),
  ],
  gold: [
    require("../assets/images/achievements/preview_poses_1_gold.png"),
    require("../assets/images/achievements/preview_poses_2_gold.png"),
    require("../assets/images/achievements/preview_poses_3_gold.png"),
    require("../assets/images/achievements/preview_poses_4_gold.png"),
    require("../assets/images/achievements/preview_poses_5_gold.png"),
  ],
};

/** Index into a PREVIEW_SHEETS set, and row, for each reward. */
export const PREVIEW_CELLS = Object.fromEntries(
  REWARDS.map((r, i) => [rewardKey(r), { sheet: Math.floor(i / 4), row: i % 4 }]),
) as Record<RewardKey, { sheet: number; row: number }>;

/** Sparkle burst to overlay on the avatar when a reward unlocks (play once), in every preview set. */
export const UNLOCK_BURST = { sheet: 4, row: 1 } as const;

type Cell = [row: number, col: number];

/** Clothing icons, one cell each; ITEM_ICONS_LOCKED has the greyed versions in the same cells. */
export const ITEM_ICONS = require("../assets/images/achievements/item_icons.png");
export const ITEM_ICONS_LOCKED = require("../assets/images/achievements/item_icons_locked.png");
export const ICON_CELLS: Record<ItemId, Cell> = {
  sneakers: [0, 0],
  jeans: [0, 1],
  shades: [0, 2],
  beanie: [0, 3],
  scarf: [1, 0],
  crown: [1, 1],
  cap: [1, 2],
  headphones: [1, 3],
  hoodie: [2, 0],
  cape: [2, 1],
  boots: [2, 2],
  shorts: [2, 3],
  wizard: [3, 0],
};

/** Opaque art inside each icon cell, in art pixels of the 16×16 icon grid. Same on the locked sheet. */
export type ArtBounds = { x: number; y: number; w: number; h: number };
export const ICON_BOUNDS: Record<ItemId, ArtBounds> = {
  sneakers: { x: 3, y: 6, w: 10, h: 4 },
  jeans: { x: 4, y: 6, w: 8, h: 3 },
  shades: { x: 2, y: 6, w: 12, h: 3 },
  beanie: { x: 2, y: 4, w: 12, h: 8 },
  scarf: { x: 3, y: 6, w: 10, h: 4 },
  crown: { x: 3, y: 5, w: 10, h: 5 },
  cap: { x: 1, y: 5, w: 14, h: 6 },
  headphones: { x: 1, y: 4, w: 14, h: 8 },
  hoodie: { x: 3, y: 3, w: 10, h: 10 },
  cape: { x: 2, y: 4, w: 12, h: 8 },
  boots: { x: 3, y: 6, w: 10, h: 4 },
  shorts: { x: 4, y: 6, w: 8, h: 3 },
  wizard: { x: 1, y: 2, w: 14, h: 12 },
};

/** Colour skin tiles; Classic is never locked. */
export const SKIN_ICONS = require("../assets/images/achievements/skin_icons.png");
export const SKIN_ICON_CELLS: Record<PaletteSkinId, { unlocked: Cell; locked: Cell }> = {
  classic: { unlocked: [0, 0], locked: [0, 0] },
  mint: { unlocked: [0, 1], locked: [1, 0] },
  strawberry: { unlocked: [0, 2], locked: [1, 1] },
  midnight: { unlocked: [0, 3], locked: [1, 2] },
  gold: { unlocked: [2, 0], locked: [1, 3] },
};

/** A still front view of each costume, on the shared baseline, for shop and wardrobe tiles. */
export const COSTUME_STILLS = require("../assets/images/achievements/skins_costumes.png");
export const COSTUME_CELLS = Object.fromEntries(
  COSTUMES.map((c, i) => [c.id, [Math.floor(i / 4), i % 4]]),
) as Record<CostumeId, Cell>;
