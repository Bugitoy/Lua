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
 * Editing a repeating goal changes it from that day on ("this and future
 * goals"). Earlier days are history and never change.
 */

/** What the New goal sheet saves. */
export type GoalDraft = {
  fields: GoalFields;
  day: string;
  repeat: RepeatRule | null;
};

/** The goal being edited or removed. */
export type GoalTarget =
  | { kind: "today"; item: ScheduledItem }
  | { kind: "planned"; plan: GoalPlan; day: string };

/** Whether a removal takes one day of a repeating goal or that day and every later one. */
export type RemoveScope = "this" | "future";

export function addGoal({ fields, day, repeat }: GoalDraft, today: string): void {
  if (day > today) {
    addGoalPlan({ ...fields, startDay: day, repeat });
    return;
  }
  const seriesId = repeat ? addGoalPlan({ ...fields, startDay: today, repeat }) : undefined;
  addScheduleItem({ ...fields, ...(seriesId ? { seriesId } : {}) });
}

export function editGoal(target: GoalTarget, draft: GoalDraft, today: string): void {
  const { fields, repeat } = draft;

  if (target.kind === "today") {
    const { item } = target;
    if (!item.seriesId && draft.day > today) {
      // Moved to a later day: it leaves today's schedule and becomes a plan.
      removeScheduleItem(item.id);
      addGoalPlan({ ...fields, startDay: draft.day, repeat });
      return;
    }
    let seriesId: string | undefined;
    if (item.seriesId && repeat) {
      seriesId = splitGoalPlanAt(item.seriesId, today, { ...fields, startDay: today, repeat });
    } else if (item.seriesId) {
      // Set to Never: today's goal stays and the repeats after it stop.
      endGoalPlanBefore(item.seriesId, today);
    } else if (repeat) {
      seriesId = addGoalPlan({ ...fields, startDay: today, repeat });
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
    splitGoalPlanAt(plan.id, day, { ...fields, startDay: day, repeat });
  } else {
    // Set to Never: this day keeps the goal and the repeats after it stop.
    endGoalPlanBefore(plan.id, day);
    addGoalPlan({ ...fields, startDay: day, repeat: null });
  }
}

export function removeGoal(target: GoalTarget, scope: RemoveScope, today: string): void {
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
