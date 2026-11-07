import {
  createOdometerState,
  tickOdometer,
  type OdometerFix,
  type OdometerState,
} from "@/lib/distanceOdometer";
import { updateGameStats } from "@/lib/gameStats";
import { addGpsMeters } from "@/lib/stepCounter";

const MILES_PER_METER = 0.000621371;

/**
 * Single odometer shared by the map screen and background tracking, so
 * distance walked with the screen off adds to the same running total.
 *
 * `distanceMiles` in game stats = miles saved from earlier launches + this launch's walking.
 */
let state: OdometerState | null = null;
/** Miles walked before this launch, restored by `dailyProgress`. */
let savedMiles = 0;

function publish(): void {
  const meters = state?.totalMeters ?? 0;
  updateGameStats({
    distanceMiles: Math.round((savedMiles + meters * MILES_PER_METER) * 100) / 100,
  });
}

/** Restores the lifetime distance from storage. Order-independent with GPS fixes. */
export function restoreDistanceMiles(miles: number): void {
  savedMiles = miles;
  publish();
}

export function recordOdometerFix(fix: OdometerFix, nowMs: number): void {
  if (state == null) state = createOdometerState(0);

  const metersBefore = state.totalMeters;
  const result = tickOdometer(state, fix, nowMs);
  state = result.state;

  if (result.miles != null) {
    addGpsMeters(state.totalMeters - metersBefore);
    publish();
  }
}
