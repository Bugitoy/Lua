import { useMemo, useState } from "react";

import {
  bearingDegrees,
  haversineMeters,
  type LatLngPoint,
} from "@/lib/geo";

import type { LocationCoords } from "@/hooks/useLocation";

const ARRIVAL_RADIUS_METERS = 20;

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

    const current = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const distanceMeters = haversineMeters(current, destination);
    const bearingDeg = bearingDegrees(current, destination);
    const speedMps = Math.max(0, location.speed ?? 0);
    const etaMinutes =
      speedMps > 0.4 ? Math.max(0, distanceMeters / speedMps / 60) : null;

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
