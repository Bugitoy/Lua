import { useMemo } from "react";
import { PixelRatio, useWindowDimensions, View } from "react-native";

import { LuaDamage } from "@/components/health/luaDamage/LuaDamage";
import type { LuaLook } from "@/components/health/luaDamage/luaDamageCore";
import { ITEMS } from "@/constants/luaSprites";
import { useIsOnScreen } from "@/hooks/useIsOnScreen";
import { useMyLook } from "@/lib/avatarLook";

/** Same cut-off the health screen uses for its "dead" title; at or below it Lua is knocked out. */
export const DEAD_RATIO = 0.001;

/** Health 0..100 as LuaDamage takes it, with anything at or below DEAD_RATIO counting as 0. */
export function healthPercentFor(ratio: number): number {
  return ratio <= DEAD_RATIO ? 0 : Math.min(100, ratio * 100);
}

const LAYOUT_REF_TILE_PX = 125;
/** On-screen size, as a multiple of 1% of the shorter screen side. */
const SIZE_PER_VMIN = 0.7;
/** LuaDamage fits Lua's whole reach (stars above, lying down sideways) into this box. */
const HEIGHT_RATIO = 0.75;

function frameWidthDp(pixelBase: number): number {
  const dpr = PixelRatio.get();
  const m = Math.max(4, Math.round(pixelBase * dpr));
  return PixelRatio.roundToNearestPixel((LAYOUT_REF_TILE_PX * m) / dpr);
}

type HealthStatusSpriteProps = {
  healthRatio: number;
};

/**
 * Lua drawn live with every damage effect blended by health (see luaDamage/LuaDamage.tsx):
 * flashes and shakes on a drop, hops on a rise, tips over at 0 and gets back up after.
 */
export function HealthStatusSprite({ healthRatio }: HealthStatusSpriteProps) {
  const { width: vw, height: vh } = useWindowDimensions();
  const { skin, costume, equipped } = useMyLook();
  const onScreen = useIsOnScreen();

  const width = useMemo(() => {
    const vmin = Math.min(vw, vh) / 100;
    return frameWidthDp(Math.min(6, SIZE_PER_VMIN * vmin));
  }, [vw, vh]);
  const height = Math.round(width * HEIGHT_RATIO);

  const look = useMemo<LuaLook>(
    () => ({
      skin,
      costume,
      items: ITEMS.filter((item) => equipped[item.slot] === item.id).map((item) => item.id),
    }),
    [skin, costume, equipped],
  );

  return (
    <View pointerEvents="none">
      <LuaDamage
        health={healthPercentFor(healthRatio)}
        look={look}
        width={width}
        height={height}
        paused={!onScreen}
      />
    </View>
  );
}
