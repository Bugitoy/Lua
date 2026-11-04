import AsyncStorage from "@react-native-async-storage/async-storage";

import { dayKey, daysBetween } from "@/lib/dayKey";
import { getGameStats, subscribeGameStats, updateGameStats } from "@/lib/gameStats";
import {
  beginStepDay,
  getGpsMetersToday,
  startStepCounter,
  stepsOnDay,
} from "@/lib/stepCounter";
import { healthAfterDay, type DayResult } from "@/lib/walkingRules";
import { beginXpDay, startXpLedger } from "@/lib/xpLedger";

/**
 * Owns the calendar day. Saves Lua's health and today's progress on the
 * phone, and when a day ends, grades it (steps + goals) to heal or hurt Lua.
 * Days that passed while Lua was closed are graded on the next launch.
 */

const STORAGE_KEY = "dailyProgress";
/** Wait this long after a change before saving, so a walk doesn't write every step. */
const SAVE_DELAY_MS = 3000;

type SavedDay = DayResult & {
  day: string;
  healthRatio: number;
  gpsMeters: number;
};

let currentDay: string | null = null;
let startPromise: Promise<void> | null = null;
let rolling = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved = "";

function sanitize(raw: unknown): SavedDay | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
  if (typeof r.day !== "string" || typeof r.healthRatio !== "number") return null;
  return {
    day: r.day,
    healthRatio: Math.min(1, Math.max(0, r.healthRatio)),
    stepsToday: num(r.stepsToday),
    gpsMeters: num(r.gpsMeters),
    goalsDone: num(r.goalsDone),
    goalsTotal: num(r.goalsTotal),
  };
}

/** Saves now. Also called when Lua goes to the background, in case it's closed. */
export function saveDailyProgress(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!currentDay) return;
  const stats = getGameStats();
  const saved: SavedDay = {
    day: currentDay,
    healthRatio: stats.healthRatio,
    stepsToday: stats.stepsToday,
    gpsMeters: getGpsMetersToday(),
    goalsDone: stats.goalsDone,
    goalsTotal: stats.goalsTotal,
  };
  const json = JSON.stringify(saved);
  if (json === lastSaved) return;
  lastSaved = json;
  AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});
}

function scheduleSave(): void {
  if (!saveTimer) saveTimer = setTimeout(saveDailyProgress, SAVE_DELAY_MS);
}

/**
 * Grades `lastDay` and every day skipped after it, up to (not including) `today`.
 * On iOS the phone's step history fills in steps Lua didn't see.
 */
async function closeDays(
  health: number,
  lastDay: string,
  last: DayResult,
  today: string,
): Promise<number> {
  const history = await stepsOnDay(lastDay);
  let next = healthAfterDay(health, {
    ...last,
    stepsToday: Math.max(last.stepsToday, history ?? 0),
  });
  for (const skipped of daysBetween(lastDay, today)) {
    const steps = (await stepsOnDay(skipped)) ?? 0;
    next = healthAfterDay(next, { stepsToday: steps, goalsDone: 0, goalsTotal: 0 });
  }
  return next;
}

/** Restores today's progress, grades any days missed while closed, and starts counting. */
export function startDailyProgress(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    void startXpLedger();

    let saved: SavedDay | null = null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) saved = sanitize(JSON.parse(raw));
    } catch {
      // Start fresh.
    }

    const today = dayKey();
    const sameDay = saved?.day === today;
    await startStepCounter(
      saved && sameDay
        ? { day: today, steps: saved.stepsToday, gpsMeters: saved.gpsMeters }
        : { day: today, steps: 0, gpsMeters: 0 },
    );

    if (saved) {
      const healthRatio =
        saved.day < today
          ? await closeDays(saved.healthRatio, saved.day, saved, today)
          : saved.healthRatio;
      updateGameStats({ healthRatio });
    }

    currentDay = today;
    subscribeGameStats(scheduleSave);
    saveDailyProgress();
  })();
  return startPromise;
}

/** Ends the day if the date has changed. Cheap to call often. */
export async function checkDayRollover(): Promise<void> {
  const lastDay = currentDay;
  if (!lastDay || rolling) return;
  const today = dayKey();
  if (today <= lastDay) return;

  rolling = true;
  try {
    const stats = getGameStats();
    const healthRatio = await closeDays(
      stats.healthRatio,
      lastDay,
      {
        stepsToday: stats.stepsToday,
        goalsDone: stats.goalsDone,
        goalsTotal: stats.goalsTotal,
      },
      today,
    );
    currentDay = today;
    // Steps go back to 0 before the XP day resets, so yesterday's steps aren't paid twice.
    beginStepDay(today);
    beginXpDay(today);
    updateGameStats({ healthRatio, goalsDone: 0, goalDayPercent: 0 });
    saveDailyProgress();
  } finally {
    rolling = false;
  }
}
