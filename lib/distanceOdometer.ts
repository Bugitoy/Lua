import { haversineMeters, type LatLngPoint } from "@/lib/geo";

/** Minimum segment length before considering accumulation (metres). */
export const ODOMETER_MIN_DELTA_METERS = 3;
/** Smoothed-speed floor — light walking after stationary unlock. */
export const ODOMETER_MIN_SPEED_MPS = 0.52;
/** Reject segments that don't look like walking (teleports + creep). */
export const ODOMETER_IMPLIED_SPEED_MIN_MPS = 0.45;
export const ODOMETER_IMPLIED_SPEED_MAX_MPS = 3.1;
/** Stricter than map display — don't count distance on poor fixes. */
export const ODOMETER_MAX_ACCURACY_METERS = 25;
/** Consecutive fixes at or below this accuracy before the odometer starts. */
export const ODOMETER_WARMUP_ACCURACY_METERS = 20;
export const ODOMETER_WARMUP_GOOD_FIXES = 4;
/** Segment must exceed accuracy × this factor (noise floor). */
export const ODOMETER_MIN_DELTA_ACCURACY_FACTOR = 0.5;

export type OdometerFix = LatLngPoint & {
  accuracy: number | null;
  speed: number | null;
  isStationary: boolean;
};

export type OdometerSample = LatLngPoint & {
  accuracy: number | null;
};

export type OdometerState = {
  lastSample: OdometerSample | null;
  lastAtMs: number | null;
  totalMeters: number;
  goodAccuracyStreak: number;
  wasStationary: boolean;
};

export function createOdometerState(initialMeters = 0): OdometerState {
  return {
    lastSample: null,
    lastAtMs: null,
    totalMeters: initialMeters,
    goodAccuracyStreak: 0,
    wasStationary: true,
  };
}

function effectiveAccuracyMeters(accuracy: number | null): number {
  return accuracy ?? ODOMETER_MAX_ACCURACY_METERS;
}

function minSegmentMeters(
  currentAccuracy: number | null,
  prevAccuracy: number | null,
): number {
  const acc = Math.max(
    effectiveAccuracyMeters(currentAccuracy),
    effectiveAccuracyMeters(prevAccuracy),
  );
  return Math.max(
    ODOMETER_MIN_DELTA_METERS,
    acc * ODOMETER_MIN_DELTA_ACCURACY_FACTOR,
  );
}

function isAccuracyGoodForWarmup(accuracy: number | null): boolean {
  return accuracy != null && accuracy <= ODOMETER_WARMUP_ACCURACY_METERS;
}

function isAccuracyGoodForOdometer(accuracy: number | null): boolean {
  return accuracy != null && accuracy <= ODOMETER_MAX_ACCURACY_METERS;
}

export type OdometerTickResult = {
  state: OdometerState;
  /** Updated miles total when a segment was accepted; otherwise null. */
  miles: number | null;
};

/**
 * Process one GPS fix for walked-distance accumulation.
 * Pure — pass `state` in and use the returned `state` for the next tick.
 */
export function tickOdometer(
  state: OdometerState,
  fix: OdometerFix,
  nowMs: number,
): OdometerTickResult {
  const next: OdometerState = {
    ...state,
    goodAccuracyStreak: isAccuracyGoodForWarmup(fix.accuracy)
      ? state.goodAccuracyStreak + 1
      : 0,
  };

  if (fix.isStationary) {
    return {
      state: { ...next, wasStationary: true },
      miles: null,
    };
  }

  const odometerReady =
    next.goodAccuracyStreak >= ODOMETER_WARMUP_GOOD_FIXES;

  // First moving fix after stationary — anchor only, no distance.
  if (next.wasStationary) {
    return {
      state: {
        ...next,
        wasStationary: false,
        lastSample: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
        },
        lastAtMs: nowMs,
      },
      miles: null,
    };
  }

  if (!odometerReady) {
    return { state: next, miles: null };
  }

  if (!isAccuracyGoodForOdometer(fix.accuracy)) {
    return { state: next, miles: null };
  }

  if ((fix.speed ?? 0) < ODOMETER_MIN_SPEED_MPS) {
    return { state: next, miles: null };
  }

  const prev = next.lastSample;
  if (!prev) {
    return {
      state: {
        ...next,
        lastSample: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
        },
        lastAtMs: nowMs,
      },
      miles: null,
    };
  }

  const delta = haversineMeters(prev, fix);
  const minDelta = minSegmentMeters(fix.accuracy, prev.accuracy);

  if (delta < minDelta) {
    return { state: next, miles: null };
  }

  const prevAt = next.lastAtMs;
  if (prevAt == null) {
    return {
      state: {
        ...next,
        lastSample: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
        },
        lastAtMs: nowMs,
      },
      miles: null,
    };
  }

  const dtSec = Math.max(0.2, (nowMs - prevAt) / 1000);
  const impliedMps = delta / dtSec;
  if (
    impliedMps < ODOMETER_IMPLIED_SPEED_MIN_MPS ||
    impliedMps > ODOMETER_IMPLIED_SPEED_MAX_MPS
  ) {
    return {
      state: {
        ...next,
        lastSample: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
        },
        lastAtMs: nowMs,
      },
      miles: null,
    };
  }

  const totalMeters = next.totalMeters + delta;
  const miles = Math.round(totalMeters * 0.000621371 * 100) / 100;

  return {
    state: {
      ...next,
      totalMeters,
      lastSample: {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
      },
      lastAtMs: nowMs,
    },
    miles,
  };
}
