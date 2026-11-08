import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayKey } from "@/lib/dayKey";
import { haversineMeters, type LatLngPoint } from "@/lib/geo";
import {
  getScheduledItems,
  hasUnreachedGoals,
  subscribeSchedule,
  type ScheduledItem,
} from "@/lib/scheduleStore";

/**
 * Where the user is in relation to the goals they've reached today, and the
 * "did you finish these?" prompts that come from it:
 *
 * - Leaving a place with unticked goals asks about them.
 * - Coming back to such a place after a while away reminds about them.
 *
 * Prompts wait in a queue, saved on the phone, until Lua is on screen to show
 * them, so a place left while Lua was in the background still gets asked about.
 */

const STORAGE_KEY = "goalVisits";

/** Inside this distance of a goal counts as being there (same as reaching it). */
export const VISIT_ENTER_RADIUS_METERS = 25;
/** Past this distance counts as gone; the gap keeps GPS wobble at the edge from flickering. */
export const VISIT_LEAVE_RADIUS_METERS = 50;
/** How long the user must stay past the leave radius before it counts as leaving. */
const LEAVE_CONFIRM_MS = 30_000;
/** How long the user must be away before coming back counts as a new visit. */
const MIN_AWAY_MS = 5 * 60_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalPresence = {
  /** True while the user is at the goal's place. */
  present: boolean;
  /** When a fix first put the user past the leave radius; null while back inside. */
  outsideSinceMs: number | null;
  /** When the user last left. */
  leftAtMs: number | null;
};

export type CheckInPrompt = {
  id: string;
  kind: "leave" | "return";
  /** The place's name, from its goals' location. */
  place: string;
  goalIds: string[];
  /** When the user left or came back. */
  atMs: number;
};

type VisitsState = {
  day: string;
  presence: Readonly<Record<string, GoalPresence>>;
  /** Oldest first; the first one is shown. */
  prompts: readonly CheckInPrompt[];
  hydrated: boolean;
};

// ─── State ────────────────────────────────────────────────────────────────────

let state: VisitsState = { day: dayKey(), presence: {}, prompts: [], hydrated: false };
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void startGoalVisits();
  return () => listeners.delete(listener);
}

function commit(next: Partial<Omit<VisitsState, "hydrated">>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  if (!state.hydrated) return;
  const { hydrated: _hydrated, ...saved } = state;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
}

function sanitizePresence(raw: unknown): GoalPresence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { present: r.present === true, outsideSinceMs: ms(r.outsideSinceMs), leftAtMs: ms(r.leftAtMs) };
}

function sanitizePrompt(raw: unknown): CheckInPrompt | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    (r.kind !== "leave" && r.kind !== "return") ||
    typeof r.place !== "string" ||
    !Array.isArray(r.goalIds) ||
    typeof r.atMs !== "number"
  ) {
    return null;
  }
  const goalIds = r.goalIds.filter((id): id is string => typeof id === "string");
  return goalIds.length > 0 ? { id: r.id, kind: r.kind, place: r.place, goalIds, atMs: r.atMs } : null;
}

/** Loads the saved visits once. Safe to call repeatedly. A saved earlier day is dropped. */
export function startGoalVisits(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let presence: Record<string, GoalPresence> = {};
    let prompts: CheckInPrompt[] = [];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      if (saved && saved.day === dayKey()) {
        if (saved.presence && typeof saved.presence === "object") {
          for (const [id, entry] of Object.entries(saved.presence)) {
            const p = sanitizePresence(entry);
            if (p) presence[id] = p;
          }
        }
        if (Array.isArray(saved.prompts)) {
          prompts = saved.prompts.map(sanitizePrompt).filter((p): p is CheckInPrompt => p != null);
        }
      }
    } catch {
      presence = {};
      prompts = [];
    }
    state = { day: dayKey(), presence, prompts, hydrated: true };
    commit({});
  })();
  return loadPromise;
}

// ─── Updates ──────────────────────────────────────────────────────────────────

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** One prompt per place; a newer prompt takes its goals out of older ones. */
function queuePrompts(
  prompts: CheckInPrompt[],
  kind: CheckInPrompt["kind"],
  goals: ScheduledItem[],
  atMs: number,
): CheckInPrompt[] {
  if (goals.length === 0) return prompts;
  const byPlace = new Map<string, string[]>();
  for (const goal of goals) {
    const ids = byPlace.get(goal.location) ?? [];
    ids.push(goal.id);
    byPlace.set(goal.location, ids);
  }
  const taken = new Set(goals.map((g) => g.id));
  const kept = prompts
    .map((p) => ({ ...p, goalIds: p.goalIds.filter((id) => !taken.has(id)) }))
    .filter((p) => p.goalIds.length > 0);
  for (const [place, goalIds] of byPlace) kept.push({ id: newId(), kind, place, goalIds, atMs });
  return kept;
}

