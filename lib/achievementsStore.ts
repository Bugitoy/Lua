import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { ITEMS, type ItemId, type Slot } from "@/constants/luaSprites";

const EQUIPPED_STORAGE_KEY = "achievementsEquipped";

export type Equipped = Partial<Record<Slot, ItemId>>;

type AchievementsState = {
  equipped: Equipped;
  hydrated: boolean;
  /** Dev-only XP added on top of the stats-derived total. Always 0 in release builds. */
  devXpBonus: number;
};

let state: AchievementsState = { equipped: {}, hydrated: false, devXpBonus: 0 };
let loadPromise: Promise<void> | null = null;
/** Highest XP the achievements screen has shown; items unlocked past it get put on automatically. */
let seenXp = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void loadEquipped();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AchievementsState {
  return state;
}

function sanitizeEquipped(raw: unknown): Equipped {
  const out: Equipped = {};
  if (!raw || typeof raw !== "object") return out;
  const record = raw as Record<string, unknown>;
  for (const item of ITEMS) {
    if (record[item.slot] === item.id) out[item.slot] = item.id;
  }
  return out;
}

function loadEquipped(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let equipped: Equipped = {};
    try {
      const stored = await AsyncStorage.getItem(EQUIPPED_STORAGE_KEY);
      if (stored) equipped = sanitizeEquipped(JSON.parse(stored));
    } catch {
      // fall back to nothing equipped
    }
    if (state.hydrated) return;
    state = { ...state, equipped, hydrated: true };
    notify();
  })();
  return loadPromise;
}

function setEquipped(equipped: Equipped) {
  state = { ...state, equipped, hydrated: true };
  notify();
  AsyncStorage.setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(equipped)).catch(() => {});
}

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item])) as Record<
  ItemId,
  (typeof ITEMS)[number]
>;

export function getEquipped(): Equipped {
  return state.equipped;
}

/** Puts the items on in order, so a later item replaces an earlier one in the same slot. */
export function wearItems(ids: ItemId[]) {
  if (ids.length === 0) return;
  const next = { ...state.equipped };
  for (const id of ids) next[ITEM_BY_ID[id].slot] = id;
  setEquipped(next);
}

export function takeOffItem(id: ItemId) {
  const { slot } = ITEM_BY_ID[id];
  if (state.equipped[slot] !== id) return;
  const next = { ...state.equipped };
  delete next[slot];
  setEquipped(next);
}

export function clearEquipped() {
  setEquipped({});
}

export function setDevXpBonus(devXpBonus: number) {
  state = { ...state, devXpBonus };
  notify();
}

export function getSeenXp(): number {
  return seenXp;
}

export function setSeenXp(xp: number) {
  seenXp = xp;
}

export function useAchievements() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
