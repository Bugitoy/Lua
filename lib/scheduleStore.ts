import { useSyncExternalStore } from "react";

import type { ScheduleThemeKey } from "@/components/schedule/scheduleTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A scheduled goal as the map / arrival detector cares about it.
 * The schedule screen owns the richer `ScheduleItemData`; here we only
 * keep the bits that drive map markers + GPS arrival checks.
 */
export type ScheduledItem = {
  id: string;
  label: string;
  category: string;
  /** Goal type from schedule theme; may be missing for legacy items. */
  themeKey?: ScheduleThemeKey;
  latitude: number;
  longitude: number;
  /** True once the sprite has come within the arrival radius. */
  completed: boolean;
};

type StoreState = {
  /** Ordered map of scheduled goals, keyed by stable schedule item id. */
  items: ReadonlyMap<string, ScheduledItem>;
};

// ─── State ────────────────────────────────────────────────────────────────────

let state: StoreState = {
  items: new Map(),
};

// ─── Pub/sub ──────────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((l) => l());
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Replace the full list of scheduled items.
 *
 * Preserves the `completed` flag for items that still exist (matched by id),
 * so re-saving the schedule never wipes already-earned completions.
 */
export function setScheduledItems(
  incoming: {
    id: string;
    label: string;
    category: string;
    themeKey?: ScheduleThemeKey;
    latitude: number;
    longitude: number;
  }[],
): void {
  const previous = state.items;
  const next = new Map<string, ScheduledItem>();
  for (const item of incoming) {
    const wasCompleted = previous.get(item.id)?.completed ?? false;
    next.set(item.id, {
      id: item.id,
      label: item.label,
      category: item.category,
      themeKey: item.themeKey,
      latitude: item.latitude,
      longitude: item.longitude,
      completed: wasCompleted,
    });
  }
  state = { items: next };
  notify();
}

/**
 * Mark the goal with the given id as completed.
 * Returns `true` only on the first completion so callers can increment
 * `gameStats.goalsDone` exactly once per goal.
 */
export function markGoalCompleted(id: string): boolean {
  const item = state.items.get(id);
  if (!item || item.completed) return false;
  const next = new Map(state.items);
  next.set(id, { ...item, completed: true });
  state = { items: next };
  notify();
  return true;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function getSnapshot(): StoreState {
  return state;
}

/** Reactive list of scheduled goals in the order they were inserted. */
export function useScheduledItems(): ScheduledItem[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return Array.from(snap.items.values());
}

/**
 * Cheap lookup — returns whether a given schedule item is marked completed.
 * Subscribes to the store so card-level UI re-renders on completion.
 */
export function useIsGoalCompleted(id: string): boolean {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return snap.items.get(id)?.completed ?? false;
}
