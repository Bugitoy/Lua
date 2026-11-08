import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useSyncExternalStore } from "react";

import type { GoalFields, ScheduleItemData } from "@/components/schedule/scheduleTypes";
import type { GoalRecord } from "@/lib/dayHistory";
import { dayKey } from "@/lib/dayKey";
import { updateGameStats } from "@/lib/gameStats";

/**
 * Today's goals, saved on the phone. Goals last one day: at midnight
 * `dailyProgress` records them in the day's history (done or missed)
 * and starts the new day with the goals planned for it (`goalPlans`).
 */

const STORAGE_KEY = "schedule";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduledItem = ScheduleItemData & {
  /** Place name shown on the map marker (same as `location`). */
  label: string;
  /** True once the user arrived within the arrival radius. */
  completed: boolean;
  /** When the goal was completed, for the day's history. */
  completedAtMs: number | null;
};

type StoreState = {
  /** The day these goals belong to. */
  day: string;
  /** Goals in the order they were added, keyed by id. */
  items: ReadonlyMap<string, ScheduledItem>;
  hydrated: boolean;
};

// ─── State ────────────────────────────────────────────────────────────────────

let state: StoreState = { day: dayKey(), items: new Map(), hydrated: false };
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void startSchedule();
  return () => listeners.delete(listener);
}

/** Keeps the goal counts in game stats in step with the schedule. */
function mirrorStats(): void {
  const total = state.items.size;
  let done = 0;
  for (const item of state.items.values()) if (item.completed) done++;
  updateGameStats({
    goalsTotal: total,
    goalsDone: done,
    goalDayPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  });
}

function commit(next: Partial<Omit<StoreState, "hydrated">>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  mirrorStats();
  if (!state.hydrated) return;
  const saved = { day: state.day, items: Array.from(state.items.values()) };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
}

function sanitizeItem(raw: unknown): ScheduledItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.title !== "string" ||
    typeof r.latitude !== "number" ||
    typeof r.longitude !== "number"
  ) {
    return null;
  }
  const item = r as unknown as ScheduledItem;
  return {
    ...item,
    label: typeof r.label === "string" ? r.label : String(r.location ?? ""),
    completed: r.completed === true,
    completedAtMs: typeof r.completedAtMs === "number" ? r.completedAtMs : null,
  };
}

/** Loads the saved schedule once. Safe to call repeatedly. */
export function startSchedule(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let day = state.day;
    const items = new Map(state.items);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { day?: unknown; items?: unknown };
        if (typeof saved.day === "string") day = saved.day;
        if (Array.isArray(saved.items)) {
          for (const entry of saved.items) {
            const item = sanitizeItem(entry);
            if (item && !items.has(item.id)) items.set(item.id, item);
          }
        }
      }
    } catch {
      // Start with an empty schedule.
    }
    state = { ...state, day, items, hydrated: true };
    commit({});
  })();
  return loadPromise;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function newItem(data: Omit<ScheduleItemData, "id">): ScheduledItem {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { ...data, id, label: data.location, completed: false, completedAtMs: null };
}

/** Adds a goal for today and returns its id. */
export function addScheduleItem(data: Omit<ScheduleItemData, "id">): string {
  const item = newItem(data);
  const next = new Map(state.items);
  next.set(item.id, item);
  commit({ items: next });
  return item.id;
}

/** Edits a goal for today. A goal that is already done keeps its completion. */
export function updateScheduleItem(id: string, changes: GoalFields & { seriesId?: string }): void {
  const item = state.items.get(id);
  if (!item) return;
  const next = new Map(state.items);
  next.set(id, { ...item, ...changes, seriesId: changes.seriesId, label: changes.location });
  commit({ items: next });
}

export function removeScheduleItem(id: string): void {
  if (!state.items.has(id)) return;
  const next = new Map(state.items);
  next.delete(id);
  commit({ items: next });
}

/**
 * Mark the goal with the given id as completed.
 * Returns `true` only on the first completion so callers can reward it once.
 */
export function markGoalCompleted(id: string): boolean {
  const item = state.items.get(id);
  if (!item || item.completed) return false;
  const next = new Map(state.items);
  next.set(id, { ...item, completed: true, completedAtMs: Date.now() });
  commit({ items: next });
  return true;
}

/** Starts a new day with the goals planned for it. Called after the old day is recorded. */
export function clearSchedule(day: string, planned: Omit<ScheduleItemData, "id">[] = []): void {
  const items = new Map<string, ScheduledItem>();
  for (const data of planned) {
    const item = newItem(data);
    items.set(item.id, item);
  }
  commit({ day, items });
}

// ─── Reads ────────────────────────────────────────────────────────────────────

function getSnapshot(): StoreState {
  return state;
}

/** Scheduled goals for non-React callers such as background location tasks. */
export function getScheduledItems(): ScheduledItem[] {
  return Array.from(state.items.values());
}

/** The day the current goals belong to. */
export function getScheduleDay(): string {
  return state.day;
}

/** A goal as saved in the day's history. */
export function toGoalRecord(item: ScheduledItem): GoalRecord {
  return {
    id: item.id,
    title: item.title,
    location: item.location,
    time: item.time,
    themeKey: item.themeKey,
    completed: item.completed,
    completedAtMs: item.completedAtMs,
    ...(item.note ? { note: item.note } : {}),
    ...(item.seriesId ? { repeating: true } : {}),
  };
}

export function hasUnfinishedGoals(): boolean {
  for (const item of state.items.values()) {
    if (!item.completed) return true;
  }
  return false;
}

/**
 * Reactive list of scheduled goals in the order they were added. The array
 * keeps its identity until the store changes, so it is safe as a memo/effect dep.
 */
export function useScheduledItems(): ScheduledItem[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => Array.from(snap.items.values()), [snap]);
}

/** Re-renders only when the answer flips, not on every schedule change. */
export function useHasUnfinishedGoals(): boolean {
  return useSyncExternalStore(subscribe, hasUnfinishedGoals);
}
