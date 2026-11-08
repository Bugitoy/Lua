import type { GoalFields } from "@/components/schedule/scheduleTypes";
import {
  addGoalPlan,
  endGoalPlanBefore,
  removeGoalPlan,
  skipGoalPlanDay,
  splitGoalPlanAt,
  type GoalPlan,
} from "@/lib/goalPlans";
import type { RepeatRule } from "@/lib/repeatRule";
import {
  addScheduleItem,
  removeScheduleItem,
  updateScheduleItem,
  type ScheduledItem,
} from "@/lib/scheduleStore";

/**
 * Adding, editing and removing goals from the Schedule tab. A goal for
 * today goes straight into the live schedule; a goal for a later day is a
 * plan until that day starts. A repeating goal is a plan whose copy for
 * today, if any, is linked to it by `seriesId`.
 *
 * Editing or removing one day of a repeating goal asks for a scope: just
 * that day ("this goal only") or that day and every repeat after it ("this
 * and future goals"). Earlier days are history and never change.
 */

/** What the New goal sheet saves. */
export type GoalDraft = {
  fields: GoalFields;
  day: string;
  repeat: RepeatRule | null;
  /** The last day a repeating goal happens; null repeats forever. */
  until: string | null;
};

/** The goal being edited or removed. */
export type GoalTarget =
  | { kind: "today"; item: ScheduledItem }
  | { kind: "planned"; plan: GoalPlan; day: string };

/** Whether a change takes one day of a repeating goal or that day and every later one. */
export type RepeatScope = "this" | "future";

export function addGoal({ fields, day, repeat, until }: GoalDraft, today: string): void {
  if (day > today) {
    addGoalPlan({ ...fields, startDay: day, repeat, endDay: repeat ? until : null });
    return;
  }
  const seriesId = repeat ? addGoalPlan({ ...fields, startDay: today, repeat, endDay: until }) : undefined;
  addScheduleItem({ ...fields, ...(seriesId ? { seriesId } : {}) });
}

export function editGoal(target: GoalTarget, draft: GoalDraft, today: string, scope: RepeatScope = "future"): void {
  const { fields, repeat } = draft;
  const endDay = repeat ? draft.until : null;

  if (scope === "this" && isRepeating(target)) {
    if (target.kind === "today") {
      // Only today's copy changes; it stays one day of the repeat.
      updateScheduleItem(target.item.id, { ...fields, seriesId: target.item.seriesId });
    } else {
      // That day leaves the repeat and becomes its own goal with the changes.
      skipGoalPlanDay(target.plan.id, target.day);
      addGoalPlan({ ...fields, startDay: target.day, repeat: null });
    }
    return;
  }

  if (target.kind === "today") {
    const { item } = target;
    if (!item.seriesId && draft.day > today) {
      // Moved to a later day: it leaves today's schedule and becomes a plan.
      removeScheduleItem(item.id);
      addGoalPlan({ ...fields, startDay: draft.day, repeat, endDay });
      return;
    }
    let seriesId: string | undefined;
    if (item.seriesId && repeat) {
      seriesId = splitGoalPlanAt(item.seriesId, today, { ...fields, startDay: today, repeat, endDay });
    } else if (item.seriesId) {
      // Set to Never: today's goal stays and the repeats after it stop.
      endGoalPlanBefore(item.seriesId, today);
    } else if (repeat) {
      seriesId = addGoalPlan({ ...fields, startDay: today, repeat, endDay });
    }
    updateScheduleItem(item.id, { ...fields, seriesId });
    return;
  }

  const { plan, day } = target;
  if (!plan.repeat) {
    removeGoalPlan(plan.id);
    addGoal(draft, today);
    return;
  }
  if (repeat) {
    splitGoalPlanAt(plan.id, day, { ...fields, startDay: day, repeat, endDay });
  } else {
    // Set to Never: this day keeps the goal and the repeats after it stop.
    endGoalPlanBefore(plan.id, day);
    addGoalPlan({ ...fields, startDay: day, repeat: null });
  }
}

export function removeGoal(target: GoalTarget, scope: RepeatScope, today: string): void {
  if (target.kind === "today") {
    removeScheduleItem(target.item.id);
    if (scope === "future" && target.item.seriesId) endGoalPlanBefore(target.item.seriesId, today);
    return;
  }
  const { plan, day } = target;
  if (!plan.repeat) removeGoalPlan(plan.id);
  else if (scope === "this") skipGoalPlanDay(plan.id, day);
  else endGoalPlanBefore(plan.id, day);
}

/** True when the target is one day of a repeating goal. */
export function isRepeating(target: GoalTarget): boolean {
  return target.kind === "today" ? !!target.item.seriesId : target.plan.repeat != null;
}
