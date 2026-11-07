import { useMemo } from "react";

import { getDayStartHealth, getDayStartHours } from "@/lib/dailyProgress";
import { dayKey } from "@/lib/dayKey";
import type { DayRecord } from "@/lib/dayHistory";
import { useGameStats } from "@/lib/gameStats";
import { useScheduledItems } from "@/lib/scheduleStore";
import { getGpsMetersToday } from "@/lib/stepCounter";
import { dayScore } from "@/lib/walkingRules";
import { useXpEarnedToday } from "@/lib/xpLedger";

/**
 * Today as a day record, built live from the stores so the Stats calendar and
 * day card update while you walk. `healthAfter` stays null until the day ends.
 */
export function useTodayRecord(): DayRecord {
  const { stats } = useGameStats();
  const goals = useScheduledItems();
  const xpEarned = useXpEarnedToday();

  return useMemo(
    () => ({
      day: dayKey(),
      steps: stats.stepsToday,
      // GPS metres move with every distance update, which also changes `stats`.
      meters: getGpsMetersToday(),
      workHours: Math.max(0, stats.hoursStudied - getDayStartHours()),
      xpEarned,
      healthBefore: getDayStartHealth(),
      healthAfter: null,
      fullDay: dayScore(stats) >= 1,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        location: g.location,
        time: g.time,
        themeKey: g.themeKey,
        completed: g.completed,
        completedAtMs: g.completedAtMs,
      })),
    }),
    [stats, goals, xpEarned],
  );
}
