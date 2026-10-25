import { useEffect } from "react";

import type { LocationCoords } from "@/hooks/useLocation";
import { recordOdometerFix } from "@/lib/odometerRecorder";

/**
 * Accumulates walked distance from GPS fixes with accuracy gating,
 * cold-start warmup, and frozen baseline while stationary. Pass the bare GPS
 * fix: re-sending it on compass turns would count toward the warmup streak.
 */
export function useDistanceOdometer(location: LocationCoords | null): void {
  useEffect(() => {
    if (!location) return;
    recordOdometerFix(location, Date.now());
  }, [location]);
}
