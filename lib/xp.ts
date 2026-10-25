import { useGameStatsSelector, type GameStats } from "@/lib/gameStats";

export function xpForStats(
  stats: Pick<GameStats, "goalsDone" | "distanceMiles" | "hoursStudied">,
) {
  return (
    stats.goalsDone * 50 +
    Math.floor(stats.distanceMiles) * 30 +
    stats.hoursStudied * 40
  );
}

function wholeXp(stats: GameStats): number {
  return Math.floor(xpForStats(stats));
}

/**
 * Whole XP earned from stats. Re-renders only when it ticks over, not on every distance
 * update or study-timer second like `useGameStats` does.
 */
export function useStatsXp(): number {
  return useGameStatsSelector(wholeXp);
}
