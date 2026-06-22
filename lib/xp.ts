import type { GameStats } from "@/lib/gameStats";

export function xpForStats(
  stats: Pick<GameStats, "goalsDone" | "distanceMiles" | "hoursStudied">,
) {
  return (
    stats.goalsDone * 50 +
    Math.floor(stats.distanceMiles) * 30 +
    stats.hoursStudied * 40
  );
}
