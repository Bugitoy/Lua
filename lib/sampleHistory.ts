import type { ScheduleThemeKey } from "@/components/schedule/scheduleTypes";
import { addDays, weekStart, weekdayIndex } from "@/lib/calendarGrid";
import { startOfDay } from "@/lib/dayKey";
import {
  getDayHistory,
  recordDays,
  removeSampleDays,
  type DayRecord,
  type GoalRecord,
} from "@/lib/dayHistory";
import { formatAppTime } from "@/lib/i18n/formatLocale";
import {
  DAILY_STEP_GOAL,
  DAILY_STEP_GOAL_XP,
  GOAL_ARRIVAL_XP,
  STEPS_PER_XP,
  dayScore,
  healthAfterDay,
} from "@/lib/walkingRules";

/**
 * Dev-only made-up history, so the Stats calendar can be seen with a year of
 * data. Sample days are marked `sample` and never replace a real day.
 */

const SAMPLE_DAYS = 365;
/** The most recent days are all full days, so the streak has something to show. */
const RECENT_STREAK_DAYS = 9;

type GoalTemplate = { title: string; location: string; hour: number; minute: number; themeKey: ScheduleThemeKey };

const GOALS: GoalTemplate[] = [
  { title: "Morning coffee", location: "Corner Café", hour: 8, minute: 15, themeKey: "meal" },
  { title: "Standup at the office", location: "Office", hour: 9, minute: 30, themeKey: "academic" },
  { title: "Lunch walk", location: "Riverside Park", hour: 12, minute: 30, themeKey: "meal" },
  { title: "Focus block at the library", location: "Main Library", hour: 14, minute: 0, themeKey: "academic" },
  { title: "Gym session", location: "City Gym", hour: 17, minute: 45, themeKey: "social" },
  { title: "Grocery run", location: "Market Street Grocers", hour: 18, minute: 30, themeKey: "meal" },
  { title: "Dinner with friends", location: "Noodle House", hour: 19, minute: 30, themeKey: "social" },
  { title: "Evening park loop", location: "Lakeside Trail", hour: 20, minute: 0, themeKey: "social" },
];

/** Small seeded random generator, so the same day always gets the same sample. */
function randomFor(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function sampleDay(day: string, ageDays: number, healthBefore: number): DayRecord {
  const rand = randomFor(day);
  const weekRand = randomFor(`week:${weekStart(day)}`);
  const weekend = weekdayIndex(day) >= 5;

  // Some weeks go well, some don't; the year slowly gets better.
  const onStreak = ageDays <= RECENT_STREAK_DAYS;
  const weekMood = 0.45 + weekRand() * 1.1;
  const improvement = 0.6 + 0.5 * (1 - ageDays / SAMPLE_DAYS);
  const base = weekend ? 7000 : 4400;
  const phoneOff = !onStreak && rand() < 0.06;
  const steps = onStreak
    ? Math.round(DAILY_STEP_GOAL + 300 + rand() * 4200)
    : phoneOff
      ? 0
      : Math.max(0, Math.round(base * weekMood * improvement * (0.2 + rand() * 1.3)));

  const goalCount = rand() < 0.15 ? 0 : 1 + Math.floor(rand() * 4);
  // Pick distinct goals in a seeded shuffle, then order them by time of day.
  const pool = [...GOALS];
  const picks: GoalTemplate[] = [];
  while (picks.length < goalCount) picks.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  picks.sort((a, b) => a.hour - b.hour);
  const doneChance = onStreak ? 1 : Math.min(0.95, 0.3 + steps / (DAILY_STEP_GOAL * 1.4));
  const dayStart = startOfDay(day);
  const goals: GoalRecord[] = picks.map((g, i) => {
    const completed = rand() < doneChance;
    const at = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), g.hour, g.minute);
    return {
      id: `sample-${day}-${i}`,
      title: g.title,
      location: g.location,
      time: formatAppTime(at, { hour: "numeric", minute: "2-digit" }),
      themeKey: g.themeKey,
      completed,
      completedAtMs: completed ? at.getTime() + Math.floor(rand() * 25) * 60_000 : null,
    };
  });

  const goalsDone = goals.filter((g) => g.completed).length;
  const result = { stepsToday: steps, goalsDone, goalsTotal: goals.length };
  const xpEarned =
    Math.floor(steps / STEPS_PER_XP) +
    (steps >= DAILY_STEP_GOAL ? DAILY_STEP_GOAL_XP : 0) +
    goalsDone * GOAL_ARRIVAL_XP;

  return {
    day,
    steps,
    meters: Math.round(steps * 0.8 * (0.5 + rand() * 0.4)),
    workHours: weekend ? Math.round(rand() * 2 * 4) / 4 : Math.round((3.5 + rand() * 4.5) * 4) / 4,
    xpEarned,
    healthBefore,
    healthAfter: healthAfterDay(healthBefore, result),
    fullDay: dayScore(result) >= 1,
    goals,
    sample: true,
  };
}

/**
 * Fills the last year (up to yesterday) with sample days, skipping any day
 * that already has a real record. Returns how many days were added.
 */
export function addSampleHistory(today: string): number {
  const existing = getDayHistory();
  const records: DayRecord[] = [];
  let health = 0.5;
  for (let age = SAMPLE_DAYS; age >= 1; age--) {
    const day = addDays(today, -age);
    const real = existing[day];
    if (real && !real.sample) {
      health = real.healthAfter ?? health;
      continue;
    }
    const record = sampleDay(day, age, health);
    health = record.healthAfter ?? health;
    records.push(record);
  }
  recordDays(records);
  return records.length;
}

export { removeSampleDays };
