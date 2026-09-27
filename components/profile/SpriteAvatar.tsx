import { Canvas, Fill, Group, Image, Oval, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { PixelRatio, View } from "react-native";

import { useLookLayers } from "@/components/achievements/spriteSheets";
import { ACH, AVATAR_GRID, BASELINE_ART_Y, NEAREST } from "@/components/achievements/theme";
import { SHOE_ITEMS } from "@/constants/luaSprites";
import { useMyLook, type AvatarLook } from "@/lib/avatarLook";

/** Art px across the circle: Lua from hat to soles, wide brims and capes included. */
const WINDOW_ART_PX = 25;
/** Tighter than this and the feet clip on the circle's lower edge. */
const MIN_WINDOW_ART_PX = 23;
/** Circle centre in cell art px, a little below the middle where the figure stands. */
const CENTER_X = 16;
const CENTER_Y = 18.5;

const MY_BACKDROP = "#d1fae5";

/** dp per art pixel, whole device pixels, as close to WINDOW_ART_PX across as the screen allows. */
function artUnit(diameter: number): number {
  const dpr = PixelRatio.get();
  const exact = (diameter / WINDOW_ART_PX) * dpr;
  const up = Math.ceil(exact) / dpr;
  return diameter / up >= MIN_WINDOW_ART_PX ? up : Math.max(1, Math.floor(exact)) / dpr;
}

type SpriteAvatarProps = {
  look: AvatarLook;
  /** Outer diameter, ring included. */
  size: number;
  backdrop?: string;
  ringWidth?: number;
  ringColor?: string;
  /** Leave unset when a parent Pressable already labels the avatar. */
  accessibilityLabel?: string;
};

/** A still of Lua in a round frame, used wherever a profile picture would go. */
export function SpriteAvatar({
  look,
  size,
  backdrop = ACH.card,
  ringWidth = 0,
  ringColor = "transparent",
  accessibilityLabel,
}: SpriteAvatarProps) {
  const layers = useLookLayers(look);
  const inner = size - 2 * ringWidth;
  const unit = artUnit(inner);
  const cell = unit * AVATAR_GRID;
  const shoesWorn = !look.costume && SHOE_ITEMS.some((id) => look.equipped.feet === id);
  const lift = shoesWorn ? 2 * unit : 0;
  const cellX = PixelRatio.roundToNearestPixel(inner / 2 - CENTER_X * unit);
  const cellY = PixelRatio.roundToNearestPixel(inner / 2 - CENTER_Y * unit);
  const baselineY = cellY + BASELINE_ART_Y * unit;
  const circle = useMemo(
    () => Skia.RRectXY(Skia.XYWHRect(0, 0, inner, inner), inner / 2, inner / 2),
    [inner],
  );

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ringWidth,
        borderColor: ringColor,
      }}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Canvas style={{ width: inner, height: inner }} pointerEvents="none">
        <Group clip={circle}>
          <Fill color={backdrop} />
          <Oval
            x={inner / 2 - 5.5 * unit}
            y={baselineY - 0.8 * unit}
            width={11 * unit}
            height={1.6 * unit}
            color="rgba(0,0,0,0.08)"
          />
          <Group clip={{ x: cellX, y: cellY - lift, width: cell, height: cell }}>
            {layers.map((image, i) => (
              <Image
                key={i}
                image={image}
                x={cellX}
                y={cellY - lift}
                width={4 * cell}
                height={4 * cell}
                fit="fill"
                sampling={NEAREST}
              />
            ))}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

/** The signed-in player's own dressed Lua. */
export function MySpriteAvatar({
  backdrop = MY_BACKDROP,
  ...props
}: Omit<SpriteAvatarProps, "look">) {
  return <SpriteAvatar look={useMyLook()} backdrop={backdrop} {...props} />;
}
