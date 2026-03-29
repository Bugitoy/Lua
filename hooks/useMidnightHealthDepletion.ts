import { useEffect, useRef } from "react";

import { updateGameStats, useGameStats } from "@/lib/gameStats";

/** Max health lost when the user completes 0 goals in a day (25% drop). */
const MAX_DAILY_DEPLETION = 0.25;

/** Minimum health the bar can reach from day-end penalties. */
const HEALTH_FLOOR = 0.05;

function getTodayString(): string {
  return new Date().toDateString(); // e.g. "Sun Mar 29 2026"
}

/**
 * Checks every 30 s whether the calendar date has rolled over.
 * If it has, applies a proportional health depletion based on how many
 * of yesterday's goals were NOT completed, then resets daily goal counters.
 *
 * Depletion formula:
 *   missedRatio = 1 – (goalsDone / goalsTotal)   (0 = all done, 1 = none done)
 *   depletion   = missedRatio * MAX_DAILY_DEPLETION
 *
 * Examples (MAX = 25 %):
 *   All goals done  → 0 % depletion (health unchanged)
 *   Half done       → 12.5 % depletion
 *   No goals done   → 25 % depletion
 */
export function useMidnightHealthDepletion(): void {
  const { stats } = useGameStats();
  const statsRef = useRef(stats);

  // Keep ref current so the interval closure always reads the latest values
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const lastDateRef = useRef(getTodayString());

  useEffect(() => {
    const id = setInterval(() => {
      const today = getTodayString();
      if (today === lastDateRef.current) return;

      // ── Midnight has passed ──────────────────────────────────────────
      lastDateRef.current = today;

      const { goalsDone, goalsTotal, healthRatio } = statsRef.current;

      let newHealth = healthRatio;
      if (goalsTotal > 0) {
        const missedRatio = 1 - goalsDone / goalsTotal;
        const depletion = missedRatio * MAX_DAILY_DEPLETION;
        newHealth = Math.max(HEALTH_FLOOR, healthRatio - depletion);
        // Round to 3 decimal places to avoid floating-point noise
        newHealth = Math.round(newHealth * 1000) / 1000;
      }

      updateGameStats({
        healthRatio: newHealth,
        goalsDone: 0,
        goalDayPercent: 0,
      });
    }, 30_000); // poll every 30 s

    return () => clearInterval(id);
  }, []); // runs once; reads latest state via statsRef
}
