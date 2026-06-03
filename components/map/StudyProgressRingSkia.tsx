import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { View } from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

/** One full border loop while studying (default: 1 hour). Use 60_000 for a 1-minute test loop. */
export const RING_CYCLE_MS = 10_000;
export const RING_RADIUS = 18;
export const RING_STROKE = 4;
const RING_ACCENT_COLOR = "#4ade80";
const RING_TRACK_COLOR = "rgba(22, 163, 74, 0.18)";
const RING_HEAD_FRACTION = 0.1;
const RING_HEAD_MIN_PX = 24;

function getRingPerimeter(
  width: number,
  height: number,
  ringRadius: number,
): number {
  const topLen = Math.max(0, width - 2 * ringRadius);
  const sideLen = Math.max(0, height - 2 * ringRadius);
  const cornerLen = (Math.PI / 2) * ringRadius;
  return 2 * (topLen + sideLen) + 4 * cornerLen;
}

type StudyProgressRingSkiaProps = {
  width: number;
  height: number;
  isStudying: boolean;
  studyStartedAtMs: number | null;
  studyElapsedMs?: number;
  ringCycleMs?: number;
};

type HeadState = {
  /** Normalized [0, 1) position of the head front. */
  front: number;
  /** Normalized [0, 1) position of the head back. */
  back: number;
  active: boolean;
};

/** Position of the moving accent head along the border, in one continuous loop. */
function computeHeadState(
  elapsedMs: number,
  ringCycleMs: number,
  perimeter: number,
): HeadState {
  "worklet";
  if (perimeter <= 0 || ringCycleMs <= 0 || elapsedMs <= 0) {
    return { front: 0, back: 0, active: false };
  }

  const headLen = Math.max(perimeter * RING_HEAD_FRACTION, RING_HEAD_MIN_PX);
  const totalDistance = (elapsedMs / ringCycleMs) * perimeter;

  const front = ((totalDistance % perimeter) + perimeter) % perimeter / perimeter;
  const backAbs = totalDistance - headLen;
  const back =
    backAbs <= 0 ? 0 : ((((backAbs % perimeter) + perimeter) % perimeter) / perimeter);

  return { front, back, active: true };
}

function trimPath(
  source: ReturnType<typeof Skia.Path.Make>,
  start: number,
  end: number,
) {
  "worklet";
  if (end <= start) {
    return Skia.Path.Make();
  }
  const copy = source.copy();
  const trimmed = copy.trim(start, end, false);
  return trimmed ?? Skia.Path.Make();
}

/** Trim along path, including segments that cross the path start (t=0). */
function trimPathWrap(
  source: ReturnType<typeof Skia.Path.Make>,
  start: number,
  end: number,
) {
  "worklet";
  if (end <= 0 && start <= 0) {
    return Skia.Path.Make();
  }
  if (end > start) {
    return trimPath(source, start, end);
  }
  const combined = Skia.Path.Make();
  if (start < 1) {
    combined.addPath(trimPath(source, start, 1));
  }
  if (end > 0) {
    combined.addPath(trimPath(source, 0, end));
  }
  return combined;
}

function makeTrackPath(width: number, height: number) {
  const inset = RING_STROKE / 2;
  const rect = Skia.XYWHRect(
    inset,
    inset,
    width - RING_STROKE,
    height - RING_STROKE,
  );
  const rrect = Skia.RRectXY(rect, RING_RADIUS, RING_RADIUS);
  const path = Skia.Path.Make();
  path.addRRect(rrect);
  return path;
}

export function StudyProgressRingSkia({
  width,
  height,
  isStudying,
  studyStartedAtMs,
  studyElapsedMs = 0,
  ringCycleMs = RING_CYCLE_MS,
}: StudyProgressRingSkiaProps) {
  const elapsedMs = useSharedValue(0);
  const startedAtSV = useSharedValue(0);
  const isStudyingSV = useSharedValue(0);
  const ringCycleSV = useSharedValue(ringCycleMs);
  const perimeterSV = useSharedValue(0);
  const trackPathSV = useSharedValue(Skia.Path.Make());
  const hasLayoutSV = useSharedValue(0);

  useEffect(() => {
    ringCycleSV.value = ringCycleMs;
  }, [ringCycleMs, ringCycleSV]);

  useEffect(() => {
    if (width <= 0 || height <= 0) {
      hasLayoutSV.value = 0;
      return;
    }
    trackPathSV.value = makeTrackPath(width, height);
    perimeterSV.value = getRingPerimeter(width, height, RING_RADIUS);
    hasLayoutSV.value = 1;
  }, [width, height, trackPathSV, perimeterSV, hasLayoutSV]);

  useEffect(() => {
    isStudyingSV.value = isStudying ? 1 : 0;
    if (isStudying && studyStartedAtMs != null) {
      startedAtSV.value = studyStartedAtMs;
      elapsedMs.value = Math.max(0, studyElapsedMs);
      return;
    }
    startedAtSV.value = 0;
    elapsedMs.value = 0;
  }, [
    isStudying,
    studyStartedAtMs,
    studyElapsedMs,
    isStudyingSV,
    startedAtSV,
    elapsedMs,
  ]);

  useEffect(() => {
    if (isStudying && studyElapsedMs > 0) {
      elapsedMs.value = studyElapsedMs;
    }
  }, [studyElapsedMs, isStudying, elapsedMs]);

  useFrameCallback(() => {
    "worklet";
    if (isStudyingSV.value === 0 || startedAtSV.value === 0) {
      return;
    }
    elapsedMs.value = Math.max(0, Date.now() - startedAtSV.value);
  }, true);

  const headState = useDerivedValue(() => {
    return computeHeadState(
      elapsedMs.value,
      ringCycleSV.value,
      perimeterSV.value,
    );
  });

  /** Bright accent head; wraps across the seam so motion never breaks. */
  const headPath = useDerivedValue(() => {
    if (hasLayoutSV.value === 0 || !headState.value.active) {
      return Skia.Path.Make();
    }
    const { back, front } = headState.value;
    return trimPathWrap(trackPathSV.value, back, front);
  });

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        zIndex: 1,
      }}
    >
      <Canvas style={{ width, height }}>
        <Path
          path={trackPathSV}
          style="stroke"
          strokeWidth={RING_STROKE}
          color={RING_TRACK_COLOR}
          strokeCap="round"
          strokeJoin="round"
        />
        <Path
          path={headPath}
          style="stroke"
          strokeWidth={RING_STROKE}
          color={RING_ACCENT_COLOR}
          strokeCap="round"
          strokeJoin="round"
        />
      </Canvas>
    </View>
  );
}
