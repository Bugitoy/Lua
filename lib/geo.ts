/**
 * Shared geo helpers used by both destination tracking and goal-arrival detection.
 * Kept dependency-free so it can be imported from hooks, components, and pure logic.
 */

export type LatLngPoint = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Initial compass bearing from `a` to `b`, in degrees clockwise from true north. */
export function bearingDegrees(a: LatLngPoint, b: LatLngPoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Approximate metres-per-degree of longitude at a given latitude. */
export function metersPerDegLng(latitudeDeg: number): number {
  return 111_000 * Math.cos((latitudeDeg * Math.PI) / 180);
}
