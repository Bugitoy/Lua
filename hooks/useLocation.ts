import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

export type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** metres per second — smoothed, dead-zoned, null if not yet known */
  speed: number | null;
  /** Raw device-reported speed before dead-zoning. Useful for debugging. */
  rawDeviceSpeed: number | null;
  /** degrees clockwise from true north — null if not yet known */
  heading: number | null;
  /** Heading derived from filtered velocity (only valid when moving). */
  movementHeading: number | null;
  /** True while the stationary-lock is engaged. */
  isStationary: boolean;
  /**
   * Filtered velocity components in m/s. East-positive (`vxMps`) and
   * north-positive (`vyMps`). Forced to 0 while the stationary lock is
   * engaged so consumers doing dead-reckoning don't drift the marker.
   */
  vxMps: number | null;
  vyMps: number | null;
};

type UseLocationOptions = {
  /** When true, requests higher fidelity / faster updates (e.g. while routing to a destination). */
  highFidelity?: boolean;
};

type UseLocationResult = {
  location: LocationCoords | null;
  errorMsg: string | null;
};

// Filter constants
/** Steady-state gate: applied after the first fix has been accepted. */
const MAX_ACCURACY_METERS = 60;
/**
 * Cold-start gate: applied until we have any fix to display. Cold-start GPS
 * fixes (especially indoors / in Expo Go) typically arrive at 60–200 m for
 * the first 30 s, so the steady-state gate would silently drop them all.
 */
const WARMUP_MAX_ACCURACY_METERS = 250;
const MIN_MEASUREMENT_VARIANCE = 9; // ≈ 3m floor on σ²
const PROCESS_NOISE_M2_PER_S = 0.4;
/** Any raw speed below this is treated as exactly zero (kills "phantom motion" noise). */
const SPEED_DEADZONE_MPS = 0.55;
/** EMA factor when speed is increasing — needs to react fast enough to detect walking. */
const SPEED_SMOOTH_ALPHA_RISE = 0.5;
/** EMA factor when speed is decreasing — falls fast so stale spikes decay quickly. */
const SPEED_SMOOTH_ALPHA_FALL = 0.55;
/** Below this, the emitted speed is forced to exactly 0. */
const SPEED_OUTPUT_CUTOFF_MPS = 0.25;
// Hysteresis: engage stationary below low threshold, only break above high threshold.
const STATIONARY_SPEED_MPS = 0.4;
/**
 * Speed (post-deadzone) for speed-only unlock — keep above idle noise, below
 * full-out running; walking is often ~1.0 m/s on device-reported speed.
 */
const MOVING_SPEED_MPS = 1.05;
const STATIONARY_HOLD_SECONDS = 2;
/** Kalman-vs-anchor threshold (slow alone when we hold emissions to anchor). */
const STATIONARY_BREAK_DRIFT_METERS = 14;
/** Unlock when the new raw fix is this far past the anchor (fast walking response). */
const STATIONARY_MIN_RAW_MEASUREMENT_BREAK_M = 6.5;
const STATIONARY_RAW_DRIFT_ACC_MULT = 0.95;
const STATIONARY_RAW_DRIFT_HARD_CAP_M = 28;
/**
 * If we only “move” by doppler spikes (no raw displacement), require two agrees
 * — keeps a single desk spike from unlocking.
 */
const SPEED_ONLY_BREAK_CONFIRMATIONS = 2;
/** Scales the Kalman drift-break radius by GPS accuracy. */
const STATIONARY_DRIFT_ACCURACY_MULTIPLIER = 1.75;

const M_PER_DEG_LAT = 111_000;

function metersToLatDeg(meters: number): number {
  return meters / M_PER_DEG_LAT;
}

function metersToLngDeg(meters: number, atLatitudeDeg: number): number {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((atLatitudeDeg * Math.PI) / 180);
  if (mPerDegLng <= 0) return 0;
  return meters / mPerDegLng;
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dy = (b.latitude - a.latitude) * M_PER_DEG_LAT;
  const dx =
    (b.longitude - a.longitude) *
    (M_PER_DEG_LAT * Math.cos((b.latitude * Math.PI) / 180));
  return Math.sqrt(dx * dx + dy * dy);
}

