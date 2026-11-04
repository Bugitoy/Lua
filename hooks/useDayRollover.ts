import { useEffect } from "react";
import { AppState } from "react-native";

import {
  checkDayRollover,
  saveDailyProgress,
  startDailyProgress,
} from "@/lib/dailyProgress";

/** How often to check whether midnight has passed while Lua is open. */
const ROLLOVER_POLL_MS = 30_000;

/**
 * Starts step counting and saved health/XP, then ends each day at midnight:
 * the day is graded on steps and goals, and Lua heals or takes damage
 * (rules in `lib/walkingRules.ts`). Also catches up when Lua comes back
 * to the foreground on a later day.
 */
export function useDayRollover(): void {
  useEffect(() => {
    void startDailyProgress();
    const id = setInterval(() => void checkDayRollover(), ROLLOVER_POLL_MS);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void checkDayRollover();
      else saveDailyProgress();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
}