/**
 * Follows the user in and out of the places of goals they've reached today,
 * queueing a prompt on leaving or coming back while goals there are unticked.
 * `atMs` is when the fix was taken.
 */
export function updateGoalVisits(point: LatLngPoint, atMs: number = Date.now()): void {
  if (!state.hydrated) return;
  const today = dayKey(new Date(atMs));
  const fresh = state.day !== today;
  const before = fresh ? {} : state.presence;
  const presence: Record<string, GoalPresence> = {};
  const leaving: ScheduledItem[] = [];
  const returning: ScheduledItem[] = [];
  let changed = fresh;

  for (const item of getScheduledItems()) {
    if (item.reachedAtMs == null) continue;
    const distance = haversineMeters(point, item);
    const was = before[item.id] ?? {
      // Just reached (or reached before visits were tracked): there now if close.
      present: distance <= VISIT_LEAVE_RADIUS_METERS,
      outsideSinceMs: null,
      leftAtMs: null,
    };
    let now: GoalPresence = was;

    if (was.present) {
      if (distance <= VISIT_LEAVE_RADIUS_METERS) {
        if (was.outsideSinceMs != null) now = { ...was, outsideSinceMs: null };
      } else if (was.outsideSinceMs == null) {
        now = { ...was, outsideSinceMs: atMs };
      } else if (atMs - was.outsideSinceMs >= LEAVE_CONFIRM_MS) {
        now = { present: false, outsideSinceMs: null, leftAtMs: was.outsideSinceMs };
        if (!item.completed) leaving.push(item);
      }
    } else if (distance <= VISIT_ENTER_RADIUS_METERS) {
      now = { present: true, outsideSinceMs: null, leftAtMs: was.leftAtMs };
      if (!item.completed && was.leftAtMs != null && atMs - was.leftAtMs >= MIN_AWAY_MS) {
        returning.push(item);
      }
    }

    presence[item.id] = now;
    if (now !== before[item.id]) changed = true;
  }
  // Goals that were removed, moved or are no longer reached drop out.
  if (Object.keys(before).some((id) => !(id in presence))) changed = true;
  if (!changed) return;

  // Older prompts only keep goals that are still to tick off.
  const unticked = new Set(
    getScheduledItems()
      .filter((item) => item.reachedAtMs != null && !item.completed)
      .map((item) => item.id),
  );
  let prompts = fresh
    ? []
    : state.prompts
        .map((p) => ({ ...p, goalIds: p.goalIds.filter((id) => unticked.has(id)) }))
        .filter((p) => p.goalIds.length > 0);
  prompts = queuePrompts(prompts, "leave", leaving, atMs);
  prompts = queuePrompts(prompts, "return", returning, atMs);
  commit({ day: today, presence, prompts });
}

/** Closes a prompt, answered or put off with "Not yet". */
export function dismissCheckInPrompt(id: string): void {
  if (!state.prompts.some((p) => p.id === id)) return;
  commit({ prompts: state.prompts.filter((p) => p.id !== id) });
}

// ─── Reads ────────────────────────────────────────────────────────────────────

function getPendingPrompt(): CheckInPrompt | null {
  return state.day === dayKey() ? (state.prompts[0] ?? null) : null;
}

/** The prompt to show now, oldest first. */
export function usePendingCheckInPrompt(): CheckInPrompt | null {
  return useSyncExternalStore(subscribe, getPendingPrompt);
}

/** True while the user is at a place with a reached goal still to tick off. */
function isAtUnfinishedGoal(): boolean {
  if (state.day !== dayKey()) return false;
  for (const item of getScheduledItems()) {
    if (item.reachedAtMs != null && !item.completed && state.presence[item.id]?.present) return true;
  }
  return false;
}

/**
 * Location tracking is needed while some goal is still to be reached, or the
 * user is at a place with unticked goals, so that leaving it is noticed.
 */
export function needsGoalTracking(): boolean {
  return hasUnreachedGoals() || isAtUnfinishedGoal();
}

function subscribeTracking(listener: Listener): () => void {
  const unsubscribeSchedule = subscribeSchedule(listener);
  const unsubscribeVisits = subscribe(listener);
  return () => {
    unsubscribeSchedule();
    unsubscribeVisits();
  };
}

/** Re-renders only when the answer flips. */
export function useNeedsGoalTracking(): boolean {
  return useSyncExternalStore(subscribeTracking, needsGoalTracking);
}
