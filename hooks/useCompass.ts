import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { ensureForegroundLocationPermission } from "@/lib/locationPermission";

import { useIsOnScreen } from "./useIsOnScreen";

export type CompassReading = {
  /** Smoothed heading in degrees, [0, 360). `null` until first valid sample. */
  heading: number | null;
  /** Native heading accuracy bucket if reported; lower is better. Taken with `heading`. */
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

/**
 * Smallest change (degrees) in the smoothed heading that is published to React.
 * The sensor fires many times a second and every publish re-renders the map
 * screen, while the sprite only faces four ways.
 */
const MIN_PUBLISH_DELTA_DEG = 3;

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
  const [compass, setCompass] = useState<CompassReading>({
    heading: null,
    accuracy: null,
  });
  /** Smoothed every sample; only published once it drifts far enough from `compass`. */
  const smoothedRef = useRef<number | null>(null);
  const publishedRef = useRef<number | null>(null);
  const onScreen = useIsOnScreen();

  useEffect(() => {
    if (!onScreen) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const granted = await ensureForegroundLocationPermission();
      if (!granted || cancelled) return;

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

        const prev = smoothedRef.current;
        // First sample: adopt it verbatim, no smoothing possible.
        const smoothed =
          prev == null
            ? ((next % 360) + 360) % 360
            : smoothHeadingCircular(
                prev,
                next,
                shortestArcDeg(prev, next) >= TURNING_DEG_THRESHOLD
                  ? HEADING_ALPHA_TURNING
                  : HEADING_ALPHA_STEADY,
              );
        smoothedRef.current = smoothed;

        const published = publishedRef.current;
        if (
          published != null &&
          shortestArcDeg(published, smoothed) < MIN_PUBLISH_DELTA_DEG
        ) {
          return;
        }
        publishedRef.current = smoothed;
        setCompass({ heading: smoothed, accuracy: reading.accuracy ?? null });
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [onScreen]);

  return compass;
}
