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
};

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GameStats {
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
