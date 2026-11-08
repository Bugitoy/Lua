import { useEffect, useMemo, useState } from "react";

import { haversineMeters, type LatLngPoint } from "@/lib/geo";

/**
 * Real walking routes (distance, time and the path along streets) from the
 * `walking-route` Supabase function, which asks the Google Routes API.
 *
 * Google charges per request, so a route is fetched once per target and
 * reused: as the user walks, what's left is measured along the saved path.
 * It's fetched again only when the user strays well off it. Without a
 * route (offline, or the request failed) callers fall back to the
 * straight-line estimate.
 */

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/walking-route`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Further than this from the path counts as off the route, so it's fetched again. */
const OFF_ROUTE_METERS = 60;
/** At most one refetch per target in this long, however the user wanders. */
const MIN_REFETCH_MS = 30_000;
/** After a failed request, wait this long before trying that target again. */
const FAILURE_COOLDOWN_MS = 60_000;
/** Saved routes are refreshed after this, so closures and new paths get picked up. */
const ROUTE_MAX_AGE_MS = 15 * 60_000;
/** Targets closer than this need no route; the straight line is the walk. */
const MIN_ROUTE_METERS = 40;

export type WalkingRoute = {
  path: LatLngPoint[];
  distanceMeters: number;
  durationSeconds: number;
  fetchedAtMs: number;
};

/** How much of a route is left from where the user is now. */
export type RouteProgress = {
  remainingMeters: number;
  remainingSeconds: number;
  /** From the user's position to the target, along the route. */
  remainingPath: LatLngPoint[];
  /** How far the user is from the route itself. */
  offRouteMeters: number;
};

type CacheEntry = { route: WalkingRoute | null; failedAtMs: number | null; inFlight: Promise<void> | null };

/** One entry per target, shared by every screen showing a route to it. */
const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function targetKey(p: LatLngPoint): string {
  return `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
}

async function requestRoute(origin: LatLngPoint, destination: LatLngPoint): Promise<WalkingRoute | null> {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !ANON_KEY) return null;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      origin: { latitude: origin.latitude, longitude: origin.longitude },
      destination: { latitude: destination.latitude, longitude: destination.longitude },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<WalkingRoute>;
  if (!Array.isArray(data.path) || data.path.length < 2 || typeof data.distanceMeters !== "number") return null;
  return {
    path: data.path,
    distanceMeters: data.distanceMeters,
    durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : 0,
    fetchedAtMs: Date.now(),
  };
}

function fetchInto(key: string, origin: LatLngPoint, destination: LatLngPoint): void {
  const entry = cache.get(key) ?? { route: null, failedAtMs: null, inFlight: null };
  if (entry.inFlight) return;
  entry.inFlight = requestRoute(origin, destination)
    .catch(() => null)
    .then((route) => {
      entry.inFlight = null;
      if (route) {
        entry.route = route;
        entry.failedAtMs = null;
      } else {
        entry.failedAtMs = Date.now();
      }
      listeners.forEach((l) => l());
    });
  cache.set(key, entry);
}

// ─── Measuring along the path ─────────────────────────────────────────────────

/** Metres east/north of `origin`, accurate enough over a walk. */
function toLocal(origin: LatLngPoint, p: LatLngPoint): { x: number; y: number } {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  return {
    x: (p.longitude - origin.longitude) * toRad * R * Math.cos(origin.latitude * toRad),
    y: (p.latitude - origin.latitude) * toRad * R,
  };
}

/** Where the user is along the route, and how much is left from there. */
export function routeProgress(route: WalkingRoute, at: LatLngPoint): RouteProgress {
  const { path } = route;
  let best = { segment: 0, t: 0, distance: Infinity };
  for (let i = 0; i < path.length - 1; i++) {
    const a = toLocal(at, path[i]);
    const b = toLocal(at, path[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    // The user is at (0, 0); find the closest point of segment a→b to it.
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSq)) : 0;
    const distance = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (distance < best.distance) best = { segment: i, t, distance };
  }

  const from = path[best.segment];
  const to = path[best.segment + 1];
  const onRoute: LatLngPoint = {
    latitude: from.latitude + (to.latitude - from.latitude) * best.t,
    longitude: from.longitude + (to.longitude - from.longitude) * best.t,
  };
  let along = haversineMeters(onRoute, to);
  for (let i = best.segment + 1; i < path.length - 1; i++) along += haversineMeters(path[i], path[i + 1]);
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += haversineMeters(path[i], path[i + 1]);

  // Google's own distance and time, scaled to the share of the path still ahead.
  const share = total > 0 ? Math.min(1, along / total) : 0;
  return {
    remainingMeters: route.distanceMeters * share + best.distance,
    remainingSeconds: route.durationSeconds * share,
    remainingPath: [at, onRoute, ...path.slice(best.segment + 1)],
    offRouteMeters: best.distance,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * - `ready`: the route is in; `progress` is measured from where the user is now.
 * - `loading`: asking for it. Show no line and no distance yet, so the guess
 *   doesn't flash up and then jump to the real route.
 * - `failed`: no route (offline, or the request failed); fall back to the straight-line estimate.
 * - `near`: the target is too close to need a route; the straight line is the walk.
 * - `idle`: no target or no position.
 */
export type RouteStatus = "idle" | "near" | "loading" | "ready" | "failed";

/** The walking route from `location` to `target`, and whether it's in yet. */
export function useWalkingRoute(
  location: LatLngPoint | null,
  target: LatLngPoint | null,
): { progress: RouteProgress | null; status: RouteStatus } {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const key = target ? targetKey(target) : null;
  const entry = key ? cache.get(key) : undefined;
  // An old route keeps showing while its replacement loads, so the line never blinks out.
  const route = entry?.route ?? null;
  const stale = route != null && Date.now() - route.fetchedAtMs >= ROUTE_MAX_AGE_MS;

  const progress = useMemo(
    () => (route && location ? routeProgress(route, location) : null),
    [route, location],
  );

  const close = location && target ? haversineMeters(location, target) < MIN_ROUTE_METERS : false;
  const offRoute = progress != null && progress.offRouteMeters > OFF_ROUTE_METERS;
  /** Bumped when a wait (failure cooldown, refetch gap) is over, to check again. */
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!key || !location || !target || close) return;
    const now = Date.now();
    const current = cache.get(key);
    if (current?.inFlight) return;
    if (route && !offRoute && !stale) return;
    const waitUntil = Math.max(
      current?.failedAtMs != null ? current.failedAtMs + FAILURE_COOLDOWN_MS : 0,
      route ? route.fetchedAtMs + MIN_REFETCH_MS : 0,
    );
    if (now < waitUntil) {
      const timer = setTimeout(() => setRetryTick((n) => n + 1), waitUntil - now);
      return () => clearTimeout(timer);
    }
    fetchInto(key, location, target);
    // `location` changes every fix; only whether a fetch is needed matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, route, offRoute, stale, close, location != null, retryTick, entry?.failedAtMs]);

  const status: RouteStatus =
    !location || !target
      ? "idle"
      : close
        ? "near"
        : progress
          ? "ready"
          : // A retry after a failure keeps showing the fallback rather than going blank.
            entry?.failedAtMs != null
            ? "failed"
            : "loading";
  return { progress: status === "ready" ? progress : null, status };
}
