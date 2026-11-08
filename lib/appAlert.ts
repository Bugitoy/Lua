import type { Ionicons } from "@expo/vector-icons";
import { useSyncExternalStore } from "react";

import type { ChoiceTone } from "@/components/schedule/ChoicePrompt";

/**
 * Lua's own alerts, in place of the system `Alert.alert`: the same card as
 * "Remove goal?", drawn by an `AppAlertHost`. There is one host at the app
 * root, and sheets that are their own native layer (like the new goal sheet)
 * mount another inside; the most recently mounted host draws the alert, so
 * it always sits on top of whatever is open.
 */

export type AppAlertButton = {
  label: string;
  tone: ChoiceTone;
  onPress?: () => void;
};

export type AppAlert = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Tints the icon: green for information and questions, red for errors and destructive ones. */
  tone: "primary" | "danger";
  title: string;
  message: string;
  buttons: AppAlertButton[];
  /** The quiet button under the others; defaults to Cancel, null hides it. */
  cancelLabel?: string | null;
};

type State = {
  /** The alert showing, with a counter so the same alert shown twice still re-renders. */
  current: (AppAlert & { key: number }) | null;
  /** Mounted hosts, oldest first; the last one draws. */
  hosts: readonly number[];
};

let state: State = { current: null, hosts: [] };
let nextKey = 1;
const listeners = new Set<() => void>();

function set(next: Partial<State>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows an alert, replacing any that is already showing. */
export function showAppAlert(alert: AppAlert): void {
  set({ current: { ...alert, key: nextKey++ } });
}

/** A one-button alert, e.g. to explain why something didn't work. */
export function showAppNotice(
  alert: Pick<AppAlert, "icon" | "tone" | "title" | "message">,
  okLabel: string,
): void {
  showAppAlert({ ...alert, buttons: [{ label: okLabel, tone: "primary" }], cancelLabel: null });
}

export function closeAppAlert(): void {
  if (state.current) set({ current: null });
}

export function useAppAlert(): State["current"] {
  return useSyncExternalStore(subscribe, () => state.current);
}

/** Registers a host while mounted. Returns its id. */
export function addAlertHost(): { id: number; remove: () => void } {
  const id = nextKey++;
  set({ hosts: [...state.hosts, id] });
  return { id, remove: () => set({ hosts: state.hosts.filter((h) => h !== id) }) };
}

/** The host that should draw alerts right now. */
export function useTopAlertHost(): number | undefined {
  return useSyncExternalStore(subscribe, () => state.hosts[state.hosts.length - 1]);
}
