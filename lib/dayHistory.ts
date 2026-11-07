import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import type { ScheduleThemeKey } from "@/components/schedule/scheduleTypes";
import { startOfDay } from "@/lib/dayKey";

/**
 * One saved record per finished day: steps, distance, work time, XP, how
 * Lua's health changed, and every goal marked done or missed. Written by
 * `dailyProgress` when a day ends; read by the Stats calendar.
 */

const STORAGE_KEY = "dayHistory";
/** Records older than this many days are dropped. */
const KEEP_DAYS = 731;

export type GoalRecord = {
  id: string;
  title: string;
  location: string;
  time: string;
  themeKey: ScheduleThemeKey;
  completed: boolean;
  completedAtMs: number | null;
};

export type DayRecord = {
  day: string;
  steps: number;
  /** GPS distance walked, in metres. */
  meters: number;
  workHours: number;
  xpEarned: number;
  /** Health when the day started and after it was graded; null when unknown or still in progress. */
  healthBefore: number | null;
  healthAfter: number | null;
  /** Step goal reached and every goal done (the day that heals Lua). */
  fullDay: boolean;
  goals: GoalRecord[];
  /** Made-up day from the dev sample-data button; removable without touching real days. */
  sample?: boolean;
};

export type DayHistory = Readonly<Record<string, DayRecord>>;

let history: DayHistory = {};
let hydrated = false;
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void startDayHistory();
  return () => listeners.delete(listener);
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function sanitize(raw: unknown): DayRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== "string") return null;
  const health = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    day: r.day,
    steps: num(r.steps),
    meters: num(r.meters),
    workHours: num(r.workHours),
    xpEarned: num(r.xpEarned),
    healthBefore: health(r.healthBefore),
    healthAfter: health(r.healthAfter),
    fullDay: r.fullDay === true,
    goals: Array.isArray(r.goals)
      ? (r.goals as Record<string, unknown>[])
          .filter((g) => g && typeof g.id === "string")
          .map((g) => ({
            id: String(g.id),
            title: String(g.title ?? ""),
            location: String(g.location ?? ""),
            time: String(g.time ?? ""),
            themeKey: (g.themeKey as ScheduleThemeKey) ?? "academic",
            completed: g.completed === true,
            completedAtMs: typeof g.completedAtMs === "number" ? g.completedAtMs : null,
          }))
      : [],
    ...(r.sample === true ? { sample: true } : {}),
  };
}

function save(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(history))).catch(() => {});
}

/** Loads saved history once. Safe to call repeatedly. */
export function startDayHistory(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const loaded: Record<string, DayRecord> = {};
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(list)) {
        for (const entry of list) {
          const record = sanitize(entry);
          if (record) loaded[record.day] = record;
        }
      }
    } catch {
      // Start with no history.
    }
    history = { ...loaded, ...history };
    hydrated = true;
    listeners.forEach((l) => l());
  })();
  return loadPromise;
}

/** Saves (or replaces) one day's record and drops records past the keep window. */
export function recordDay(record: DayRecord): void {
  recordDays([record]);
}

/** Saves several records with one write. */
export function recordDays(records: DayRecord[]): void {
  if (records.length === 0) return;
  const next: Record<string, DayRecord> = { ...history };
  let newest = records[0].day;
  for (const record of records) {
    next[record.day] = record;
    if (record.day > newest) newest = record.day;
  }
  const cutoff = startOfDay(newest).getTime() - KEEP_DAYS * 86_400_000;
  for (const day of Object.keys(next)) {
    if (startOfDay(day).getTime() < cutoff) delete next[day];
  }
  history = next;
  listeners.forEach((l) => l());
  if (hydrated) save();
}

/** Removes every sample day, leaving real days alone. Returns how many were removed. */
export function removeSampleDays(): number {
  const next: Record<string, DayRecord> = {};
  let removed = 0;
  for (const [day, record] of Object.entries(history)) {
    if (record.sample) removed++;
    else next[day] = record;
  }
  if (removed === 0) return 0;
  history = next;
  listeners.forEach((l) => l());
  if (hydrated) save();
  return removed;
}

export function getDayHistory(): DayHistory {
  return history;
}

export function hasDayRecord(day: string): boolean {
  return day in history;
}

/** All saved day records. The object keeps its identity until a day is recorded. */
export function useDayHistory(): DayHistory {
  return useSyncExternalStore(subscribe, getDayHistory);
}

/**
 * Full days in a row, counting back from yesterday, plus today if it is
 * already a full day. A missing record (a day with nothing saved) breaks it.
 */
export function streakFrom(records: DayHistory, today: string, todayIsFull: boolean): number {
  let streak = todayIsFull ? 1 : 0;
  const cursor = startOfDay(today);
  for (let i = 0; i < KEEP_DAYS; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    if (!records[`${y}-${m}-${d}`]?.fullDay) break;
    streak++;
  }
  return streak;
}
