import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { dayKey, startOfDay } from "@/lib/dayKey";
import { getGameStats, subscribeGameStats } from "@/lib/gameStats";
import { getGpsMetersToday, stepsBetween } from "@/lib/stepCounter";

/**
 * Today's steps, GPS metres and work time split by hour, for the Stats
 * "Today" chart. Saved on the phone so a restart keeps the shape of the day.
 *
 * New progress goes into the hour it is noticed in: whatever the day's totals
 * grew by since the hours last added up. On iPhone the step hours are re-read
 * from the phone's step history, so walks taken while Lua was closed land in
 * the right hour.
 */

const STORAGE_KEY = "hourlyToday";
const HOURS = 24;

export type HourlyToday = {
  day: string;
  steps: number[];
  meters: number[];
  workHours: number[];
};

function empty(day: string): HourlyToday {
  return {
    day,
    steps: new Array(HOURS).fill(0),
    meters: new Array(HOURS).fill(0),
    workHours: new Array(HOURS).fill(0),
  };
}

let state: HourlyToday = empty(dayKey());
let started = false;
let getWorkToday: () => number = () => 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, 2000);
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function hours(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== HOURS) return new Array(HOURS).fill(0);
  return raw.map((v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0));
}

/** The hour progress is filed under; after midnight but before the day rolls over, the last hour. */
function currentHour(): number {
  return dayKey() > state.day ? HOURS - 1 : new Date().getHours();
}

/** Adds whatever each of today's totals grew by to the current hour. */
function sync(): void {
  const stats = getGameStats();
  const totals = {
    steps: stats.stepsToday,
    meters: getGpsMetersToday(),
    workHours: getWorkToday(),
  };
  const hour = currentHour();
  let next: HourlyToday | null = null;
  for (const key of ["steps", "meters", "workHours"] as const) {
    const grew = totals[key] - sum(state[key]);
    // Ignore rounding noise and readings that went down.
    if (grew > (key === "workHours" ? 1 / 3600 : 0.5)) {
      next ??= { ...state };
      next[key] = state[key].map((v, h) => (h === hour ? v + grew : v));
    }
  }
  if (next) {
    state = next;
    emit();
  }
}

/** iPhone: re-reads today's step hours from the phone's step history. */
export async function refreshStepHours(): Promise<void> {
  const forDay = state.day;
  const start = startOfDay(forDay);
  const now = new Date();
  const lastHour = dayKey(now) === forDay ? now.getHours() : HOURS - 1;
  const readings = await Promise.all(
    Array.from({ length: lastHour + 1 }, (_, h) => {
      const from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h);
      const to = new Date(Math.min(now.getTime(), new Date(from.getTime() + 3_600_000).getTime()));
      return stepsBetween(from, to);
    }),
  );
  if (readings.some((r) => r == null) || state.day !== forDay) return;
  state = { ...state, steps: state.steps.map((v, h) => (h <= lastHour ? (readings[h] ?? 0) : 0)) };
  emit();
}

/**
 * Starts filing progress by hour. Called by `dailyProgress` once today's totals
 * are restored; `workToday` returns today's work hours.
 */
export async function startHourlyToday(today: string, workToday: () => number): Promise<void> {
  getWorkToday = workToday;
  if (started) return;
  started = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<HourlyToday>) : null;
    if (saved?.day === today) {
      state = {
        day: today,
        steps: hours(saved.steps),
        meters: hours(saved.meters),
        workHours: hours(saved.workHours),
      };
    } else {
      state = empty(today);
    }
  } catch {
    state = empty(today);
  }
  for (const l of listeners) l();
  subscribeGameStats(sync);
  sync();
  void refreshStepHours();
}

/** Starts a new day with empty hours. */
export function beginHourlyDay(day: string): void {
  state = empty(day);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHourlyToday(): HourlyToday {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
