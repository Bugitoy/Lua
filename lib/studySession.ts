import { useSyncExternalStore } from "react";

import { updateGameStats } from "@/lib/gameStats";

type StudySessionState = {
  activeGoalId: string | null;
  startedAtMs: number | null;
  baseHoursStudied: number;
  elapsedMs: number;
};

let state: StudySessionState = {
  activeGoalId: null,
  startedAtMs: null,
  baseHoursStudied: 0,
  elapsedMs: 0,
};

type Listener = () => void;
const listeners = new Set<Listener>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function setState(next: StudySessionState): void {
  state = next;
  notify();
}

function stopTick(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function tick(): void {
  if (!state.startedAtMs || !state.activeGoalId) return;
  const elapsedMs = Math.max(0, Date.now() - state.startedAtMs);
  const liveHours = state.baseHoursStudied + elapsedMs / 3_600_000;
  state = { ...state, elapsedMs };
  updateGameStats({ hoursStudied: liveHours });
  notify();
}

function startTick(): void {
  stopTick();
  tickTimer = setInterval(tick, 1000);
}

export function startStudySession(goalId: string, currentHoursStudied: number): void {
  if (!goalId) return;
  if (state.activeGoalId === goalId && state.startedAtMs) return;

  // Ensure at most one active session at a time.
  if (state.activeGoalId && state.startedAtMs) {
    stopStudySession();
  }

  const startedAtMs = Date.now();
  setState({
    activeGoalId: goalId,
    startedAtMs,
    baseHoursStudied: currentHoursStudied,
    elapsedMs: 0,
  });
  startTick();
}

export function stopStudySession(): number {
  if (!state.activeGoalId || !state.startedAtMs) return 0;

  const elapsedMs = Math.max(0, Date.now() - state.startedAtMs);
  const elapsedHours = elapsedMs / 3_600_000;
  const finalHoursStudied = state.baseHoursStudied + elapsedHours;

  stopTick();
  updateGameStats({ hoursStudied: finalHoursStudied });
  setState({
    activeGoalId: null,
    startedAtMs: null,
    baseHoursStudied: finalHoursStudied,
    elapsedMs: 0,
  });
  return elapsedHours;
}

export function isStudyingGoal(goalId: string): boolean {
  return !!goalId && state.activeGoalId === goalId && state.startedAtMs != null;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StudySessionState {
  return state;
}

export function useStudySession() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
