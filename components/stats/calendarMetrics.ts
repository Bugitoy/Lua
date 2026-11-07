import type Ionicons from "@expo/vector-icons/Ionicons";
import type { TFunction } from "i18next";
import type { ComponentProps } from "react";

import { formatXp } from "@/components/achievements/theme";
import { LUA_GREEN } from "@/constants/mapAssets";
import { SHADE_COLORS, shadeLevelForRatio } from "@/lib/calendarGrid";
import type { DayRecord } from "@/lib/dayHistory";
import { formatHours } from "@/lib/formatters";
import { DAILY_STEP_GOAL, METERS_PER_STEP } from "@/lib/walkingRules";

/**
 * The four things the Stats calendar can show — steps, distance, goals and
 * work time — with each one's colours and how a day's value turns into a shade.
 */

export type MetricKey = "steps" | "distance" | "goals" | "work";
export const METRIC_KEYS: MetricKey[] = ["steps", "distance", "goals", "work"];

type Shades = readonly [string, string, string, string, string];

type MetricStyle = {
  icon: ComponentProps<typeof Ionicons>["name"];
  accent: string;
  /** Light grey for nothing, then four shades from light to dark. */
  shades: Shades;
  labelKey: string;
};

export const METRICS: Record<MetricKey, MetricStyle> = {
  steps: { icon: "walk-outline", accent: LUA_GREEN, shades: SHADE_COLORS, labelKey: "stats.day.steps" },
  distance: {
    icon: "footsteps",
    accent: "#3b82f6",
    shades: ["#e5e7eb", "#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"],
    labelKey: "stats.metrics.distance",
  },
  goals: {
    icon: "flag-outline",
    accent: "#0d9488",
    shades: ["#e5e7eb", "#ccfbf1", "#5eead4", "#0d9488", "#134e4a"],
    labelKey: "stats.metrics.goals",
  },
  work: {
    icon: "briefcase-outline",
    accent: "#8b5cf6",
    shades: ["#e5e7eb", "#ede9fe", "#c4b5fd", "#8b5cf6", "#4c1d95"],
    labelKey: "stats.metrics.study",
  },
};

/** A full-colour distance day: about what the daily step goal covers (≈ 3 miles). */
const DISTANCE_TARGET_METERS = DAILY_STEP_GOAL * METERS_PER_STEP;
/** A full-colour work day. */
const WORK_TARGET_HOURS = 8;
const MILES_PER_METER = 0.000621371;

function milesOf(r: DayRecord | undefined): number {
  return Math.round((r?.meters ?? 0) * MILES_PER_METER * 10) / 10;
}

function goalsDone(r: DayRecord | undefined): number {
  return r?.goals.filter((g) => g.completed).length ?? 0;
}

/** The day's value for the bar chart. */
export function metricValue(key: MetricKey, r: DayRecord | undefined): number {
  if (key === "steps") return r?.steps ?? 0;
  if (key === "distance") return milesOf(r);
  if (key === "goals") return goalsDone(r);
  return r?.workHours ?? 0;
}

/** Goals draw the day's total behind the done bar; other metrics have no total. */
export function metricTotal(key: MetricKey, r: DayRecord | undefined): number | null {
  return key === "goals" ? (r?.goals.length ?? 0) : null;
}

/** Shade level 0–4 for a calendar square. */
export function metricShade(key: MetricKey, r: DayRecord | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!r) return 0;
  if (key === "steps") return shadeLevelForRatio(r.steps / DAILY_STEP_GOAL);
  if (key === "distance") return shadeLevelForRatio(r.meters / DISTANCE_TARGET_METERS);
  if (key === "goals") return r.goals.length > 0 ? shadeLevelForRatio(goalsDone(r) / r.goals.length) : 0;
  return shadeLevelForRatio(r.workHours / WORK_TARGET_HOURS);
}

/** The day's value as text, e.g. "5,460", "2.4 mi", "2/3", "6h 30m". */
export function formatMetric(key: MetricKey, r: DayRecord | undefined, t: TFunction, locale: string): string {
  if (key === "steps") return formatXp(r?.steps ?? 0, locale);
  if (key === "distance") return t("stats.summary.distanceValue", { distance: milesOf(r) });
  if (key === "goals") return t("stats.summary.goalsValue", { done: goalsDone(r), total: r?.goals.length ?? 0 });
  return formatHours(r?.workHours ?? 0);
}
