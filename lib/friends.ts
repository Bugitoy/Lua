import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { getAccount, subscribeAccount } from "@/lib/account";
import { parseLook, type AvatarLook } from "@/lib/avatarLook";
import { supabase } from "@/lib/supabase";

/**
 * The signed-in user's friends and friend requests, kept fresh while Lua is
 * open: loaded on sign-in, reloaded when the app comes back to the front, and
 * reloaded whenever a friendship row they're part of changes (Supabase
 * Realtime), so a new request shows up without pulling to refresh.
 */

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  look: AvatarLook;
  xp: number;
  streak: number;
};

/** friend: both agreed. incoming: they asked you. outgoing: you asked them. */
export type Relation = "friend" | "incoming" | "outgoing";

export type Connection = PublicProfile & { relation: Relation; since: string };

export type FriendsState = {
  status: "idle" | "loading" | "ready" | "error";
  connections: Connection[];
};

export type FriendsError = "notSignedIn" | "network" | "unknown";
export type SendResult = "requested" | "accepted" | "already_requested" | "already_friends";

const EMPTY: FriendsState = { status: "idle", connections: [] };

let state: FriendsState = EMPTY;
let started = false;
let userId: string | null = null;
let channel: RealtimeChannel | null = null;
/** Bumped on every sign-in change, so a slow load for the old account is thrown away. */
let generation = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

function set(next: Partial<FriendsState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  startFriends();
  return () => {
    listeners.delete(listener);
  };
}

function toProfile(row: Record<string, unknown>): PublicProfile {
  const username = String(row.username ?? "");
  return {
    id: String(row.id),
    username,
    displayName: String(row.display_name || username),
    look: parseLook(row.look),
    xp: typeof row.xp === "number" ? row.xp : 0,
    streak: typeof row.streak === "number" ? row.streak : 0,
  };
}

function isNetwork(message: string | undefined): boolean {
  return !!message && /network request failed|failed to fetch|fetch failed/i.test(message);
}

function errorOf(error: { message?: string } | null): FriendsError {
  return isNetwork(error?.message) ? "network" : "unknown";
}

/** Reloads the friends list and requests. */
export async function refreshFriends(): Promise<void> {
  if (!supabase || !userId) return;
  const mine = generation;
  if (state.status !== "ready") set({ status: "loading" });
  const { data, error } = await supabase.rpc("list_friends");
  if (mine !== generation) return;
  if (error || !Array.isArray(data)) {
    // Keep showing the last list if there was one; just say it couldn't refresh.
    set({ status: state.connections.length > 0 ? "ready" : "error" });
    return;
  }
  set({
    status: "ready",
    connections: (data as Record<string, unknown>[]).map((row) => ({
      ...toProfile(row),
      relation: row.relation as Relation,
      since: String(row.since ?? ""),
    })),
  });
}

function follow(nextUser: string | null) {
  if (nextUser === userId) return;
  generation++;
  userId = nextUser;
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  set(EMPTY);
  if (!supabase || !nextUser) return;

  void refreshFriends();
  // Row level security limits these events to friendships the user is part of.
  channel = supabase
    .channel(`friendships:${nextUser}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
      void refreshFriends();
    })
    .subscribe();
}

/** Starts following the signed-in account. Safe to call repeatedly. */
export function startFriends(): void {
  if (started) return;
  started = true;
  const sync = () => {
    const account = getAccount();
    follow(account.status === "signedIn" ? account.userId : null);
  };
  subscribeAccount(sync);
  sync();
  // Realtime can miss events while Lua is in the background.
  AppState.addEventListener("change", (s) => {
    if (s === "active") void refreshFriends();
  });
}

export function useFriends(): FriendsState {
  return useSyncExternalStore(subscribe, () => state);
}

/** How many people are waiting for an answer, for the badge on Profile. */
export function useIncomingCount(): number {
  return useSyncExternalStore(subscribe, () => state.connections.filter((c) => c.relation === "incoming").length);
}

/** Friend codes look like LUA-7KX2QD; also accepts them typed without the prefix or dash. */
export function looksLikeFriendCode(text: string): boolean {
  return /^(LUA-?)?[A-HJ-NP-Z2-9]{6}$/i.test(text.trim().replace(/\s+/g, ""));
}

/** Pulls a friend code out of anything scanned or pasted, such as a lua://friend/… link. */
export function friendCodeIn(text: string): string | null {
  const match = text.toUpperCase().match(/LUA-?([A-HJ-NP-Z2-9]{6})\b/);
  return match ? `LUA-${match[1]}` : null;
}

/** The person behind a friend code, or null if there's no such code. */
export async function findByFriendCode(
  code: string,
): Promise<{ ok: true; person: PublicProfile | null } | { ok: false; error: FriendsError }> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const { data, error } = await supabase.rpc("find_by_friend_code", { code });
  if (error) return { ok: false, error: errorOf(error) };
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  return { ok: true, person: row ? toProfile(row) : null };
}

/** Usernames starting with `query`, plus whoever owns it if it's a friend code. Never the user. */
export async function searchPeople(
  query: string,
): Promise<{ ok: true; people: PublicProfile[] } | { ok: false; error: FriendsError }> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const text = query.trim().replace(/^@/, "");
  if (text.length < 2) return { ok: true, people: [] };

  const byCode = looksLikeFriendCode(text) ? findByFriendCode(text) : null;
  // _ is a wildcard in LIKE patterns, and usernames can contain it.
  const pattern = `${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const byName = /^[A-Za-z0-9_]+$/.test(text)
    ? supabase
        .from("profiles")
        .select("id, username, display_name, look, xp, streak")
        .ilike("username", pattern)
        .neq("id", userId)
        .order("username")
        .limit(20)
    : null;

  const [codeResult, nameResult] = await Promise.all([byCode, byName]);
  if (codeResult && !codeResult.ok) return codeResult;
  if (nameResult?.error) return { ok: false, error: errorOf(nameResult.error) };

  const people: PublicProfile[] = [];
  if (codeResult?.ok && codeResult.person && codeResult.person.id !== userId) people.push(codeResult.person);
  for (const row of (nameResult?.data ?? []) as Record<string, unknown>[]) {
    const person = toProfile(row);
    if (!people.some((p) => p.id === person.id)) people.push(person);
  }
  return { ok: true, people };
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: FriendsError }> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: errorOf(error) };
  void refreshFriends();
  return { ok: true, data: data as T };
}

/** Asks someone to be friends; accepts instead if they'd already asked. */
export function sendFriendRequest(personId: string) {
  return call<SendResult>("send_friend_request", { target: personId });
}

export function respondToRequest(personId: string, accept: boolean) {
  return call<boolean>("respond_friend_request", { requester_id: personId, accept });
}

/** Unfriends someone, or cancels a request the user sent them. */
export function removeFriend(personId: string) {
  return call<boolean>("remove_friend", { other: personId });
}
