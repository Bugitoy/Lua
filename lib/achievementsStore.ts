import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import {
  COSTUMES,
  ITEMS,
  PALETTE_SKINS,
  type CostumeId,
  type Item,
  type ItemId,
  type PaletteSkinId,
  type Slot,
} from "@/constants/luaSprites";

const EQUIPPED_STORAGE_KEY = "achievementsEquipped";
const LOOK_STORAGE_KEY = "achievementsLook";

export type Equipped = Partial<Record<Slot, ItemId>>;

type Look = {
  /** Colour skin in use, or the last one used while a costume is on. */
  skin: PaletteSkinId;
  costume: CostumeId | null;
  ownedCostumes: CostumeId[];
  /** Hides the shop button's NEW tag once the shop has been opened. */
  shopOpened: boolean;
  /** Highest XP the achievements screen has shown; rewards past it go on without the unlock show. */
  seenXp: number;
};

type AchievementsState = Look & {
  equipped: Equipped;
  hydrated: boolean;
  /** Dev-only XP added on top of the stats-derived total. Always 0 in release builds. */
  devXpBonus: number;
};

const EMPTY_LOOK: Look = {
  skin: "classic",
  costume: null,
  ownedCostumes: [],
  shopOpened: false,
  seenXp: 0,
};

let state: AchievementsState = { ...EMPTY_LOOK, equipped: {}, hydrated: false, devXpBonus: 0 };
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void loadState();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AchievementsState {
  return state;
}

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item])) as Record<
  ItemId,
  Item
>;

function sanitizeEquipped(raw: unknown): Equipped {
  const out: Equipped = {};
  if (!raw || typeof raw !== "object") return out;
  const record = raw as Record<string, unknown>;
  for (const item of ITEMS) {
    if (record[item.slot] === item.id) out[item.slot] = item.id;
  }
  return out;
}

function isCostumeId(value: unknown): value is CostumeId {
  return COSTUMES.some((c) => c.id === value);
}

function sanitizeLook(raw: unknown): Look {
  if (!raw || typeof raw !== "object") return EMPTY_LOOK;
  const record = raw as Record<string, unknown>;
  const ownedCostumes = Array.isArray(record.ownedCostumes)
    ? COSTUMES.map((c) => c.id).filter((id) => (record.ownedCostumes as unknown[]).includes(id))
    : [];
  const costume = isCostumeId(record.costume) && ownedCostumes.includes(record.costume)
    ? record.costume
    : null;
  return {
    skin: PALETTE_SKINS.find((s) => s.id === record.skin)?.id ?? "classic",
    costume,
    ownedCostumes,
    shopOpened: record.shopOpened === true,
    seenXp: typeof record.seenXp === "number" && record.seenXp >= 0 ? record.seenXp : 0,
  };
}

function loadState(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let equipped: Equipped = {};
    let look = EMPTY_LOOK;
    try {
      const [storedEquipped, storedLook] = await Promise.all([
        AsyncStorage.getItem(EQUIPPED_STORAGE_KEY),
        AsyncStorage.getItem(LOOK_STORAGE_KEY),
      ]);
      if (storedEquipped) equipped = sanitizeEquipped(JSON.parse(storedEquipped));
      if (storedLook) look = sanitizeLook(JSON.parse(storedLook));
    } catch {
      // fall back to a fresh Lua
    }
    if (state.hydrated) return;
    state = { ...state, ...look, equipped, hydrated: true };
    notify();
  })();
  return loadPromise;
}

function commit(next: Partial<Omit<AchievementsState, "hydrated" | "devXpBonus">>) {
  const prev = state;
  state = { ...state, ...next, hydrated: true };
  notify();
  if (state.equipped !== prev.equipped) {
    AsyncStorage.setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(state.equipped)).catch(() => {});
  }
  const look: Look = {
    skin: state.skin,
    costume: state.costume,
    ownedCostumes: state.ownedCostumes,
    shopOpened: state.shopOpened,
    seenXp: state.seenXp,
  };
  if ((Object.keys(look) as (keyof Look)[]).some((key) => look[key] !== prev[key])) {
    AsyncStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify(look)).catch(() => {});
  }
}

/**
 * Puts the items on in order, so a later item replaces an earlier one in the same slot.
 * Any costume comes off, so the clothes show.
 */
export function wearItems(ids: ItemId[]) {
  if (ids.length === 0) return;
  const equipped = { ...state.equipped };
  for (const id of ids) equipped[ITEM_BY_ID[id].slot] = id;
  commit({ equipped, costume: null });
}

export function takeOffItem(id: ItemId) {
  const { slot } = ITEM_BY_ID[id];
  if (state.equipped[slot] !== id) return;
  const equipped = { ...state.equipped };
  delete equipped[slot];
  commit({ equipped });
}

/** Switches to a colour skin, taking any costume off. */
export function useSkin(skin: PaletteSkinId) {
  commit({ skin, costume: null });
}

/** Puts on a costume the player owns. The clothes stay equipped underneath. */
export function wearCostume(id: CostumeId) {
  if (!state.ownedCostumes.includes(id)) return;
  commit({ costume: id });
}

export function takeOffCostume() {
  if (state.costume) commit({ costume: null });
}

export function addOwnedCostume(id: CostumeId) {
  if (state.ownedCostumes.includes(id)) return;
  const owned = new Set([...state.ownedCostumes, id]);
  commit({ ownedCostumes: COSTUMES.map((c) => c.id).filter((c) => owned.has(c)) });
}

/** Marks a costume owned and puts it on, for the simulated shop purchase. */
export function acquireCostume(id: CostumeId) {
  const owned = new Set([...state.ownedCostumes, id]);
  commit({
    ownedCostumes: COSTUMES.map((c) => c.id).filter((c) => owned.has(c)),
    costume: id,
  });
}

export function markShopOpened() {
  if (!state.shopOpened) commit({ shopOpened: true });
}

export function getSeenXp() {
  return state.seenXp;
}

export function setSeenXp(seenXp: number) {
  if (seenXp !== state.seenXp) commit({ seenXp });
}

/** Dev only: back to a fresh Lua with no clothes, skins or costumes. */
export function resetLook() {
  commit({ ...EMPTY_LOOK, equipped: {} });
}

export function setDevXpBonus(devXpBonus: number) {
  state = { ...state, devXpBonus };
  notify();
}

export function useAchievements() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
