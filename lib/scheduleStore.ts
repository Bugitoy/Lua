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
  /**
   * When the user first came within the arrival radius today. Reaching a goal
   * doesn't finish it; it lets the user tick it off for the rest of the day.
   */
  reachedAtMs: number | null;
  /** The visit that reached this goal; goals reached together share it, and its walk pays XP once. */
  arrivalId: string | null;
  /** True once the user ticked the goal off. */
  completed: boolean;
  /** When the goal was ticked off, for the day's history. */
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
  const completed = r.completed === true;
  const completedAtMs = typeof r.completedAtMs === "number" ? r.completedAtMs : null;
  return {
    ...item,
    label: typeof r.label === "string" ? r.label : String(r.location ?? ""),
    // Goals saved before reaching was its own step were reached when they completed.
    reachedAtMs:
      typeof r.reachedAtMs === "number" ? r.reachedAtMs : completed ? (completedAtMs ?? Date.now()) : null,
    arrivalId: typeof r.arrivalId === "string" ? r.arrivalId : null,
    completed,
    completedAtMs,
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
  return {
    ...data,
    id,
    label: data.location,
    reachedAtMs: null,
    arrivalId: null,
    completed: false,
    completedAtMs: null,
  };
}

/** Adds a goal for today and returns its id. */
export function addScheduleItem(data: Omit<ScheduleItemData, "id">): string {
  const item = newItem(data);
  const next = new Map(state.items);
  next.set(item.id, item);
  commit({ items: next });
  return item.id;
}

/**
 * Edits a goal for today. A goal that is already done keeps its completion;
 * an unfinished goal moved to a new place has to be reached again.
 */
export function updateScheduleItem(id: string, changes: GoalFields & { seriesId?: string }): void {
  const item = state.items.get(id);
  if (!item) return;
  const moved = changes.latitude !== item.latitude || changes.longitude !== item.longitude;
  const resetReach = moved && !item.completed;
  const next = new Map(state.items);
  next.set(id, {
    ...item,
    ...changes,
    seriesId: changes.seriesId,
    label: changes.location,
    ...(resetReach ? { reachedAtMs: null, arrivalId: null } : {}),
  });
  commit({ items: next });
}

export function removeScheduleItem(id: string): void {
  if (!state.items.has(id)) return;
  const next = new Map(state.items);
  next.delete(id);
  commit({ items: next });
}

/** Marks goals the user just arrived at as reached by visit `arrivalId`. Returns the ids it changed. */
export function markGoalsReached(ids: Iterable<string>, arrivalId: string): string[] {
  const now = Date.now();
  let next: Map<string, ScheduledItem> | null = null;
  const changed: string[] = [];
  for (const id of ids) {
    const item = state.items.get(id);
    if (!item || item.reachedAtMs != null) continue;
    next ??= new Map(state.items);
    next.set(id, { ...item, reachedAtMs: now, arrivalId });
    changed.push(id);
  }
  if (next) commit({ items: next });
  return changed;
}

/**
 * Ticks off a goal the user has reached today.
 * Returns `true` only on the first completion so callers can reward it once.
 */
export function markGoalCompleted(id: string): boolean {
  const item = state.items.get(id);
  if (!item || item.completed || item.reachedAtMs == null) return false;
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

/** True while some goal today still has to be reached, so location tracking is needed. */
export function hasUnreachedGoals(): boolean {
  for (const item of state.items.values()) {
    if (item.reachedAtMs == null) return true;
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
export function useHasUnreachedGoals(): boolean {
  return useSyncExternalStore(subscribe, hasUnreachedGoals);
}
