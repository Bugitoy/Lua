import AsyncStorage from "@react-native-async-storage/async-storage";

import { dayKey, daysBetween } from "@/lib/dayKey";
import {
  getDayHistory,
  hasDayRecord,
  recordDay,
  startDayHistory,
  streakFrom,
  type GoalRecord,
} from "@/lib/dayHistory";
import { getGameStats, subscribeGameStats, updateGameStats } from "@/lib/gameStats";
import { beginHourlyDay, startHourlyToday } from "@/lib/hourlyToday";
import { restoreDistanceMiles } from "@/lib/odometerRecorder";
import {
  clearSchedule,
  getScheduleDay,
  getScheduledItems,
  startSchedule,
  type ScheduledItem,
} from "@/lib/scheduleStore";
import {
  beginStepDay,
  getGpsMetersToday,
  startStepCounter,
  stepsOnDay,
} from "@/lib/stepCounter";
import { DAILY_STEP_GOAL, dayScore, healthAfterDay, type DayResult } from "@/lib/walkingRules";
import { beginXpDay, startXpLedger, xpEarnedOn } from "@/lib/xpLedger";

/**
 * Owns the calendar day. Saves Lua's health and today's progress on the
 * phone. When a day ends it grades it (steps + goals) to heal or hurt Lua,
 * saves the day's record for the Stats calendar, and clears the goals,
 * which last one day. Days that passed while Lua was closed are handled on
 * the next launch.
 */

const STORAGE_KEY = "dailyProgress";
/** Wait this long after a change before saving, so a walk doesn't write every step. */
const SAVE_DELAY_MS = 3000;
/** Days of iPhone step history to fill in the first time history is empty. */
const BACKFILL_DAYS = 7;

type SavedDay = DayResult & {
  day: string;
  healthRatio: number;
  /** Health when this day began. */
  dayStartHealth: number;
  gpsMeters: number;
  /** Lifetime totals, so the profile survives restarts. */
  hoursStudied: number;
  distanceMiles: number;
  /** Lifetime work hours when this day began; today's work time is the difference. */
  dayStartHours: number;
};

/** What's known about a day as it closes. */
type ClosingDay = DayResult & {
  meters: number;
  workHours: number;
  goals: GoalRecord[];
};

let currentDay: string | null = null;
let dayStartHours = 0;
let dayStartHealth: number | null = null;
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
  const healthRatio = Math.min(1, Math.max(0, r.healthRatio));
  return {
    day: r.day,
    healthRatio,
    dayStartHealth:
      typeof r.dayStartHealth === "number" ? Math.min(1, Math.max(0, r.dayStartHealth)) : healthRatio,
    stepsToday: num(r.stepsToday),
    gpsMeters: num(r.gpsMeters),
    goalsDone: num(r.goalsDone),
    goalsTotal: num(r.goalsTotal),
    hoursStudied: num(r.hoursStudied),
    distanceMiles: num(r.distanceMiles),
    dayStartHours: num(r.dayStartHours),
  };
}

function toGoalRecord(item: ScheduledItem): GoalRecord {
  return {
    id: item.id,
    title: item.title,
    location: item.location,
    time: item.time,
    themeKey: item.themeKey,
    completed: item.completed,
    completedAtMs: item.completedAtMs,
  };
}

/** Goals for `day`, if the schedule still holds that day's goals. */
function scheduleGoalsFor(day: string): GoalRecord[] | null {
  return getScheduleDay() === day ? getScheduledItems().map(toGoalRecord) : null;
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
    dayStartHealth: dayStartHealth ?? stats.healthRatio,
    stepsToday: stats.stepsToday,
    gpsMeters: getGpsMetersToday(),
    goalsDone: stats.goalsDone,
    goalsTotal: stats.goalsTotal,
    hoursStudied: stats.hoursStudied,
    distanceMiles: stats.distanceMiles,
    dayStartHours,
  };
  const json = JSON.stringify(saved);
  if (json === lastSaved) return;
  lastSaved = json;
  AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});
}

/** Keeps `goalStreak` in game stats equal to full days in a row. Call after history changes. */
export function syncStreak(): void {
  if (!currentDay) return;
  const stats = getGameStats();
  const todayIsFull = dayScore(stats) >= 1;
  const goalStreak = streakFrom(getDayHistory(), currentDay, todayIsFull);
  if (goalStreak !== stats.goalStreak) updateGameStats({ goalStreak });
}

function onStatsChange(): void {
  syncStreak();
  if (!saveTimer) saveTimer = setTimeout(saveDailyProgress, SAVE_DELAY_MS);
}

/**
 * Grades `lastDay` and every day skipped after it, up to (not including) `today`,
 * and saves a history record for each. On iOS the phone's step history fills
 * in steps Lua didn't see.
 */
