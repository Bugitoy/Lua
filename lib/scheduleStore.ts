import { useSyncExternalStore } from "react";

// ─── State ────────────────────────────────────────────────────────────────────

type StoreState = {
  /** Location labels that appear in the current schedule (yellow markers). */
  scheduledLocations: ReadonlySet<string>;
  /** Scheduled locations where the sprite has arrived (green markers). */
  completedLocations: ReadonlySet<string>;
  /** Maps each scheduled location label to its category (e.g. "Academic"). */
  locationCategories: ReadonlyMap<string, string>;
};

let state: StoreState = {
  scheduledLocations: new Set(),
  completedLocations: new Set(),
  locationCategories: new Map(),
};

// ─── Pub/sub ──────────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((l) => l());
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Call from the Schedule screen whenever the items list changes. */
export function setScheduledLocations(
  items: { label: string; category: string }[],
): void {
  state = {
    ...state,
    scheduledLocations: new Set(items.map((i) => i.label)),
    locationCategories: new Map(items.map((i) => [i.label, i.category])),
  };
  notify();
}

/**
 * Call when the sprite arrives at a scheduled stop.
 * Returns `true` if this is a new completion, `false` if the location
 * isn't scheduled or was already marked done — so callers can react
 * (e.g. increment goalsDone in the game stats store).
 */
export function markLocationCompleted(label: string): boolean {
  if (!state.scheduledLocations.has(label)) return false;
  if (state.completedLocations.has(label)) return false;
  state = {
    ...state,
    completedLocations: new Set([...state.completedLocations, label]),
  };
  notify();
  return true;
}

/** Read the category for a location label directly (safe to call inside effects). */
export function getLocationCategory(label: string): string | undefined {
  return state.locationCategories.get(label);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function getSnapshot(): StoreState {
  return state;
}

export function useScheduledLocations(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot).scheduledLocations;
}

export function useCompletedLocations(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot).completedLocations;
}
