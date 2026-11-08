import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useSyncExternalStore } from "react";

import type { GoalFields } from "@/components/schedule/scheduleTypes";
import type { GoalRecord } from "@/lib/dayHistory";
import { addDays } from "@/lib/calendarGrid";
import { occursOn, sanitizeRepeat, type RepeatRule } from "@/lib/repeatRule";

/**
 * Goals planned for later days, saved on the phone: one-off goals for a
 * future day and repeating goals. They stay out of the live schedule, and so
 * out of XP and health, until their day starts. Then `dailyProgress` copies
 * that day's goals into `scheduleStore` with `takePlansForDay`.
 */

const STORAGE_KEY = "goalPlans";

export type GoalPlan = GoalFields & {
  id: string;
  /** The goal's day, or a repeating goal's first day. */
  startDay: string;
  /** Null for a one-off goal. */
  repeat: RepeatRule | null;
  /** A repeating goal's last day, once it has been ended. */
  endDay: string | null;
  /** Days a repeating goal was removed from on their own. */
  skipDays: string[];
};

export type NewGoalPlan = GoalFields &
  Pick<GoalPlan, "startDay" | "repeat"> & {
    /** A repeating goal's last day; left out or null repeats forever. */
    endDay?: string | null;
  };

type StoreState = {
  plans: ReadonlyMap<string, GoalPlan>;
  hydrated: boolean;
};

let state: StoreState = { plans: new Map(), hydrated: false };
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void startGoalPlans();
  return () => listeners.delete(listener);
}

function commit(plans: ReadonlyMap<string, GoalPlan>): void {
  state = { ...state, plans };
  listeners.forEach((l) => l());
  if (!state.hydrated) return;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(plans.values()))).catch(() => {});
}

function sanitizePlan(raw: unknown): GoalPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.title !== "string" ||
    typeof r.startDay !== "string" ||
    typeof r.latitude !== "number" ||
    typeof r.longitude !== "number"
  ) {
    return null;
  }
  return {
    ...(r as unknown as GoalPlan),
    repeat: sanitizeRepeat(r.repeat),
    endDay: typeof r.endDay === "string" ? r.endDay : null,
    skipDays: Array.isArray(r.skipDays) ? r.skipDays.filter((d): d is string => typeof d === "string") : [],
  };
}

/** Loads saved plans once. Safe to call repeatedly. */
export function startGoalPlans(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const plans = new Map(state.plans);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(list)) {
        for (const entry of list) {
          const plan = sanitizePlan(entry);
          if (plan && !plans.has(plan.id)) plans.set(plan.id, plan);
        }
      }
    } catch {
      // Start with no plans.
    }
    state = { ...state, hydrated: true };
    commit(plans);
  })();
  return loadPromise;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** True when `plan` has a goal on `day`. */
export function planOccursOn(plan: GoalPlan, day: string): boolean {
  if (plan.endDay != null && day > plan.endDay) return false;
  if (plan.skipDays.includes(day)) return false;
  return occursOn(plan.startDay, plan.repeat, day);
}

/** The goal fields of a plan, without its repeat bookkeeping. */
export function planFields(plan: GoalPlan): GoalFields {
  const { id: _id, startDay: _start, repeat: _repeat, endDay: _end, skipDays: _skip, ...fields } = plan;
  return fields;
}

/** Plans with a goal on `day`, earliest time first (goals with no time last). */
export function plansOn(day: string, plans: Iterable<GoalPlan> = state.plans.values()): GoalPlan[] {
  const found: GoalPlan[] = [];
  for (const plan of plans) if (planOccursOn(plan, day)) found.push(plan);
  return found.sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));
}

/** A planned goal on a day that ended without Lua open, recorded as missed. */
export function missedGoalRecord(plan: GoalPlan, day: string): GoalRecord {
  return {
    id: `${plan.id}@${day}`,
    title: plan.title,
    location: plan.location,
    time: plan.time,
    themeKey: plan.themeKey,
    completed: false,
    completedAtMs: null,
    ...(plan.note ? { note: plan.note } : {}),
    ...(plan.repeat ? { repeating: true } : {}),
  };
}

export function getGoalPlan(id: string): GoalPlan | undefined {
  return state.plans.get(id);
}

/** Every saved plan. The array keeps its identity until a plan changes. */
export function useGoalPlans(): GoalPlan[] {
  const snap = useSyncExternalStore(subscribe, () => state);
  return useMemo(() => Array.from(snap.plans.values()), [snap]);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function addGoalPlan(data: NewGoalPlan): string {
  const id = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const next = new Map(state.plans);
  next.set(id, { ...data, id, endDay: data.endDay ?? null, skipDays: [] });
  commit(next);
  return id;
}

export function updateGoalPlan(id: string, changes: Partial<Omit<GoalPlan, "id">>): void {
  const plan = state.plans.get(id);
  if (!plan) return;
  const next = new Map(state.plans);
  next.set(id, { ...plan, ...changes });
  commit(next);
}

export function removeGoalPlan(id: string): void {
  if (!state.plans.has(id)) return;
  const next = new Map(state.plans);
  next.delete(id);
  commit(next);
}

/** Drops one day from a repeating goal, keeping the rest. */
export function skipGoalPlanDay(id: string, day: string): void {
  const plan = state.plans.get(id);
  if (!plan || plan.skipDays.includes(day)) return;
  updateGoalPlan(id, { skipDays: [...plan.skipDays, day] });
}

/** Stops a plan before `day`. A plan that hadn't started by then is removed. */
export function endGoalPlanBefore(id: string, day: string): void {
  const plan = state.plans.get(id);
  if (!plan) return;
  if (plan.startDay >= day) removeGoalPlan(id);
  else updateGoalPlan(id, { endDay: addDays(day, -1) });
}

/**
 * Changes a repeating goal from `day` on ("this and future goals"): the
 * days before `day` keep the old plan, and a new plan starting on `day`
 * holds the changes. Returns the id of the plan now covering `day`.
 */
export function splitGoalPlanAt(id: string, day: string, changes: NewGoalPlan): string {
  const plan = state.plans.get(id);
  if (plan && plan.startDay >= day) {
    updateGoalPlan(id, { ...changes, startDay: day, endDay: changes.endDay ?? null });
    return id;
  }
  if (plan) endGoalPlanBefore(id, day);
  const newId = addGoalPlan({ ...changes, startDay: day });
  const laterSkips = plan?.skipDays.filter((d) => d > day) ?? [];
  if (laterSkips.length > 0) updateGoalPlan(newId, { skipDays: laterSkips });
  return newId;
}

/**
 * The goals for a day that is starting, ready for the live schedule. Plans
 * with nothing left after `day` are removed. Call once per day, after any
 * skipped days have been recorded.
 */
export function takePlansForDay(day: string): (GoalFields & { seriesId?: string })[] {
  const goals = plansOn(day).map((plan) => ({
    ...planFields(plan),
    ...(plan.repeat ? { seriesId: plan.id } : {}),
  }));
  const next = new Map(state.plans);
  let changed = false;
  for (const plan of state.plans.values()) {
    const finished = plan.repeat == null ? plan.startDay <= day : plan.endDay != null && plan.endDay <= day;
    if (finished) {
      next.delete(plan.id);
      changed = true;
    } else if (plan.skipDays.some((d) => d <= day)) {
      next.set(plan.id, { ...plan, skipDays: plan.skipDays.filter((d) => d > day) });
      changed = true;
    }
  }
  if (changed) commit(next);
  return goals;
}
