import { useMemo, useState } from "react";

import type { LatLngPoint } from "@/lib/geo";
import {
  bearingFromSpriteDegrees,
  distanceFromSpriteMeters,
  formatWalkingEta,
  walkingEtaMinutes,
} from "@/lib/mapMarker";

import type { LocationCoords } from "@/hooks/useLocation";

const ARRIVAL_RADIUS_METERS = 20;

export { formatWalkingEta };

export type { LatLngPoint };

type DestinationTrackingState = {
  destination: LatLngPoint | null;
  distanceMeters: number | null;
  bearingDeg: number | null;
  etaMinutes: number | null;
  hasArrived: boolean;
  setDestination: (point: LatLngPoint) => void;
  clearDestination: () => void;
};

export function useDestinationTracking(
  location: LocationCoords | null,
): DestinationTrackingState {
  const [destination, setDestination] = useState<LatLngPoint | null>(null);

  const metrics = useMemo(() => {
    if (!location || !destination) {
      return {
        distanceMeters: null,
        bearingDeg: null,
        etaMinutes: null,
        hasArrived: false,
      };
    }

    const distanceMeters = distanceFromSpriteMeters(location, destination);
    const bearingDeg = bearingFromSpriteDegrees(location, destination);
    const etaMinutes = walkingEtaMinutes(location, destination);

    return {
      distanceMeters,
      bearingDeg,
      etaMinutes,
      hasArrived: distanceMeters <= ARRIVAL_RADIUS_METERS,
    };
  }, [destination, location]);

  return {
    destination,
    distanceMeters: metrics.distanceMeters,
    bearingDeg: metrics.bearingDeg,
    etaMinutes: metrics.etaMinutes,
    hasArrived: metrics.hasArrived,
    setDestination,
    clearDestination: () => setDestination(null),
  };
}