function headingFromVelocityDeg(vxMps: number, vyMps: number): number | null {
  const speed = Math.sqrt(vxMps * vxMps + vyMps * vyMps);
  if (speed < MOVING_SPEED_MPS) return null;
  // atan2(east, north) → compass bearing in [0, 360)
  const deg = (Math.atan2(vxMps, vyMps) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function useLocation(options: UseLocationOptions = {}): UseLocationResult {
  const { highFidelity = false } = options;

  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mutable filter state — never causes re-renders directly
  const initializedRef = useRef(false);
  const estLatRef = useRef(0);
  const estLngRef = useRef(0);
  // Variances stored in deg² so they combine cleanly with deg-space measurements
  const varLatRef = useRef(0);
  const varLngRef = useRef(0);
  const lastFixTimeMsRef = useRef<number | null>(null);
  const smoothedSpeedRef = useRef<number | null>(null);
  const movementHeadingRef = useRef<number | null>(null);
  const stationaryStartMsRef = useRef<number | null>(null);
  const stationaryAnchorRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const isStationaryRef = useRef(false);
  /** Counts consecutive break-eligible fixes so a single noisy reading can't unlock us. */
  const breakConfirmationsRef = useRef(0);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission denied");
        return;
      }
      if (cancelled) return;

      const processFix = (loc: Location.LocationObject) => {
          const accuracy = loc.coords.accuracy ?? null;
          // Two-tier gate: be permissive during cold-start so the user sees
          // *something* quickly, then tighten once we have a fix to refine.
          const accuracyLimit = initializedRef.current
            ? MAX_ACCURACY_METERS
            : WARMUP_MAX_ACCURACY_METERS;
          if (accuracy != null && accuracy > accuracyLimit) return;

          const rawLat = loc.coords.latitude;
          const rawLng = loc.coords.longitude;
          const nowMs = loc.timestamp ?? Date.now();

          // Measurement variance in metres², converted per axis to deg².
          const sigmaMeters = Math.max(3, (accuracy ?? 30)) / 1.96;
          const measurementVarMeters2 = Math.max(
            MIN_MEASUREMENT_VARIANCE,
            sigmaMeters * sigmaMeters,
          );
          const measurementVarLatDeg2 = (measurementVarMeters2) / (M_PER_DEG_LAT * M_PER_DEG_LAT);
          const mPerDegLng = M_PER_DEG_LAT * Math.cos((rawLat * Math.PI) / 180);
          const measurementVarLngDeg2 =
            mPerDegLng > 0
              ? measurementVarMeters2 / (mPerDegLng * mPerDegLng)
              : measurementVarLatDeg2;

          // First fix: initialize estimate at the measurement.
          if (!initializedRef.current) {
            initializedRef.current = true;
            estLatRef.current = rawLat;
            estLngRef.current = rawLng;
            varLatRef.current = measurementVarLatDeg2;
            varLngRef.current = measurementVarLngDeg2;
            lastFixTimeMsRef.current = nowMs;
            smoothedSpeedRef.current = 0;
            stationaryStartMsRef.current = nowMs;
            stationaryAnchorRef.current = {
              latitude: rawLat,
              longitude: rawLng,
            };
            isStationaryRef.current = true;

            setLocation({
              latitude: rawLat,
              longitude: rawLng,
              accuracy,
              speed: 0,
              rawDeviceSpeed:
                loc.coords.speed != null && loc.coords.speed >= 0
                  ? loc.coords.speed
                  : null,
              heading:
                loc.coords.heading != null && loc.coords.heading >= 0
                  ? loc.coords.heading
                  : null,
              movementHeading: null,
              isStationary: true,
              vxMps: 0,
              vyMps: 0,
            });
            return;
          }

          const dtSec = Math.max(
            0.1,
            (nowMs - (lastFixTimeMsRef.current ?? nowMs)) / 1000,
          );

          // Add process noise for elapsed time, then Kalman update per axis.
          const processVarLat = (PROCESS_NOISE_M2_PER_S * dtSec) / (M_PER_DEG_LAT * M_PER_DEG_LAT);
          const processVarLng =
            mPerDegLng > 0
              ? (PROCESS_NOISE_M2_PER_S * dtSec) / (mPerDegLng * mPerDegLng)
              : processVarLat;

          varLatRef.current += processVarLat;
          varLngRef.current += processVarLng;

          const gainLat =
            varLatRef.current / (varLatRef.current + measurementVarLatDeg2);
          const gainLng =
            varLngRef.current / (varLngRef.current + measurementVarLngDeg2);

          const prevLat = estLatRef.current;
          const prevLng = estLngRef.current;

          estLatRef.current = prevLat + gainLat * (rawLat - prevLat);
          estLngRef.current = prevLng + gainLng * (rawLng - prevLng);
          varLatRef.current = (1 - gainLat) * varLatRef.current;
          varLngRef.current = (1 - gainLng) * varLngRef.current;

          // Velocity from filtered position delta (used only to derive a heading
          // when device-reported heading is missing).
          const dyMeters = (estLatRef.current - prevLat) * M_PER_DEG_LAT;
          const dxMeters = (estLngRef.current - prevLng) * mPerDegLng;
          const vyMps = dyMeters / dtSec;
          const vxMps = dxMeters / dtSec;
          const derivedSpeed = Math.sqrt(vxMps * vxMps + vyMps * vyMps);

          // Prefer device-reported (Doppler) speed for stationary detection — it
          // correctly reports ~0 m/s when not moving, whereas position-delta speed
          // spikes whenever a noisy fix shifts the filtered estimate.
          const deviceSpeed = loc.coords.speed;
          const rawDeviceSpeed =
            deviceSpeed != null && deviceSpeed >= 0 ? deviceSpeed : null;
          const rawSpeedRaw =
            rawDeviceSpeed != null ? rawDeviceSpeed : derivedSpeed;

          // Hard dead-zone: anything below the threshold becomes exactly zero
          // BEFORE smoothing. This is what kills "phantom motion" on stationary
          // phones where Android occasionally reports 0.4–0.9 m/s of noise.
          const rawSpeedForLock =
            rawSpeedRaw < SPEED_DEADZONE_MPS ? 0 : rawSpeedRaw;

          const prevSpeed = smoothedSpeedRef.current ?? rawSpeedForLock;
          // Asymmetric smoothing: rise slowly (suppress single-fix spikes), fall
          // quickly (don't carry stale momentum after the user actually stops).
          const alpha =
            rawSpeedForLock >= prevSpeed
              ? SPEED_SMOOTH_ALPHA_RISE
              : SPEED_SMOOTH_ALPHA_FALL;
          const smoothSpeedRaw =
            prevSpeed + alpha * (rawSpeedForLock - prevSpeed);
          const smoothSpeed =
            smoothSpeedRaw < SPEED_OUTPUT_CUTOFF_MPS ? 0 : smoothSpeedRaw;
          smoothedSpeedRef.current = smoothSpeed;

          const newMovementHeading = headingFromVelocityDeg(vxMps, vyMps);
          if (newMovementHeading != null) {
            movementHeadingRef.current = newMovementHeading;
          }

          // Stationary lock state machine.
          let emittedLat = estLatRef.current;
          let emittedLng = estLngRef.current;
          const anchor = stationaryAnchorRef.current;

          if (isStationaryRef.current && anchor) {
            const kalmanDriftFromAnchor = distanceMeters(anchor, {
              latitude: estLatRef.current,
              longitude: estLngRef.current,
            });
            /** Raw-fix drift — reacts immediately when GPS moves with the user while we pin emits to anchor. */
            const rawMeasDrift = distanceMeters(anchor, {
              latitude: rawLat,
              longitude: rawLng,
            });
            // Inflate the drift radius when GPS accuracy is poor: noisy fixes can drift
            // many metres without the user actually moving.
            const kalmanLimit = Math.max(
              STATIONARY_BREAK_DRIFT_METERS,
              (accuracy ?? 0) * STATIONARY_DRIFT_ACCURACY_MULTIPLIER,
            );
            /** More aggressive than kalman-limit so walking unlocks quickly; capped + accuracy-scaled. */
            const rawBreakLimit = Math.min(
              STATIONARY_RAW_DRIFT_HARD_CAP_M,
              Math.max(
                STATIONARY_MIN_RAW_MEASUREMENT_BREAK_M,
                (accuracy ?? 15) * STATIONARY_RAW_DRIFT_ACC_MULT,
              ),
            );
            const breakingByKalmanDrift = kalmanDriftFromAnchor > kalmanLimit;
            const breakingByRawDisplacement = rawMeasDrift > rawBreakLimit;

            const breakingByDrift =
              breakingByKalmanDrift || breakingByRawDisplacement;
            // Use the raw (post-deadzone) speed for the break decision — the dead-zone
            // already filters noise, and the EMA-smoothed value adds 4–6 fixes of lag
            // before it crosses the threshold, which is felt as a sluggish start.
            const breakingBySpeed = rawSpeedForLock > MOVING_SPEED_MPS;
            /** Single noisy speed spike shouldn’t unlock; raw displacement does in one shot. */
            const breakConfirmNeeded =
              breakingBySpeed &&
              !breakingByRawDisplacement
                ? SPEED_ONLY_BREAK_CONFIRMATIONS
                : 1;
            if (breakingByDrift || breakingBySpeed) {
              breakConfirmationsRef.current += 1;
              if (breakConfirmationsRef.current >= breakConfirmNeeded) {
                isStationaryRef.current = false;
                stationaryStartMsRef.current = null;
                stationaryAnchorRef.current = null;
                breakConfirmationsRef.current = 0;
              } else {
                // Tentative break — keep showing the anchor until confirmed.
                emittedLat = anchor.latitude;
                emittedLng = anchor.longitude;
              }
            } else {
              breakConfirmationsRef.current = 0;
              emittedLat = anchor.latitude;
              emittedLng = anchor.longitude;
            }
          } else {
            // Entering stationary mode: smoothed speed below threshold long enough.
            if (smoothSpeed < STATIONARY_SPEED_MPS) {
              if (stationaryStartMsRef.current == null) {
                stationaryStartMsRef.current = nowMs;
              } else if (
                nowMs - stationaryStartMsRef.current >=
                STATIONARY_HOLD_SECONDS * 1000
              ) {
                isStationaryRef.current = true;
                stationaryAnchorRef.current = {
                  latitude: estLatRef.current,
                  longitude: estLngRef.current,
                };
                breakConfirmationsRef.current = 0;
                emittedLat = stationaryAnchorRef.current.latitude;
                emittedLng = stationaryAnchorRef.current.longitude;
              }
            } else {
              stationaryStartMsRef.current = null;
            }
          }

          lastFixTimeMsRef.current = nowMs;

          const rawHeading = loc.coords.heading;
          const heading =
            rawHeading != null && rawHeading >= 0
              ? rawHeading
              : movementHeadingRef.current;

          // Zero out velocity while the stationary lock is engaged so the
          // dead-reckoning consumer in GeoMapView doesn't push the sprite
          // forward when we're intentionally pinned to an anchor.
          const emittedVxMps = isStationaryRef.current ? 0 : vxMps;
          const emittedVyMps = isStationaryRef.current ? 0 : vyMps;

          setLocation({
            latitude: emittedLat,
            longitude: emittedLng,
            accuracy,
            speed: smoothSpeed,
            rawDeviceSpeed,
            heading,
            movementHeading: movementHeadingRef.current,
            isStationary: isStationaryRef.current,
            vxMps: emittedVxMps,
            vyMps: emittedVyMps,
          });
      };

      // Intentionally no `getLastKnownPositionAsync` seed: the OS cache often
      // still points at a previous home/office for days after a move, which
      // makes the map lie until a fresh GPS fix arrives. Cold start is handled
      // by the warmup accuracy gate + `watchPositionAsync` instead.

      if (cancelled) return;

      subscription = await Location.watchPositionAsync(
        {
          // Always BestForNavigation: this app is a live-tracking experience,
          // not a background battery saver. The user opted into the extra drain
          // in exchange for sub-second response to movement.
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: highFidelity ? 600 : 1000,
          // 1m delivers a fresh fix as soon as the user takes a step instead of
          // waiting out the full timeInterval. Pairs with dead-reckoning in the
          // marker layer to keep the sprite continuously sliding.
          distanceInterval: 1,
        },
        processFix,
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [highFidelity]);

  return { location, errorMsg };
}

export const __locationFilterInternals = {
  metersToLatDeg,
  metersToLngDeg,
  distanceMeters,
};
