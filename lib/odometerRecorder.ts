import {
  createOdometerState,
  tickOdometer,
  type OdometerFix,
  type OdometerState,
} from "@/lib/distanceOdometer";
import { getGameStats, updateGameStats } from "@/lib/gameStats";

/**
 * Single odometer shared by the map screen and background tracking, so
 * distance walked with the screen off adds to the same running total.
 */
let state: OdometerState | null = null;

export function recordOdometerFix(fix: OdometerFix, nowMs: number): void {
  if (state == null) {
    state = createOdometerState(getGameStats().distanceMiles / 0.000621371);
  }

  const result = tickOdometer(state, fix, nowMs);
  state = result.state;

  if (result.miles != null) {
    updateGameStats({ distanceMiles: result.miles });
  }
}
