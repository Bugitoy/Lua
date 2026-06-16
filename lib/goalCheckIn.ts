import { haversineMeters, type LatLngPoint } from "@/lib/geo";
import { getScheduledItems, markGoalCompleted } from "@/lib/scheduleStore";
import { getStudySession, stopStudySession } from "@/lib/studySession";

export const GOAL_ARRIVAL_RADIUS_METERS = 25;
export const STUDY_EXIT_RADIUS_METERS = 50;

/**
 * Completes every unfinished goal within arrival range of `point` and ends the
 * study session once the user has walked away from its goal. Shared by the
 * map screen and background location tracking.
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

  for (const item of items) {
    if (
      !item.completed &&
      haversineMeters(point, item) <= GOAL_ARRIVAL_RADIUS_METERS
    ) {
      markGoalCompleted(item.id);
    }
  }
}