async function closeDays(
  health: number,
  lastDay: string,
  last: ClosingDay,
  today: string,
): Promise<number> {
  const phoneSteps = await stepsOnDay(lastDay);
  const result: DayResult = { ...last, stepsToday: Math.max(last.stepsToday, phoneSteps ?? 0) };
  let next = healthAfterDay(health, result);
  recordDay({
    day: lastDay,
    steps: result.stepsToday,
    meters: last.meters,
    workHours: last.workHours,
    xpEarned: xpEarnedOn(lastDay),
    healthBefore: health,
    healthAfter: next,
    fullDay: dayScore(result) >= 1,
    goals: last.goals,
  });

  for (const skipped of daysBetween(lastDay, today)) {
    const steps = (await stepsOnDay(skipped)) ?? 0;
    const before = next;
    next = healthAfterDay(next, { stepsToday: steps, goalsDone: 0, goalsTotal: 0 });
    recordDay({
      day: skipped,
      steps,
      meters: 0,
      workHours: 0,
      xpEarned: 0,
      healthBefore: before,
      healthAfter: next,
      fullDay: steps >= DAILY_STEP_GOAL,
      goals: [],
    });
  }
  return next;
}

/** First run with no history: fill the last week from the iPhone's step history. */
async function backfillSteps(today: string): Promise<void> {
  if (Object.keys(getDayHistory()).length > 0) return;
  const cursor = new Date();
  for (let i = 0; i < BACKFILL_DAYS; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const day = dayKey(cursor);
    if (day >= today || hasDayRecord(day)) continue;
    const steps = await stepsOnDay(day);
    if (steps == null) return; // No step history on this phone.
    recordDay({
      day,
      steps,
      meters: 0,
      workHours: 0,
      xpEarned: 0,
      healthBefore: null,
      healthAfter: null,
      fullDay: steps >= DAILY_STEP_GOAL,
      goals: [],
    });
  }
}

/** Restores today's progress, closes any days missed while Lua was closed, and starts counting. */
export function startDailyProgress(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    let saved: SavedDay | null = null;
    try {
      const [raw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        startXpLedger(),
        startSchedule(),
        startDayHistory(),
      ]);
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
      // Added to anything counted before the saved totals loaded.
      restoreDistanceMiles(saved.distanceMiles);
      updateGameStats({ hoursStudied: saved.hoursStudied + getGameStats().hoursStudied });
      dayStartHours = sameDay ? saved.dayStartHours : saved.hoursStudied;

      let healthRatio = saved.healthRatio;
      if (saved.day < today) {
        const goals = scheduleGoalsFor(saved.day);
        healthRatio = await closeDays(
          saved.healthRatio,
          saved.day,
          {
            stepsToday: saved.stepsToday,
            goalsDone: goals ? goals.filter((g) => g.completed).length : saved.goalsDone,
            goalsTotal: goals ? goals.length : saved.goalsTotal,
            meters: saved.gpsMeters,
            workHours: Math.max(0, saved.hoursStudied - saved.dayStartHours),
            goals: goals ?? [],
          },
          today,
        );
        dayStartHealth = healthRatio;
      } else {
        dayStartHealth = saved.dayStartHealth;
      }
      updateGameStats({ healthRatio });
    }

    // Goals last one day; a schedule left over from an earlier day was just recorded.
    if (getScheduleDay() < today) clearSchedule(today);
    await backfillSteps(today);

    currentDay = today;
    dayStartHealth ??= getGameStats().healthRatio;
    subscribeGameStats(onStatsChange);
    syncStreak();
    saveDailyProgress();
    void startHourlyToday(today, workHoursToday);
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
    const goals = scheduleGoalsFor(lastDay) ?? [];
    const healthRatio = await closeDays(
      stats.healthRatio,
      lastDay,
      {
        stepsToday: stats.stepsToday,
        goalsDone: stats.goalsDone,
        goalsTotal: stats.goalsTotal,
        meters: getGpsMetersToday(),
        workHours: Math.max(0, stats.hoursStudied - dayStartHours),
        goals,
      },
      today,
    );
    currentDay = today;
    dayStartHours = getGameStats().hoursStudied;
    dayStartHealth = healthRatio;
    // Steps go back to 0 before the XP day resets, so yesterday's steps aren't paid twice.
    beginStepDay(today);
    beginHourlyDay(today);
    beginXpDay(today);
    clearSchedule(today);
    updateGameStats({ healthRatio });
    syncStreak();
    saveDailyProgress();
  } finally {
    rolling = false;
  }
}

function workHoursToday(): number {
  return Math.max(0, getGameStats().hoursStudied - dayStartHours);
}

/** Lifetime work hours when today began; today's work time is the difference. */
export function getDayStartHours(): number {
  return dayStartHours;
}

/** Health when today began, or null before it's known. */
export function getDayStartHealth(): number | null {
  return dayStartHealth;
}
