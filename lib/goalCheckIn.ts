import { haversineMeters, type LatLngPoint } from "@/lib/geo";
import {
  getScheduledItems,
  markGoalCompleted,
  markGoalsReached,
} from "@/lib/scheduleStore";
import { getStudySession, stopStudySession } from "@/lib/studySession";
import { measureGoalArrival, payGoalArrival } from "@/lib/xpLedger";

export const GOAL_ARRIVAL_RADIUS_METERS = 25;
export const STUDY_EXIT_RADIUS_METERS = 50;

/**
 * Marks every goal within arrival range of `point` as reached, so the user can
 * tick it off, and ends the study session once the user has walked away from
 * its goal. Shared by the map screen and background location tracking.
 *
 * Goals reached together are one visit: it earns XP only if the user walked
 * there (see `measureGoalArrival`), paid when one of its goals is ticked off.
 */
export function checkInAtGoals(point: LatLngPoint): void {
  const items = getScheduledItems();

  const { activeGoalId } = getStudySession();
  if (activeGoalId) {
    const activeGoal = items.find((item) => item.id === activeGoalId);
    if (
      !activeGoal ||
      haversineMeters(point, activeGoal) > STUDY_EXIT_RADIUS_METERS
    ) {
      stopStudySession();
    }
  }

  const arrived = items.filter(
    (item) =>
      item.reachedAtMs == null &&
      haversineMeters(point, item) <= GOAL_ARRIVAL_RADIUS_METERS,
  );
  if (arrived.length === 0) return;

  const arrivalId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const reached = markGoalsReached(
    arrived.map((item) => item.id),
    arrivalId,
  );
  if (reached.length > 0) void measureGoalArrival(arrived[0], arrivalId);
}

/** Ticks off a goal the user has reached today, paying its visit's XP on the first tick. */
export function tickOffGoal(id: string): boolean {
  const item = getScheduledItems().find((goal) => goal.id === id);
  if (!item || !markGoalCompleted(id)) return false;
  if (item.arrivalId) void payGoalArrival(item.arrivalId);
  return true;
}
