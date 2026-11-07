import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayKey } from "@/lib/dayKey";
import { getGameStats, subscribeGameStats } from "@/lib/gameStats";
import { haversineMeters, type LatLngPoint } from "@/lib/geo";
import { getGpsMetersToday } from "@/lib/stepCounter";
import {
  ARRIVAL_MIN_METERS,
  ARRIVAL_MIN_STEPS,
  DAILY_STEP_GOAL,
  DAILY_STEP_GOAL_XP,
  GOAL_ARRIVAL_XP,
  SAME_STOP_RADIUS_METERS,
  STEPS_PER_XP,
} from "@/lib/walkingRules";

/**
 * The player's XP, saved on the phone. The total only ever goes up.
 *
 * XP comes from walking: steps, the daily step goal, and goals the player
 * actually walked to. Working time earns none.
 */

const STORAGE_KEY = "xpLedger";

type Ledger = {
  totalXp: number;
  /** Day the daily fields below belong to. */
  day: string;
  /** XP already paid for today's steps. */
  stepXpPaid: number;
  stepGoalPaid: boolean;
  /** Steps and GPS metres at the last paid arrival, or 0 at the start of the day. */
  baselineSteps: number;
  baselineMeters: number;
  /** Where the last paid goal was; goals right next to it pay nothing. */
  lastStop: LatLngPoint | null;
  /** Total XP when the day began, so the day's earnings are `totalXp - dayStartXp`. */
  dayStartXp: number;
};

type LedgerState = Ledger & { hydrated: boolean };

function freshDay(day: string, totalXp: number): Omit<Ledger, "totalXp"> {
  return {
    day,
    dayStartXp: totalXp,
    stepXpPaid: 0,
    stepGoalPaid: false,
    baselineSteps: 0,
    baselineMeters: 0,
    lastStop: null,
  };
}

let state: LedgerState = { totalXp: 0, ...freshDay(dayKey(), 0), hydrated: false };
let loadPromise: Promise<void> | null = null;
/** XP earned on the saved day that had already ended when Lua opened. */
let closedDay: { day: string; xpEarned: number } | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void startXpLedger();
  return () => {
    listeners.delete(listener);
  };
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sanitize(raw: unknown): Ledger | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stop = r.lastStop as Record<string, unknown> | null | undefined;
  return {
    totalXp: finiteOr(r.totalXp, 0),
    day: typeof r.day === "string" ? r.day : "",
    stepXpPaid: finiteOr(r.stepXpPaid, 0),
    stepGoalPaid: r.stepGoalPaid === true,
    baselineSteps: finiteOr(r.baselineSteps, 0),
    baselineMeters: finiteOr(r.baselineMeters, 0),
    // Ledgers saved before per-day XP was tracked count from their saved total.
    dayStartXp: finiteOr(r.dayStartXp, finiteOr(r.totalXp, 0)),
    lastStop:
      stop && typeof stop.latitude === "number" && typeof stop.longitude === "number"
        ? { latitude: stop.latitude, longitude: stop.longitude }
        : null,
  };
}

function commit(next: Partial<Ledger>): void {
  state = { ...state, ...next };
  notify();
  const { hydrated: _hydrated, ...ledger } = state;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)).catch(() => {});
}

/** Pays XP for new steps and for reaching the daily step goal. */
function syncStepXp(): void {
  if (!state.hydrated) return;
  const steps = getGameStats().stepsToday;
  const earned = Math.floor(steps / STEPS_PER_XP);
  const next: Partial<Ledger> = {};
  let gained = 0;
  if (earned > state.stepXpPaid) {
    gained += earned - state.stepXpPaid;
    next.stepXpPaid = earned;
  }
  if (!state.stepGoalPaid && steps >= DAILY_STEP_GOAL) {
    gained += DAILY_STEP_GOAL_XP;
    next.stepGoalPaid = true;
  }
  if (gained > 0) commit({ ...next, totalXp: state.totalXp + gained });
}

/** Loads the saved XP once and starts paying for steps. Safe to call repeatedly. */
export function startXpLedger(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let saved: Ledger | null = null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) saved = sanitize(JSON.parse(raw));
    } catch {
      // Start from zero.
    }
    const today = dayKey();
    if (saved && saved.day !== today && saved.day) {
      closedDay = { day: saved.day, xpEarned: Math.max(0, saved.totalXp - saved.dayStartXp) };
    }
    const ledger: Ledger = saved
      ? saved.day === today
        ? saved
        : { totalXp: saved.totalXp, ...freshDay(today, saved.totalXp) }
      : { totalXp: 0, ...freshDay(today, 0) };
    state = { ...ledger, hydrated: true };
    notify();
    subscribeGameStats(syncStepXp);
    syncStepXp();
  })();
  return loadPromise;
}

/**
 * Called when a goal is completed. Pays GOAL_ARRIVAL_XP only when the player
 * walked there: enough steps or GPS distance since the last paid arrival, and
 * not right next to the last paid goal. Returns whether XP was paid.
 */
export async function awardGoalArrival(goal: LatLngPoint): Promise<boolean> {
  // Read progress now, before waiting, so it matches the moment of arrival.
  const steps = getGameStats().stepsToday;
  const meters = getGpsMetersToday();
  await startXpLedger();

  const walkedSteps = steps - state.baselineSteps;
  const walkedMeters = meters - state.baselineMeters;
  const walked = walkedSteps >= ARRIVAL_MIN_STEPS || walkedMeters >= ARRIVAL_MIN_METERS;
  const sameStop =
    state.lastStop != null && haversineMeters(goal, state.lastStop) <= SAME_STOP_RADIUS_METERS;
  if (!walked || sameStop) return false;

  commit({
    totalXp: state.totalXp + GOAL_ARRIVAL_XP,
    baselineSteps: steps,
    baselineMeters: meters,
    lastStop: { latitude: goal.latitude, longitude: goal.longitude },
  });
  return true;
}

/**
 * Starts a new day's XP bookkeeping. Call after today's steps reset to 0, so
 * yesterday's steps aren't paid twice.
 */
export function beginXpDay(day: string): void {
  if (!state.hydrated || state.day === day) return;
  commit(freshDay(day, state.totalXp));
}

/** XP earned on `day`: today's running figure, or the day that ended while Lua was closed. */
export function xpEarnedOn(day: string): number {
  if (state.day === day) return Math.max(0, state.totalXp - state.dayStartXp);
  if (closedDay?.day === day) return closedDay.xpEarned;
  return 0;
}

function getTotalXp(): number {
  return state.totalXp;
}

function getXpEarnedToday(): number {
  return Math.max(0, state.totalXp - state.dayStartXp);
}

/** XP earned so far today. */
export function useXpEarnedToday(): number {
  return useSyncExternalStore(subscribe, getXpEarnedToday);
}

function getHydrated(): boolean {
  return state.hydrated;
}

/** Lifetime XP earned. Re-renders only when it changes. */
export function useLedgerXp(): number {
  return useSyncExternalStore(subscribe, getTotalXp);
}

/** False until saved XP has loaded, so screens don't treat the starting 0 as real. */
export function useXpLoaded(): boolean {
  return useSyncExternalStore(subscribe, getHydrated);
}
