import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type CompassReading = {
  /** Smoothed heading in degrees, [0, 360). `null` until first valid sample. */
  heading: number | null;
  /** Native heading accuracy bucket if reported; lower is better. */
  accuracy: number | null;
};

/**
 * Exponential smoothing factor for compass values (0..1, higher = more reactive).
 * Adaptive: when the user is mostly still / drifting (small angular delta) we
 * favour smoothing to absorb magnetometer twitch; when they're actively turning
 * (large angular delta) we react quickly so the sprite faces the right way
 * within a sample or two instead of lazily catching up over half a second.
 */
const HEADING_ALPHA_STEADY = 0.25;
const HEADING_ALPHA_TURNING = 0.55;
/** Absolute angular change (degrees, shortest arc) that flips us into "turning" mode. */
const TURNING_DEG_THRESHOLD = 18;

/** Below this accuracy bucket (iOS-style 0-3 / Android raw degrees) the heading is dropped. */
const MAX_HEADING_ACCURACY = 30;

/** Shortest signed arc between two compass headings, in degrees. */
function shortestArcDeg(prevDeg: number, nextDeg: number): number {
  const diff = ((nextDeg - prevDeg + 540) % 360) - 180;
  return Math.abs(diff);
}

function smoothHeadingCircular(
  previousDeg: number | null,
  nextDeg: number,
  alpha: number,
): number {
  if (previousDeg == null) return ((nextDeg % 360) + 360) % 360;
  const prevRad = (previousDeg * Math.PI) / 180;
  const nextRad = (nextDeg * Math.PI) / 180;
  const sin =
    Math.sin(prevRad) + alpha * (Math.sin(nextRad) - Math.sin(prevRad));
  const cos =
    Math.cos(prevRad) + alpha * (Math.cos(nextRad) - Math.cos(prevRad));
  const blendedRad = Math.atan2(sin, cos);
  const blendedDeg = (blendedRad * 180) / Math.PI;
  return (blendedDeg + 360) % 360;
}

export function useCompass(): CompassReading {
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      subscription = await Location.watchHeadingAsync((reading) => {
        const next =
          reading.trueHeading >= 0 ? reading.trueHeading : reading.magHeading;
        if (next == null || next < 0) return;
        if (
          reading.accuracy != null &&
          reading.accuracy > MAX_HEADING_ACCURACY
        ) {
          return;
        }

        setHeading((prev) => {
          // First sample: adopt it verbatim, no smoothing possible.
          if (prev == null) return ((next % 360) + 360) % 360;
          const arc = shortestArcDeg(prev, next);
          const alpha =
            arc >= TURNING_DEG_THRESHOLD
              ? HEADING_ALPHA_TURNING
              : HEADING_ALPHA_STEADY;
          return smoothHeadingCircular(prev, next, alpha);
        });
        setAccuracy(reading.accuracy ?? null);
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return { heading, accuracy };
}
