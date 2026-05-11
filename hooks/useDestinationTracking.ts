import { useMemo, useState } from "react";

import type { LocationCoords } from "@/hooks/useLocation";

const ARRIVAL_RADIUS_METERS = 20;

export type LatLngPoint = {
  latitude: number;
  longitude: number;
};

type DestinationTrackingState = {
  destination: LatLngPoint | null;
  distanceMeters: number | null;
  bearingDeg: number | null;
  etaMinutes: number | null;
  hasArrived: boolean;
  setDestination: (point: LatLngPoint) => void;
  clearDestination: () => void;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const earthRadius = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearingDegrees(a: LatLngPoint, b: LatLngPoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

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
