import { useMemo, useRef } from "react";

import { useCompass } from "./useCompass";
import { useLocation, type LocationCoords } from "./useLocation";

const MOVING_HEADING_SPEED_MPS = 0.6;

export type FusedLocationOptions = {
  /** Switches the GPS provider to BestForNavigation cadence (e.g. while routing). */
  highFidelity?: boolean;
};

export type FusedLocation = LocationCoords & {
  /** Compass reading after circular smoothing; may be null until first sample. */
  compassHeading: number | null;
};

type UseFusedLocationResult = {
  location: FusedLocation | null;
  errorMsg: string | null;
};

/**
 * Combines smoothed GPS with the device compass.
 * - Moving: prefers heading derived from the filtered velocity.
 * - Stationary / slow: falls back to compass, then last known heading.
 */
export function useFusedLocation(
  options: FusedLocationOptions = {},
): UseFusedLocationResult {
  const { location, errorMsg } = useLocation({
    highFidelity: options.highFidelity,
  });
  const compass = useCompass();
  const lastHeadingRef = useRef<number | null>(null);

  const fused = useMemo<FusedLocation | null>(() => {
    if (!location) return null;

    const speed = location.speed ?? 0;
    let heading: number | null = null;

    if (
      speed >= MOVING_HEADING_SPEED_MPS &&
      location.movementHeading != null
    ) {
      heading = location.movementHeading;
    } else if (compass.heading != null) {
      heading = compass.heading;
    } else if (location.heading != null) {
      heading = location.heading;
    } else {
      heading = lastHeadingRef.current;
    }

    if (heading != null) {
      lastHeadingRef.current = heading;
    }

    return {
      ...location,
      heading,
      compassHeading: compass.heading,
    };
  }, [location, compass.heading]);

  return { location: fused, errorMsg };
}
