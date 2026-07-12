import { Ionicons } from "@expo/vector-icons";
import { Canvas, Path, Shader, Skia } from "@shopify/react-native-skia";
import { Fragment, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { SpriteIcon, SpritePreview } from "@/components/achievements/SpriteCell";
import type { AchievementSheets } from "@/components/achievements/spriteSheets";
import {
  ACH,
  CARD_STYLE,
  formatXp,
  snapToDevicePixels,
} from "@/components/achievements/theme";
import {
  fillDistanceForXp,
  filledRegion,
  LAST_ROW,
  PATH_COLS,
  ROAD_HALF,
  roadPath,
  START_COL,
  START_ROW,
  UNLOCK_ROUTE,
} from "@/components/achievements/unlockRoute";
import { Pixelify } from "@/constants/fonts";
import { ICON_CELLS, ITEMS, PREVIEW_CELLS } from "@/constants/luaSprites";
import { getAppLocale } from "@/lib/i18n/formatLocale";

const CHECKER = Skia.RuntimeEffect.Make(`
uniform float cell;
uniform vec4 colorA;
uniform vec4 colorB;
half4 main(float2 p) {
  float2 c = floor(p / cell);
  return half4(mod(c.x + c.y, 2.0) < 1.0 ? colorA : colorB);
}`)!;

const ROAD_GREY = [Array.from(Skia.Color("#e9e7ef")), Array.from(Skia.Color("#dedbe7"))];
const ROAD_GREEN = [Array.from(Skia.Color(ACH.green)), Array.from(Skia.Color("#30b257"))];
const ROAD_FRONT = "#9be8b3";
const FLASH_WHITE = "#ffffff";
const FLASH_GREEN = "#43d16f";
/** Tiles at the front edge of the fill drawn light green. */
const FRONT_TILES = 2;

const BADGE = 56;
const MAX_PREVIEW = 84;
const PREVIEW_FPS = 7;
const PULSE_MS = 1800;

type MilestoneState = "done" | "next" | "locked";

type UnlockPathProps = {
  width: number;
  sheets: AchievementSheets;
  unlockedCount: number;
  /** Counting-up XP, and the same count 140 ms and 420 ms behind it for the tile flash. */
  xp: SharedValue<number>;
  xpFlashWhite: SharedValue<number>;
  xpFlashGreen: SharedValue<number>;
  active: boolean;
  reduceMotion: boolean;
};

export function UnlockPath({
  width,
  sheets,
  unlockedCount,
  xp,
  xpFlashWhite,
  xpFlashGreen,
  active,
  reduceMotion,
}: UnlockPathProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();

  const gridWidth = width - 28;
  const tile = snapToDevicePixels(gridWidth / PATH_COLS);
  const roadWidth = tile * PATH_COLS;
  const previewSize = Math.min(MAX_PREVIEW, Math.floor(30 * tile - BADGE / 2 - 8));
  const roadHeight = Math.ceil(LAST_ROW * tile + Math.max(BADGE / 2, previewSize / 2 + 12) + 6);

  const border = useMemo(() => roadPath(tile, 1), [tile]);
  const road = useMemo(() => roadPath(tile, 0), [tile]);

  const { segments, stopDistances } = UNLOCK_ROUTE;
  const fillNow = useDerivedValue(() => fillDistanceForXp(xp.value, stopDistances));
  const fillWhite = useDerivedValue(() => fillDistanceForXp(xpFlashWhite.value, stopDistances));
  const fillGreen = useDerivedValue(() => fillDistanceForXp(xpFlashGreen.value, stopDistances));
  // Painted newest-first so each later layer covers older tiles: white flash, bright green
  // flash, light green front, settled checker.
  const whiteRegion = useDerivedValue(() => filledRegion(segments, fillNow.value, tile));
  const brightRegion = useDerivedValue(() => filledRegion(segments, fillWhite.value, tile));
  const frontRegion = useDerivedValue(() => filledRegion(segments, fillGreen.value, tile));
  const settledRegion = useDerivedValue(() =>
    filledRegion(segments, Math.min(fillGreen.value, fillNow.value - FRONT_TILES), tile),
  );

  const previewClock = useSharedValue(0);
  const previewFrame = useDerivedValue(() => Math.floor(previewClock.value % 4));
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(previewClock);
      cancelAnimation(pulse);
      previewClock.value = 0;
      pulse.value = 0;
      return;
    }
    previewClock.value = 0;
    previewClock.value = withRepeat(
      withTiming(4, { duration: (4 / PREVIEW_FPS) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [active, reduceMotion, previewClock, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + 0.3 * pulse.value }],
  }));

  return (
    <View className="mb-4 px-3.5 pb-3 pt-4" style={CARD_STYLE}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-base" style={{ fontFamily: Pixelify.bold, color: ACH.text }}>
          {t("achievements.path.title")}
        </Text>
        <Text className="text-xs" style={{ fontFamily: Pixelify.medium, color: ACH.textSecondary }}>
          {t("achievements.path.count", { done: unlockedCount, total: ITEMS.length })}
        </Text>
      </View>

      <View style={{ width: roadWidth, height: roadHeight, alignSelf: "center" }}>
        <Canvas style={{ width: roadWidth, height: roadHeight }} pointerEvents="none">
          <Path path={border} color={ACH.outline} />
          <Path path={road}>
            <Shader
              source={CHECKER}
              uniforms={{ cell: 2 * tile, colorA: ROAD_GREY[0], colorB: ROAD_GREY[1] }}
            />
          </Path>
          <Path path={whiteRegion} color={FLASH_WHITE} />
          <Path path={brightRegion} color={FLASH_GREEN} />
          <Path path={frontRegion} color={ROAD_FRONT} />
          <Path path={settledRegion}>
            <Shader
              source={CHECKER}
              uniforms={{ cell: 2 * tile, colorA: ROAD_GREEN[0], colorB: ROAD_GREEN[1] }}
            />
          </Path>
        </Canvas>

        <View
          className="absolute rounded-full px-2.5 py-1"
          style={{
            backgroundColor: ACH.text,
            left: START_COL * tile,
            top: (START_ROW - ROAD_HALF) * tile,
            transform: [{ translateX: "-50%" }, { translateY: "-50%" }],
          }}
        >
          <Text className="text-[10px] text-white" style={{ fontFamily: Pixelify.bold, letterSpacing: 0.5 }}>
            {t("achievements.path.start")}
          </Text>
        </View>

        {UNLOCK_ROUTE.milestones.map((m, i) => {
          const item = ITEMS[i];
          const name = t(`achievements.items.${item.id}`);
          const xpText = formatXp(item.unlockXp, locale);
          const state: MilestoneState =
            i < unlockedCount ? "done" : i === unlockedCount ? "next" : "locked";
          const x = m.col * tile;
          const y = m.row * tile;
          const onLeft = m.col < START_COL;
          const preview = PREVIEW_CELLS[item.id];
          const labelGap = BADGE / 2 + 8;

          return (
            <Fragment key={item.id}>
              <View
                className="absolute"
                style={[{ top: y - previewSize / 2 }, onLeft ? { left: 0 } : { right: 0 }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View
                  className="items-center justify-center overflow-hidden bg-white"
                  style={{
                    width: previewSize,
                    height: previewSize,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: ACH.border,
                  }}
                >
                  <SpritePreview
                    image={preview.sheet === "poses1" ? sheets.poses1 : sheets.poses2}
                    row={preview.row}
                    frame={previewFrame}
                    size={previewSize - 3}
                  />
                </View>
                <View
                  className="absolute -bottom-2 self-center rounded-full px-2 py-0.5"
                  style={
                    state === "done"
                      ? { backgroundColor: ACH.green }
                      : { backgroundColor: "#ffffff", borderWidth: 1, borderColor: ACH.border }
                  }
                >
                  <Text
                    className="text-[9px] uppercase"
                    style={{
                      fontFamily: Pixelify.bold,
                      letterSpacing: 0.5,
                      color: state === "done" ? "#ffffff" : ACH.textSecondary,
                    }}
                  >
                    {state === "done" ? t("achievements.path.unlocked") : t("achievements.path.preview")}
                  </Text>
                </View>
              </View>

              <View
                className="absolute justify-center"
                style={[
                  { top: y - 30, height: 60 },
                  onLeft
                    ? { left: x + labelGap, maxWidth: roadWidth - x - labelGap, alignItems: "flex-start" }
                    : { right: roadWidth - x + labelGap, maxWidth: x - labelGap, alignItems: "flex-end" },
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View className="rounded-md px-1 py-0.5" style={{ backgroundColor: ACH.card }}>
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: Pixelify.bold, color: ACH.text, textAlign: onLeft ? "left" : "right" }}
                  >
                    {t("achievements.path.earn", { xp: xpText })}
                  </Text>
                  <Text
                    className="text-[11px]"
                    style={{
                      fontFamily: Pixelify.medium,
                      color: state === "done" ? ACH.green : ACH.textSecondary,
                      textAlign: onLeft ? "left" : "right",
                    }}
                  >
                    {name}
                  </Text>
                </View>
              </View>

              <View
                className="absolute"
                style={{ left: x - BADGE / 2, top: y - BADGE / 2, width: BADGE, height: BADGE }}
                accessible
                accessibilityLabel={
                  state === "done"
                    ? t("achievements.a11y.milestoneUnlocked", { item: name, xp: xpText })
                    : t("achievements.a11y.milestoneLocked", { item: name, xp: xpText })
                }
              >
                {state === "next" ? (
                  <Animated.View
                    className="absolute inset-0 rounded-full"
                    style={[{ borderWidth: 3, borderColor: ACH.gold }, pulseStyle]}
                  />
                ) : null}
                <View
                  className="flex-1 items-center justify-center rounded-full"
                  style={{
                    borderWidth: 3,
                    borderColor:
                      state === "done" ? ACH.green : state === "next" ? ACH.gold : "#dcdae3",
                    backgroundColor: state === "locked" ? ACH.lockedBadge : "#ffffff",
                  }}
                >
                  <SpriteIcon
                    image={sheets.icons}
                    cell={state === "done" ? ICON_CELLS[item.id].unlocked : ICON_CELLS[item.id].locked}
                    width={34}
                    opacity={state === "locked" ? 0.45 : 1}
                  />
                </View>
                <View
                  className="absolute -bottom-0.5 -right-0.5 size-[18px] items-center justify-center rounded-full"
                  style={
                    state === "done"
                      ? { backgroundColor: ACH.green, borderWidth: 2, borderColor: "#ffffff" }
                      : { backgroundColor: "#ffffff", borderWidth: 1, borderColor: ACH.border }
                  }
                >
                  <Ionicons
                    name={state === "done" ? "checkmark" : "lock-closed"}
                    size={state === "done" ? 11 : 9}
                    color={state === "done" ? "#ffffff" : ACH.textSecondary}
                  />
                </View>
              </View>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}
