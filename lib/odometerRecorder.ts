import {
  createOdometerState,
  tickOdometer,
  type OdometerFix,
  type OdometerState,
} from "@/lib/distanceOdometer";
import { getGameStats, updateGameStats } from "@/lib/gameStats";
import { addGpsMeters } from "@/lib/stepCounter";

const METERS_PER_MILE = 1 / 0.000621371;

/**
 * Single odometer shared by the map screen and background tracking, so
 * distance walked with the screen off adds to the same running total.
 */
let state: OdometerState | null = null;

export function recordOdometerFix(fix: OdometerFix, nowMs: number): void {
  if (state == null) {
    state = createOdometerState(getGameStats().distanceMiles * METERS_PER_MILE);
  }

  const metersBefore = state.totalMeters;
  const result = tickOdometer(state, fix, nowMs);
  state = result.state;

  if (result.miles != null) {
    addGpsMeters(state.totalMeters - metersBefore);
    updateGameStats({ distanceMiles: result.miles });
  }
}
