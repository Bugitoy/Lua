/**
 * The numbers behind Lua's walking-first rules: what earns XP and how a day
 * changes Lua's health. Kept in one place so they are easy to tune.
 */

/** Steps that count as a full walking day. */
export const DAILY_STEP_GOAL = 6000;
/** Average walking stride, for turning GPS distance into steps when there is no step counter. */
export const METERS_PER_STEP = 0.8;

// ─── XP ───────────────────────────────────────────────────────────────────────

/** 1 XP for every this many steps. */
export const STEPS_PER_XP = 100;
/** Paid once a day when the step goal is reached. */
export const DAILY_STEP_GOAL_XP = 100;
/** Paid for a goal you walked to. */
export const GOAL_ARRIVAL_XP = 50;
/** A goal pays only after this many steps since the last paid arrival… */
export const ARRIVAL_MIN_STEPS = 200;
/** …or this much GPS walking, for when steps aren't counted. */
export const ARRIVAL_MIN_METERS = 150;
/** Goals this close to the last paid arrival count as the same stop and pay nothing. */
export const SAME_STOP_RADIUS_METERS = 25;
/** Adding a goal this close to where you stand warns that it won't earn XP. */
export const TOO_CLOSE_GOAL_METERS = 150;

// ─── Health ───────────────────────────────────────────────────────────────────

/** Health gained for a full day: step goal reached and every goal done. */
export const FULL_DAY_HEAL = 0.1;
/** Health lost for a day with no steps and no goals done. */
export const MAX_DAILY_DAMAGE = 0.25;
/** Day-end damage never takes health below this. */
export const HEALTH_FLOOR = 0.05;
/** How much of the day's grade comes from steps; the rest comes from goals. */
const STEP_WEIGHT = 0.6;

export type DayResult = {
  stepsToday: number;
  goalsDone: number;
  goalsTotal: number;
};

/**
 * Grades a day from 0 to 1. Steps count for 60% and goals for 40%. With no
 * goals set the day is graded on steps alone, so setting none isn't a free pass.
 */
export function dayScore({ stepsToday, goalsDone, goalsTotal }: DayResult): number {
  const stepScore = Math.min(Math.max(stepsToday, 0) / DAILY_STEP_GOAL, 1);
  if (goalsTotal <= 0) return stepScore;
  const goalScore = Math.min(Math.max(goalsDone, 0) / goalsTotal, 1);
  return STEP_WEIGHT * stepScore + (1 - STEP_WEIGHT) * goalScore;
}

/**
 * Health after a day ends. A full day heals; anything less costs health in
 * proportion to how far short it fell.
 *
 *   6,000 steps + all goals → +10%
 *   3,000 steps + all goals → −7.5%
 *   no steps, no goals      → −25%
 */
export function healthAfterDay(health: number, day: DayResult): number {
  const score = dayScore(day);
  const next =
    score >= 1
      ? Math.min(1, health + FULL_DAY_HEAL)
      : Math.max(HEALTH_FLOOR, health - (1 - score) * MAX_DAILY_DAMAGE);
  // Round to 3 decimal places to avoid floating-point noise.
  return Math.round(next * 1000) / 1000;
}
