import { Image } from "expo-image";
import { useEffect, useMemo } from "react";
import { PixelRatio, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { SPRITE_HEALTH } from "@/constants/mapAssets";

/**
 * 500×500 sheet — 4 cols × 4 rows, each tile 125×125 px.
 *   Row 0: full health  (ratio >= 0.75)
 *   Row 1: medium       (ratio >= 0.50)
 *   Row 2: low          (ratio >= 0.25)
 *   Row 3: dead         (ratio <  0.25)
 */
const SRC_TILE = 125;
const COLS = 4;

function healthRow(ratio: number): number {
  if (ratio >= 0.75) return 0;
  if (ratio >= 0.5) return 1;
  if (ratio >= 0.25) return 2;
  return 3;
}

function frameWidthDp(pixelBase: number): number {
  const dpr = PixelRatio.get();
  const m = Math.max(4, Math.round(pixelBase * dpr));
  return PixelRatio.roundToNearestPixel((SRC_TILE * m) / dpr);
}

type HealthStatusSpriteProps = {
  healthRatio: number;
};

export function HealthStatusSprite({ healthRatio }: HealthStatusSpriteProps) {
  const { width: vw, height: vh } = useWindowDimensions();

  const pixelBase = useMemo(() => {
    const vmin = Math.min(vw, vh) / 100;
    return Math.min(6, 1.15 * vmin);
  }, [vw, vh]);

  const frameW = useMemo(() => frameWidthDp(pixelBase), [pixelBase]);

  const row = healthRow(healthRatio);
  const isDead = row === 3;

  // SharedValues so the animated worklet always reads the latest values.
  const rowSV = useSharedValue(row);
  const frameWSV = useSharedValue(frameW);

  useEffect(() => {
    rowSV.value = row;
  }, [row, rowSV]);

  useEffect(() => {
    frameWSV.value = frameW;
  }, [frameW, frameWSV]);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (isDead) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(COLS, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [isDead, progress]);

  const sheetStyle = useAnimatedStyle(() => {
    const fw = frameWSV.value;
    const frame = Math.floor(progress.value % COLS);
    return {
      transform: [
        { translateX: -frame * fw },
        { translateY: -rowSV.value * fw },
      ],
    };
  });

  const sheetW = COLS * frameW;
  const sheetH = COLS * frameW; // 4 rows × frameW

  return (
    <View className="items-center justify-center" pointerEvents="none">
      <View style={{ width: frameW, height: frameW, overflow: "hidden" }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              width: sheetW,
              height: sheetH,
            },
            sheetStyle,
          ]}
        >
          <Image
            source={SPRITE_HEALTH}
            style={{ width: sheetW, height: sheetH }}
            contentFit="fill"
            allowDownscaling={false}
            transition={null}
          />
        </Animated.View>
      </View>
    </View>
  );
}
