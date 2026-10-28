import { useSyncExternalStore } from "react";

import { MAP_DEMO } from "@/constants/mapAssets";

export type GameStats = {
  healthRatio: number;
  goalsDone: number;
  goalsTotal: number;
  goalDayPercent: number;
  distanceMiles: number;
  hoursStudied: number;
  goalStreak: number;
  /** Steps walked today, from the step counter or estimated from GPS. */
  stepsToday: number;
};

/**
 * Module-level store — re-initializes from MAP_DEMO on every hot reload
 * (because the module re-executes), but persists across navigation in
 * production where the module only runs once.
 */
let state: GameStats = {
  healthRatio: MAP_DEMO.healthRatio,
  goalsDone: MAP_DEMO.goalsDone,
  goalsTotal: MAP_DEMO.goalsTotal,
  goalDayPercent: MAP_DEMO.goalDayPercent,
  distanceMiles: MAP_DEMO.distanceMiles,
  hoursStudied: MAP_DEMO.hoursStudied,
  goalStreak: MAP_DEMO.goalStreak,
  stepsToday: MAP_DEMO.stepsToday,
};

type Listener = () => void;
const listeners = new Set<Listener>();

/** Runs `listener` after every stats update; for non-React callers. Returns an unsubscribe. */
export function subscribeGameStats(listener: Listener): () => void {
  return subscribe(listener);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GameStats {
  return state;
}

/** Current stats for non-React callers such as background location tasks. */
export function getGameStats(): GameStats {
  return state;
}

/** Call from anywhere to update stats and instantly notify all subscribers. */
export function updateGameStats(partial: Partial<GameStats>): void {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

export function useGameStats() {
  const stats = useSyncExternalStore(subscribe, getSnapshot);
  return { stats, updateStats: updateGameStats };
}

/**
 * Subscribes to one value derived from the stats, re-rendering only when it changes.
 * `select` must return a primitive (or a stable reference), or it re-renders every update.
 */
export function useGameStatsSelector<T>(select: (stats: GameStats) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}
