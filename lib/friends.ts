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

/**
 * unavailable: blocked either way, or their "who can send requests" setting
 * doesn't allow it (the two look the same, so a block isn't revealed).
 * limit: the daily request limit is used up. notFound: no one has that code.
 */
export type FriendsError = "notSignedIn" | "network" | "unknown" | "unavailable" | "limit" | "notFound";
/** incoming: they'd already asked the user, so nothing was sent; accept theirs instead. */
export type SendResult = "requested" | "incoming" | "already_requested" | "already_friends";

/** Who can send the user requests from username search. A link, QR or code always works. */
export type RequestsFrom = "everyone" | "friends_of_friends" | "code_only";
export const REQUESTS_FROM: RequestsFrom[] = ["everyone", "friends_of_friends", "code_only"];

export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";

/** A search result; `viaCode` is set when it was found by friend code, so Add can ask by code. */
export type FoundProfile = PublicProfile & { viaCode?: string };

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

/** The translation key that explains a failed friend action. */
export function friendErrorKey(error: FriendsError): string {
  switch (error) {
    case "network":
      return "account.errors.network";
    case "unavailable":
      return "friends.errors.unavailable";
    case "limit":
      return "friends.errors.limit";
    case "notFound":
      return "friends.errors.notFound";
    default:
      return "account.errors.unknown";
  }
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

/**
 * Usernames starting with `query` that the user may ask (the server leaves
 * out blocked people and anyone whose setting doesn't allow it), plus whoever
 * owns the text if it's a friend code. Never the user.
 */
export async function searchPeople(
  query: string,
): Promise<{ ok: true; people: FoundProfile[] } | { ok: false; error: FriendsError }> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const text = query.trim().replace(/^@/, "");
  if (text.length < 2) return { ok: true, people: [] };

  const byCode = looksLikeFriendCode(text) ? findByFriendCode(text) : null;
  const byName = /^[A-Za-z0-9_]+$/.test(text) ? supabase.rpc("search_profiles", { term: text }) : null;

  const [codeResult, nameResult] = await Promise.all([byCode, byName]);
  if (codeResult && !codeResult.ok) return codeResult;
  if (nameResult?.error) return { ok: false, error: errorOf(nameResult.error) };

  const people: FoundProfile[] = [];
  if (codeResult?.ok && codeResult.person && codeResult.person.id !== userId) {
    people.push({ ...codeResult.person, viaCode: text });
  }
  for (const row of (Array.isArray(nameResult?.data) ? nameResult.data : []) as Record<string, unknown>[]) {
    const person = toProfile(row);
    if (!people.some((p) => p.id === person.id)) people.push(person);
  }
  return { ok: true, people };
}

type Result<T> = { ok: true; data: T } | { ok: false; error: FriendsError };

async function call<T>(fn: string, args: Record<string, unknown> = {}, refresh = true): Promise<Result<T>> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: errorOf(error) };
  if (refresh) void refreshFriends();
  return { ok: true, data: data as T };
}

/** Turns the server's refusals into errors the screens can explain. */
async function request(fn: string, args: Record<string, unknown>): Promise<Result<SendResult>> {
  const result = await call<SendResult | "unavailable" | "limit" | "not_found">(fn, args);
  if (!result.ok) return result;
  if (result.data === "unavailable") return { ok: false, error: "unavailable" };
  if (result.data === "limit") return { ok: false, error: "limit" };
  if (result.data === "not_found") return { ok: false, error: "notFound" };
  return { ok: true, data: result.data };
}

/** Asks someone found by username search. Never makes a friendship by itself; they have to accept. */
export function sendFriendRequest(personId: string) {
  return request("send_friend_request", { target: personId });
}

/** Asks whoever owns a friend code (from a link, QR or typed code); their search setting doesn't apply. */
export function sendFriendRequestByCode(code: string) {
  return request("send_friend_request_by_code", { code });
}

export function respondToRequest(personId: string, accept: boolean) {
  return call<boolean>("respond_friend_request", { requester_id: personId, accept });
}

/** Unfriends someone, or cancels a request the user sent them. */
export function removeFriend(personId: string) {
  return call<boolean>("remove_friend", { other: personId });
}

/** Blocks someone: ends any friendship or request, and neither can find or ask the other. */
export function blockUser(personId: string) {
  return call<boolean>("block_user", { target: personId });
}

export function unblockUser(personId: string) {
  return call<boolean>("unblock_user", { target: personId }, false);
}

/** Saves a report for review. `false` means the daily report limit is used up. */
export function reportUser(personId: string, reason: ReportReason) {
  return call<boolean>("report_user", { target: personId, reason }, false);
}

export async function listBlocked(): Promise<Result<PublicProfile[]>> {
  const result = await call<Record<string, unknown>[]>("list_blocked", {}, false);
  if (!result.ok) return result;
  return { ok: true, data: (Array.isArray(result.data) ? result.data : []).map(toProfile) };
}

export async function getRequestsFrom(): Promise<Result<RequestsFrom>> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const { data, error } = await supabase
    .from("friend_settings")
    .select("requests_from")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: errorOf(error) };
  const value = data?.requests_from as RequestsFrom | undefined;
  return { ok: true, data: value && REQUESTS_FROM.includes(value) ? value : "everyone" };
}

export async function setRequestsFrom(value: RequestsFrom): Promise<Result<RequestsFrom>> {
  if (!supabase || !userId) return { ok: false, error: "notSignedIn" };
  const { error } = await supabase
    .from("friend_settings")
    .upsert({ user_id: userId, requests_from: value }, { onConflict: "user_id" });
  if (error) return { ok: false, error: errorOf(error) };
  return { ok: true, data: value };
}
