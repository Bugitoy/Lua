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
 * 0.25 follows the phone but absorbs the typical magnetometer twitch.
 */
const HEADING_SMOOTH_ALPHA = 0.25;

/** Below this accuracy bucket (iOS-style 0-3 / Android raw degrees) the heading is dropped. */
const MAX_HEADING_ACCURACY = 30;

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

        setHeading((prev) =>
          smoothHeadingCircular(prev, next, HEADING_SMOOTH_ALPHA),
        );
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
