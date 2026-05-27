import {
  bearingDegrees,
  haversineMeters,
  metersPerDegLng,
  type LatLngPoint,
} from "@/lib/geo";
import i18n from "@/lib/i18n";

/** Typical walking pace (~5 km/h) for ETA estimates. */
export const WALKING_PACE_MPS = 1.1;

/**
 * Safety margin applied to the walking ETA to better match real-world routes
 * (paths aren’t straight lines; stops/terrain add time).
 */
export const ETA_SAFETY_MULTIPLIER = 1.30;

/** How far ahead (in seconds) the sprite tween target leads the latest GPS fix. */
export const MARKER_PROJECT_SECONDS = 1.0;
/** Safety clamp on extrapolation distance. */
export const MARKER_MAX_PROJECT_METERS = 8;
/** Below this speed, the sprite stays on the raw fix (no projection). */
export const MARKER_PROJECT_MIN_SPEED_MPS = 0.2;

const M_PER_DEG_LAT = 111_000;

export type MarkerVelocity = {
  latitude: number;
  longitude: number;
  vxMps?: number | null;
  vyMps?: number | null;
};

/** Map coordinate the user sprite is tweening toward (matches GeoMapView projection). */
export function spriteMapCoordinate(location: MarkerVelocity): LatLngPoint {
  const vx = location.vxMps ?? 0;
  const vy = location.vyMps ?? 0;
  const speed = Math.hypot(vx, vy);

  let latitude = location.latitude;
  let longitude = location.longitude;

  if (speed >= MARKER_PROJECT_MIN_SPEED_MPS) {
    const projMeters = Math.min(
      speed * MARKER_PROJECT_SECONDS,
      MARKER_MAX_PROJECT_METERS,
    );
    const scale = projMeters / speed;
    latitude += (vy * scale) / M_PER_DEG_LAT;
    const mPerDegLng = metersPerDegLng(location.latitude);
    if (mPerDegLng > 0) {
      longitude += (vx * scale) / mPerDegLng;
    }
  }

  return { latitude, longitude };
}

/** Great-circle distance from the sprite to a point, in metres. */
export function distanceFromSpriteMeters(
  location: MarkerVelocity,
  target: LatLngPoint,
): number {
  return haversineMeters(spriteMapCoordinate(location), target);
}

/** Walking-time ETA in minutes from sprite position to target. */
export function walkingEtaMinutes(
  location: MarkerVelocity,
  target: LatLngPoint,
): number {
  const meters = distanceFromSpriteMeters(location, target);
  return (meters / WALKING_PACE_MPS / 60) * ETA_SAFETY_MULTIPLIER;
}

export function bearingFromSpriteDegrees(
  location: MarkerVelocity,
  target: LatLngPoint,
): number {
  return bearingDegrees(spriteMapCoordinate(location), target);
}

/** Human-readable walking ETA (always rounds up to avoid understating time). */
export function formatWalkingEta(etaMinutes: number): string {
  const totalSeconds = Math.max(0, Math.ceil(etaMinutes * 60));
  if (totalSeconds < 60) {
    return totalSeconds <= 1
      ? i18n.t("map.eta.lessThanOneMin")
      : i18n.t("map.eta.seconds", { count: totalSeconds });
  }
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return i18n.t("map.eta.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0
    ? i18n.t("map.eta.hoursMinutes", { hours, minutes: rem })
    : i18n.t("map.eta.hours", { hours });
}
