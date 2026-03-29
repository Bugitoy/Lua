import { useEffect, useRef, useState } from "react";

import type { SpriteDirection } from "@/components/map/MapCharacter";
import { useLocation } from "./useLocation";

// ─── Tuning constants ─────────────────────────────────────────────────────────

/**
 * Where the sprite appears on first load (normalised 0–1).
 * 0.5 / 0.45 = horizontally centred, slightly above the midpoint.
 */
const ORIGIN_NORM = { x: 0.5, y: 0.45 };

/**
 * How far (in normalised map units) the sprite moves per metre walked.
 * 0.005 means 200 m of real walking = the sprite crosses the full map.
 * Increase for a more dramatic/fast-moving demo, decrease to slow it down.
 */
const NORM_PER_METER = 0.005;

/** Metres per degree of latitude (constant everywhere). */
const M_PER_DEG_LAT = 111_000;

/**
 * GPS deadzone — the sprite only updates its position when the user has
 * moved at least this many metres from the last accepted GPS fix.
 * This absorbs the 3–10 m noise that phones report even when stationary.
 */
const MIN_MOVE_METERS = 5;

/**
 * Minimum speed (m/s) reported by the device for the walk animation to play.
 * Raised to 1.0 m/s (slow walking pace) to ignore GPS noise speed spikes.
 */
const MOVING_SPEED_THRESHOLD = 1.0;

/**
 * Exponential moving-average factor for position smoothing.
 * 0 = frozen, 1 = raw (jittery). 0.2 is gentler than before.
 */
const SMOOTH_ALPHA = 0.2;

/** Keep sprite inside this margin so it never clips off the map edge. */
const NORM_MARGIN = 0.05;

// ─── Types ────────────────────────────────────────────────────────────────────

export type GpsSpriteState = {
  normX: number;
  normY: number;
  direction: SpriteDirection;
  isMoving: boolean;
  /** True once the first GPS fix has been received. */
  hasGps: boolean;
  /** Total distance walked this session, in metres. */
  distanceMeters: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headingToDirection(deg: number): SpriteDirection {
  if (deg >= 315 || deg < 45)  return "up";
  if (deg >= 45  && deg < 135) return "right";
  if (deg >= 135 && deg < 225) return "down";
  return "left";
}

function deltasToDirection(dx: number, dy: number): SpriteDirection {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function clampNorm(v: number): number {
  return Math.max(NORM_MARGIN, Math.min(1 - NORM_MARGIN, v));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGpsSprite(): GpsSpriteState {
  const { location } = useLocation();

  /**
   * The GPS fix captured on the very first update — used as the
   * reference point so the sprite always starts at ORIGIN_NORM.
   */
  const originGpsRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * The last GPS fix that actually passed the deadzone threshold.
   * New fixes are ignored until they are at least MIN_MOVE_METERS away
   * from this point, absorbing stationary GPS noise.
   */
  const lastAcceptedGpsRef = useRef<{ lat: number; lng: number } | null>(null);

  /** Smoothed normalised position (mutated in place to avoid extra re-renders). */
  const smoothRef = useRef({ ...ORIGIN_NORM });

  /** Running total of distance walked this session, in metres. */
  const totalDistanceRef = useRef(0);

  const [state, setState] = useState<GpsSpriteState>({
    normX: ORIGIN_NORM.x,
    normY: ORIGIN_NORM.y,
    direction: "down",
    isMoving: false,
    hasGps: false,
    distanceMeters: 0,
  });

  useEffect(() => {
    if (!location) return;

    // ── First fix: anchor origin and emit hasGps=true, then wait for movement ─
    if (!originGpsRef.current) {
      originGpsRef.current    = { lat: location.latitude, lng: location.longitude };
      lastAcceptedGpsRef.current = { lat: location.latitude, lng: location.longitude };
      setState((prev) => ({ ...prev, hasGps: true }));
      return; // position stays at ORIGIN_NORM until real movement is detected
    }

    const origin = originGpsRef.current;

    // ── Deadzone gate ────────────────────────────────────────────────────────
    // Skip this fix if the user hasn't moved far enough from the last
    // accepted point — this stops stationary GPS noise from drifting the sprite.
    const last = lastAcceptedGpsRef.current;
    if (!last) return; // safety guard

    const mPerDegLngGate = M_PER_DEG_LAT * Math.cos((location.latitude * Math.PI) / 180);
    const dxGate = (location.longitude - last.lng) * mPerDegLngGate;
    const dyGate = (location.latitude  - last.lat) * M_PER_DEG_LAT;
    const distFromLast = Math.sqrt(dxGate * dxGate + dyGate * dyGate);
    if (distFromLast < MIN_MOVE_METERS) return;

    // Accept this fix — accumulate real-world distance walked
    totalDistanceRef.current += distFromLast;
    lastAcceptedGpsRef.current = { lat: location.latitude, lng: location.longitude };
    // ── End deadzone gate ────────────────────────────────────────────────────

    // Real-world delta from origin (metres)
    const dLatDeg = location.latitude  - origin.lat;
    const dLngDeg = location.longitude - origin.lng;

    // Metres per degree of longitude varies with latitude
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((location.latitude * Math.PI) / 180);

    const dxMeters =  dLngDeg * mPerDegLng; // positive = east  → right
    const dyMeters = -dLatDeg * M_PER_DEG_LAT; // positive = south → down (invert lat)

    // Convert to normalised map units and add to origin norm
    const targetX = clampNorm(ORIGIN_NORM.x + dxMeters * NORM_PER_METER);
    const targetY = clampNorm(ORIGIN_NORM.y + dyMeters * NORM_PER_METER);

    // Exponential moving average — smooths GPS jitter
    const prev = smoothRef.current;
    const normX = prev.x + SMOOTH_ALPHA * (targetX - prev.x);
    const normY = prev.y + SMOOTH_ALPHA * (targetY - prev.y);
    smoothRef.current = { x: normX, y: normY };

    // Direction — prefer device heading, fall back to position delta
    let direction: SpriteDirection = state.direction;
    if (location.heading != null && location.heading >= 0) {
      direction = headingToDirection(location.heading);
    } else {
      const dx = normX - prev.x;
      const dy = normY - prev.y;
      if (Math.abs(dx) > 0.0002 || Math.abs(dy) > 0.0002) {
        direction = deltasToDirection(dx, dy);
      }
    }

    const isMoving = (location.speed ?? 0) > MOVING_SPEED_THRESHOLD;

    setState({ normX, normY, direction, isMoving, hasGps: true, distanceMeters: totalDistanceRef.current });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return state;
}
