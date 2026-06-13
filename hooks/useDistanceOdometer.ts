import { useEffect } from "react";

import type { FusedLocation } from "@/hooks/useFusedLocation";
import { recordOdometerFix } from "@/lib/odometerRecorder";

/**
 * Accumulates walked distance from fused GPS fixes with accuracy gating,
 * cold-start warmup, and frozen baseline while stationary.
 */
export function useDistanceOdometer(location: FusedLocation | null): void {
  useEffect(() => {
    if (!location) return;
    recordOdometerFix(location, Date.now());
  }, [location]);
}
