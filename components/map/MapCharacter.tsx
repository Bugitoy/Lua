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

import { MAP_SCALE, MAP_SRC_H, MAP_SRC_W, SHADOW_URI, SPRITE_URI } from "@/constants/mapAssets";
import { getContainedImageRect } from "@/lib/mapPanBounds";

const GRID = 32;
const COLS = 4;
const ROWS = 4;

/** Slightly smaller on-screen footprint without changing animation math. */
const SPRITE_DISPLAY_SCALE = 0.8;

/**
 * RN has no `image-rendering: pixelated`. Bilinear filtering looks soft when:
 * - layout size × DPR is not divisible by 32 (misaligned device pixel grid), or
 * - each source pixel maps to fewer than ~3 physical pixels (tiny upscale = mushy).
 *
 * Pick an integer `m` = physical pixels per source pixel (width of one 1px column in the sheet),
 * then layout width = (32 × m) / DPR so the bitmap scale hits exact device pixels.
 */
function frameWidthDpForPhysicalScale(
  pixelBase: number,
  minPhysicalPxPerSourcePixel: number,
): number {
  const dpr = PixelRatio.get();
  const m = Math.max(
    minPhysicalPxPerSourcePixel,
    Math.round(pixelBase * dpr),
  );
  const physicalCell = GRID * m;
  return PixelRatio.roundToNearestPixel(physicalCell / dpr);
}

export type SpriteDirection = "down" | "right" | "up" | "left";

const ROW_INDEX: Record<SpriteDirection, number> = {
  down: 0,
  right: 1,
  up: 2,
  left: 3,
};

type MapCharacterProps = {
  /** When false, walk animation pauses on the first frame. */
  isMoving?: boolean;
  direction?: SpriteDirection;
  /**
   * Normalised (0–1) position on the campus bitmap.
   * When provided the sprite is positioned at that GPS-derived location;
   * when omitted it falls back to the static centre-of-map default.
   */
  normX?: number;
  normY?: number;
  /** Must match `effectiveMapScale` from useMapPan so marker math is consistent. */
  mapScale?: number;
};

/**
 * Pixel-art RPG sprite: 4×4 sheet (DemoRpgCharacter.png), 32px tiles.
 * Walk: horizontal strip cycles in 1s (same as `steps(4)` + `moveSpritesheet`).
 */
export function MapCharacter({
  isMoving = true,
  direction = "down",
  normX,
  normY,
  mapScale = MAP_SCALE,
}: MapCharacterProps) {
  const { width: vw, height: vh } = useWindowDimensions();

  const pixelBase = useMemo(() => {
    const vmin = Math.min(vw, vh) / 100;
    return Math.min(6, 1.15 * vmin);
  }, [vw, vh]);

  /** Higher = sharper on retina (larger on-screen sprite). 4 is a good default. */
  const frameW = useMemo(
    () =>
      frameWidthDpForPhysicalScale(pixelBase * SPRITE_DISPLAY_SCALE, 4),
    [pixelBase],
  );
  const sheetW = COLS * frameW;
  const sheetH = ROWS * frameW;

  // GPS-driven absolute position inside the ImageBackground box
  const spritePos = useMemo(() => {
    if (normX == null || normY == null) return null;
    if (vw <= 0 || vh <= 0) return null;
    const { ox, oy, rw, rh } = getContainedImageRect(vw, vh, mapScale, MAP_SRC_W, MAP_SRC_H);
    return {
      left: ox + normX * rw,
      top: oy + normY * rh,
    };
  }, [normX, normY, vw, vh, mapScale]);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!isMoving) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(COLS, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [isMoving, progress]);

  const sheetStyle = useAnimatedStyle(() => {
    const frame = Math.floor(progress.value % COLS);
    const tx = -frame * frameW;
    const ty = -ROW_INDEX[direction] * frameW;
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  }, [frameW, direction]);

  return (
    <View
      pointerEvents="none"
      style={
        spritePos
          ? {
              position: "absolute",
              left: spritePos.left,
              top: spritePos.top,
              // Centre the sprite on the GPS pin point (feet at the pin)
              transform: [{ translateX: -frameW / 2 }, { translateY: -frameW }],
            }
          : {
              // Default: horizontally centred, roughly 45 % down the map
              position: "absolute",
              left: 0,
              right: 0,
              top: "45%",
              alignItems: "center",
            }
      }
    >
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: frameW,
            height: frameW,
            overflow: "hidden",
          }}
        >
          <Image
            source={{ uri: SHADOW_URI }}
            style={{
              position: "absolute",
              bottom: 0,
              width: frameW,
              height: frameW,
            }}
            contentFit="contain"
            allowDownscaling={false}
            transition={null}
          />
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
              source={{ uri: SPRITE_URI }}
              style={{ width: sheetW, height: sheetH }}
              contentFit="fill"
              allowDownscaling={false}
              transition={null}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
