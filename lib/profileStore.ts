import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export const PROFILE_STORAGE_KEY = "userProfile";

export type UserProfile = {
  displayName: string;
  handle: string;
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: "Mason",
  handle: "@masonmavinga",
};

let state: UserProfile = { ...DEFAULT_PROFILE };
let hydrated = false;
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void ensureProfileLoaded();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): UserProfile {
  return state;
}

function notify() {
  listeners.forEach((l) => l());
}

export function normalizeHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const cleaned = withoutAt.replace(/\s+/g, "");
  if (!cleaned) return "";
  return `@${cleaned}`;
}

export function isValidHandle(handle: string): boolean {
  return /^@[a-zA-Z0-9_]{2,30}$/.test(handle);
}

export async function loadProfile(): Promise<void> {
  if (hydrated) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserProfile>;
        state = {
          displayName:
            typeof parsed.displayName === "string" && parsed.displayName.trim()
              ? parsed.displayName.trim()
              : DEFAULT_PROFILE.displayName,
          handle:
            typeof parsed.handle === "string"
              ? normalizeHandle(parsed.handle) || DEFAULT_PROFILE.handle
              : DEFAULT_PROFILE.handle,
        };
      }
    } catch {
      state = { ...DEFAULT_PROFILE };
    } finally {
      hydrated = true;
      notify();
    }
  })();

  return loadPromise;
}

function ensureProfileLoaded() {
  if (!hydrated && !loadPromise) {
    void loadProfile();
  }
}

export async function updateProfile(
  partial: Partial<UserProfile>,
): Promise<void> {
  const next: UserProfile = {
    displayName:
      partial.displayName !== undefined
        ? partial.displayName.trim()
        : state.displayName,
    handle:
      partial.handle !== undefined
        ? normalizeHandle(partial.handle) || state.handle
        : state.handle,
  };

  state = next;
  hydrated = true;
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state));
  notify();
}

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, getSnapshot);
  return {
    profile,
    updateProfile,
    isReady: hydrated,
  };
}
