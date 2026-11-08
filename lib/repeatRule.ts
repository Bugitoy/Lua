import { startOfDay } from "@/lib/dayKey";

/**
 * How a goal repeats. `weekdays` is Monday to Friday; the others repeat
 * every `every` days, weeks, months or years, counted from the goal's first
 * day. Months and years keep the first day's date, falling back to the last
 * day of shorter months (a goal on the 31st lands on the 30th in April).
 */

export type RepeatUnit = "day" | "week" | "month" | "year";

export type RepeatRule = { unit: "weekdays" } | { unit: RepeatUnit; every: number };

/** The chips in the Repeat row. `custom` opens "Every [− N +] [D W M Y]". */
export type RepeatPreset = "never" | "daily" | "weekdays" | "weekly" | "monthly" | "custom";

export const REPEAT_PRESETS: RepeatPreset[] = ["never", "daily", "weekdays", "weekly", "monthly", "custom"];
export const REPEAT_UNITS: RepeatUnit[] = ["day", "week", "month", "year"];
export const MAX_REPEAT_EVERY = 99;

/** The rule behind a preset chip; null for Never and Custom. */
export function presetRule(preset: RepeatPreset): RepeatRule | null {
  switch (preset) {
    case "daily":
      return { unit: "day", every: 1 };
    case "weekdays":
      return { unit: "weekdays" };
    case "weekly":
      return { unit: "week", every: 1 };
    case "monthly":
      return { unit: "month", every: 1 };
    default:
      return null;
  }
}

/** The chip that shows a saved rule. */
export function presetOf(rule: RepeatRule | null): RepeatPreset {
  if (!rule) return "never";
  if (rule.unit === "weekdays") return "weekdays";
  if (rule.every !== 1 || rule.unit === "year") return "custom";
  return rule.unit === "day" ? "daily" : rule.unit === "week" ? "weekly" : "monthly";
}

/** A rule read back from storage, or null when it isn't one. */
export function sanitizeRepeat(raw: unknown): RepeatRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.unit === "weekdays") return { unit: "weekdays" };
  if (!REPEAT_UNITS.includes(r.unit as RepeatUnit)) return null;
  const every = typeof r.every === "number" ? Math.round(r.every) : 1;
  return { unit: r.unit as RepeatUnit, every: Math.min(MAX_REPEAT_EVERY, Math.max(1, every)) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** True when a goal first set for `startDay` with `rule` happens on `day`. */
export function occursOn(startDay: string, rule: RepeatRule | null, day: string): boolean {
  if (day < startDay) return false;
  if (!rule) return day === startDay;
  const start = startOfDay(startDay);
  const date = startOfDay(day);
  switch (rule.unit) {
    case "weekdays": {
      const weekday = date.getDay();
      return weekday !== 0 && weekday !== 6;
    }
    case "day":
    case "week": {
      // Rounded so a daylight-saving hour doesn't push the count off by one.
      const days = Math.round((date.getTime() - start.getTime()) / 86_400_000);
      return days % (rule.unit === "week" ? 7 * rule.every : rule.every) === 0;
    }
    case "month": {
      const months = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
      const target = Math.min(start.getDate(), daysInMonth(date.getFullYear(), date.getMonth()));
      return months % rule.every === 0 && date.getDate() === target;
    }
    case "year": {
      const years = date.getFullYear() - start.getFullYear();
      const target = Math.min(start.getDate(), daysInMonth(date.getFullYear(), date.getMonth()));
      return years % rule.every === 0 && date.getMonth() === start.getMonth() && date.getDate() === target;
    }
  }
}
