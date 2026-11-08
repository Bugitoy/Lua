import {
  FunctionsFetchError,
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
  type Session,
} from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { updateProfile } from "@/lib/profileStore";
import { supabase } from "@/lib/supabase";

/**
 * The user's Lua account. Signing in is optional: the app works the same
 * without one, and an account is what friends and the real leaderboard use.
 *
 * The server profile (username and display name) wins over the phone's copy
 * whenever the user signs in or opens the app signed in, so a second phone
 * picks up the same name. Stats go the other way, from the phone to the
 * server; see `AccountSync`.
 */

export type AccountStatus = "loading" | "signedOut" | "signedIn";

export type AccountState = {
  status: AccountStatus;
  userId: string | null;
  email: string | null;
  /** Without the @. Null until the profile has loaded. */
  username: string | null;
  friendCode: string | null;
};

export type AccountError =
  | "notConfigured"
  | "network"
  | "invalidCredentials"
  | "emailTaken"
  | "usernameTaken"
  | "invalidUsername"
  | "weakPassword"
  | "invalidEmail"
  | "emailNotConfirmed"
  | "rateLimited"
  | "unknown";

export type AccountResult = { ok: true } | { ok: false; error: AccountError };

const SIGNED_OUT: AccountState = {
  status: "signedOut",
  userId: null,
  email: null,
  username: null,
  friendCode: null,
};

let state: AccountState = { ...SIGNED_OUT, status: supabase ? "loading" : "signedOut" };
let started = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function set(next: Partial<AccountState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  startAccount();
  return () => {
    listeners.delete(listener);
  };
}

export function getAccount(): AccountState {
  return state;
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, getAccount);
}

/** Usernames are stored without the @ the app shows. */
export function usernameFromHandle(handle: string): string {
  return handle.trim().replace(/^@/, "");
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{2,30}$/.test(username);
}

function isNetworkMessage(message: string | undefined): boolean {
  return !!message && /network request failed|failed to fetch|fetch failed/i.test(message);
}

function authError(error: unknown): AccountError {
  if (isAuthRetryableFetchError(error)) return "network";
  if (isAuthWeakPasswordError(error)) return "weakPassword";
  if (isAuthApiError(error)) {
    switch (error.code) {
      case "invalid_credentials":
        return "invalidCredentials";
      case "user_already_exists":
      case "email_exists":
        return "emailTaken";
      case "weak_password":
        return "weakPassword";
      case "email_address_invalid":
      case "validation_failed":
        return "invalidEmail";
      case "email_not_confirmed":
        return "emailNotConfirmed";
      case "over_request_rate_limit":
      case "over_email_send_rate_limit":
        return "rateLimited";
    }
  }
  if (error instanceof Error && isNetworkMessage(error.message)) return "network";
  return "unknown";
}

function dbError(error: { code?: string; message?: string }): AccountError {
  if (error.code === "23505") return "usernameTaken";
  if (error.code === "23514") return "invalidUsername";
  if (isNetworkMessage(error.message)) return "network";
  return "unknown";
}

/** Loads the server profile and friend code, and copies the names onto this phone. */
async function loadServerProfile(userId: string): Promise<void> {
  if (!supabase) return;
  const [profile, code] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
    supabase.from("friend_codes").select("code").eq("user_id", userId).maybeSingle(),
  ]);
  if (state.userId !== userId) return;
  if (profile.data) {
    set({ username: profile.data.username });
    await updateProfile({
      displayName: profile.data.display_name || profile.data.username,
      handle: `@${profile.data.username}`,
    }).catch(() => {});
  }
  if (code.data) set({ friendCode: code.data.code });
}

function applySession(session: Session | null) {
  if (!session) {
    set(SIGNED_OUT);
    return;
  }
  const changedUser = state.userId !== session.user.id;
  set({
    status: "signedIn",
    userId: session.user.id,
    email: session.user.email ?? null,
    ...(changedUser ? { username: null, friendCode: null } : {}),
  });
  if (changedUser) void loadServerProfile(session.user.id).catch(() => {});
}

/** Restores a saved session and follows sign-ins and sign-outs. Safe to call repeatedly. */
export function startAccount(): void {
  if (started || !supabase) return;
  started = true;
  // Also fires INITIAL_SESSION with the saved session, or null when signed out.
  supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase warns against awaiting its own calls inside this callback.
    setTimeout(() => applySession(session), 0);
  });
}

/** Whether nobody has the username yet. Null when it couldn't be checked. */
export async function usernameAvailable(username: string): Promise<boolean | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("username_available", { wanted: username });
  if (error || typeof data !== "boolean") return null;
  return data;
}

export async function signUp(input: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<AccountResult | { ok: true; needsConfirmation: true }> {
  if (!supabase) return { ok: false, error: "notConfigured" };
  if (!isValidUsername(input.username)) return { ok: false, error: "invalidUsername" };

  const available = await usernameAvailable(input.username);
  if (available === false) return { ok: false, error: "usernameTaken" };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { username: input.username, display_name: input.displayName.trim() } },
    });
    if (error) return { ok: false, error: authError(error) };
    // With email confirmation on, Supabase hides whether the email is already
    // registered: the user comes back with no identities and no session.
    if (data.user && data.user.identities?.length === 0) return { ok: false, error: "emailTaken" };
    if (!data.session) return { ok: true, needsConfirmation: true };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: authError(error) };
  }
}

export async function signIn(email: string, password: string): Promise<AccountResult> {
  if (!supabase) return { ok: false, error: "notConfigured" };
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, error: authError(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: authError(error) };
  }
}

/** Signs out on this phone. Everything saved on the phone stays. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  // "local" signs out this phone only, and works offline.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  set(SIGNED_OUT);
}

/** Saves the username and display name to the server. */
export async function updateAccountProfile(input: {
  username: string;
  displayName: string;
}): Promise<AccountResult> {
  if (!supabase || !state.userId) return { ok: false, error: "notConfigured" };
  if (!isValidUsername(input.username)) return { ok: false, error: "invalidUsername" };
  const { error } = await supabase
    .from("profiles")
    .update({ username: input.username, display_name: input.displayName.trim().slice(0, 40) })
    .eq("id", state.userId);
  if (error) return { ok: false, error: dbError(error) };
  set({ username: input.username });
  return { ok: true };
}

/** A new friend code, so the old one stops working. */
export async function resetFriendCode(): Promise<AccountResult> {
  if (!supabase || !state.userId) return { ok: false, error: "notConfigured" };
  const { data, error } = await supabase.rpc("reset_friend_code");
  if (error || typeof data !== "string") return { ok: false, error: error ? dbError(error) : "unknown" };
  set({ friendCode: data });
  return { ok: true };
}

/** Deletes the account and its server data, then signs out. The phone's own data stays. */
export async function deleteAccount(): Promise<AccountResult> {
  if (!supabase || !state.userId) return { ok: false, error: "notConfigured" };
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) return { ok: false, error: error instanceof FunctionsFetchError ? "network" : "unknown" };
  await signOut();
  return { ok: true };
}
