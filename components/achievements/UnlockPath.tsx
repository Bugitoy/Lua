import { Ionicons } from "@expo/vector-icons";
import { Canvas, createPicture, Path, Picture, Shader, Skia } from "@shopify/react-native-skia";
import { Fragment, memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PixelRatio, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { drawPreviews, makePreviewModel, MAX_FRAME_STEP_S } from "@/components/achievements/previewArt";
import { SKIN_ICON_CROP, SpriteIcon } from "@/components/achievements/SpriteCell";
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
import {
  ICON_CELLS,
  REWARDS,
  SKIN_ICON_CELLS,
  rewardI18nKey,
  rewardKey,
  type PaletteSkinId,
} from "@/constants/luaSprites";
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
const PREVIEW_BORDER = 1.5;
const PULSE_MS = 1800;

type MilestoneState = "done" | "next" | "locked";

type UnlockPathProps = {
  width: number;
  sheets: AchievementSheets;
  /** Palette skin in use; item previews are drawn in it. */
  skin: PaletteSkinId;
  unlockedCount: number;
  /** Counting-up XP, and the same count 140 ms and 420 ms behind it for the tile flash. */
  xp: SharedValue<number>;
  xpFlashWhite: SharedValue<number>;
  xpFlashGreen: SharedValue<number>;
  active: boolean;
  reduceMotion: boolean;
};

function UnlockPathImpl({
  width,
  sheets,
  skin,
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

  // Each preview is drawn live from its own pose function, all into one canvas, so the whole
  // column costs one redraw per frame. Item previews share the skin in use.
  const dpr = PixelRatio.get();
  const previewModels = useMemo(() => {
    const inner = previewSize - 2 * PREVIEW_BORDER;
    return UNLOCK_ROUTE.milestones.map((m, i) => {
      const left = (m.col < START_COL ? 0 : roadWidth - previewSize) + PREVIEW_BORDER;
      const top = m.row * tile - previewSize / 2 + PREVIEW_BORDER;
      return makePreviewModel(REWARDS[i], skin, left, top, inner, dpr);
    });
  }, [previewSize, roadWidth, tile, skin, dpr]);

  /** Seconds of preview animation, advanced only while the screen is showing. */
  const previewTime = useSharedValue(0);
  const previewClock = useFrameCallback((info) => {
    "worklet";
    const dt = (info.timeSincePreviousFrame ?? 0) / 1000;
    previewTime.value += Math.min(MAX_FRAME_STEP_S, dt);
  }, false);
  const previewPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => drawPreviews(canvas, previewModels, previewTime.value, reduceMotion, dpr),
      { width: roadWidth, height: roadHeight },
    ),
  );

  const pulse = useSharedValue(0);

  useEffect(() => {
    previewClock.setActive(active && !reduceMotion);
  }, [active, reduceMotion, previewClock]);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [active, reduceMotion, pulse]);

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
          {t("achievements.path.count", { done: unlockedCount, total: REWARDS.length })}
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

        {UNLOCK_ROUTE.milestones.map((m, i) => (
          <View
            key={rewardKey(REWARDS[i])}
            className="absolute"
            style={[
              {
                top: m.row * tile - previewSize / 2,
                width: previewSize,
                height: previewSize,
                borderRadius: 14,
                borderWidth: PREVIEW_BORDER,
                borderColor: ACH.border,
                backgroundColor: "#ffffff",
              },
              m.col < START_COL ? { left: 0 } : { right: 0 },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ))}

        <Canvas
          style={{ position: "absolute", left: 0, top: 0, width: roadWidth, height: roadHeight }}
          pointerEvents="none"
        >
          <Picture picture={previewPicture} />
        </Canvas>

        {UNLOCK_ROUTE.milestones.map((m, i) => {
          const reward = REWARDS[i];
          const name = t(rewardI18nKey(reward));
          const xpText = formatXp(reward.xp, locale);
          const state: MilestoneState =
            i < unlockedCount ? "done" : i === unlockedCount ? "next" : "locked";
          const x = m.col * tile;
          const y = m.row * tile;
          const onLeft = m.col < START_COL;
          const labelGap = BADGE / 2 + 8;

          return (
            <Fragment key={rewardKey(reward)}>
              <View
                className="absolute"
                style={[
                  { top: y - previewSize / 2, width: previewSize, height: previewSize },
                  onLeft ? { left: 0 } : { right: 0 },
                ]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
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
                  {reward.kind === "item" ? (
                    <SpriteIcon
                      image={state === "done" ? sheets.icons : sheets.iconsLocked}
                      cell={ICON_CELLS[reward.id]}
                      width={34}
                      opacity={state === "locked" ? 0.45 : 1}
                    />
                  ) : (
                    <SpriteIcon
                      image={sheets.skinIcons}
                      cell={
                        state === "done"
                          ? SKIN_ICON_CELLS[reward.id].unlocked
                          : SKIN_ICON_CELLS[reward.id].locked
                      }
                      width={34}
                      opacity={state === "locked" ? 0.45 : 1}
                      crop={SKIN_ICON_CROP}
                    />
                  )}
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

/** 34 canvases: skip re-rendering them when the screen re-renders for unrelated state. */
export const UnlockPath = memo(UnlockPathImpl);
