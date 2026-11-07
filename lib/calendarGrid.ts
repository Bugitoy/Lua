import { dayKey, startOfDay } from "@/lib/dayKey";

/**
 * Pure layout helpers for the Stats calendar. Weeks run Monday to
 * Sunday. A `null` cell is padding outside the month or year being shown.
 */

export type CalendarView = "week" | "month" | "year";
export type Week = (string | null)[];

function addDaysTo(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function addDays(day: string, n: number): string {
  return dayKey(addDaysTo(startOfDay(day), n));
}

/** 0 for Monday … 6 for Sunday. */
export function weekdayIndex(day: string): number {
  return (startOfDay(day).getDay() + 6) % 7;
}

/** The Monday on or before `day`. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** The 7 days, Monday first, of the week containing `day`. */
export function weekDays(day: string): string[] {
  const monday = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Weeks covering the month containing `day`, padded with null outside the month. */
export function monthWeeks(day: string): Week[] {
  const start = startOfDay(day);
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return weeksBetween(first, last);
}

function weeksBetween(first: Date, last: Date): Week[] {
  const firstKey = dayKey(first);
  const lastKey = dayKey(last);
  const weeks: Week[] = [];
  let cursor = startOfDay(weekStart(firstKey));
  while (dayKey(cursor) <= lastKey) {
    const week: Week = [];
    for (let i = 0; i < 7; i++) {
      const key = dayKey(cursor);
      week.push(key >= firstKey && key <= lastKey ? key : null);
      cursor = addDaysTo(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Every real day in a set of weeks. */
export function daysIn(weeks: Week[]): string[] {
  return weeks.flat().filter((d): d is string => d != null);
}

/** Moves the anchor day one week, month or year forwards (+1) or back (−1). */
export function shiftPeriod(day: string, view: CalendarView, step: 1 | -1): string {
  if (view === "week") return addDays(day, 7 * step);
  const d = startOfDay(day);
  if (view === "month") return dayKey(new Date(d.getFullYear(), d.getMonth() + step, 1));
  return dayKey(new Date(d.getFullYear() + step, 0, 1));
}

/** Shade level for a fraction of a daily target: 0 = none, 1 = under ¼, 2 = under ½, 3 = under the target, 4 = reached it. */
export function shadeLevelForRatio(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (!(ratio > 0)) return 0;
  if (ratio >= 1) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

/** Square colours for each step shade level, light grey then Lua greens. */
export const SHADE_COLORS = ["#e5e7eb", "#bbf7d0", "#4ade80", "#16a34a", "#14532d"] as const;
