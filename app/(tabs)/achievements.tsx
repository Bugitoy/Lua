import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DevXpControls } from "@/components/achievements/DevXpControls";
import { LuaAvatarStage, type LuaAvatarHandle } from "@/components/achievements/LuaAvatarStage";
import { useAchievementSheets } from "@/components/achievements/spriteSheets";
import { ACH, formatXp, thousandsSeparator } from "@/components/achievements/theme";
import { nextStopXp, unlockedCountForXp } from "@/components/achievements/unlockRoute";
import { UnlockPath } from "@/components/achievements/UnlockPath";
import { Wardrobe } from "@/components/achievements/Wardrobe";
import { XpBar } from "@/components/achievements/XpBar";
import { Pixelify } from "@/constants/fonts";
import { ITEMS, type ItemId } from "@/constants/luaSprites";
import { useIsOnScreen } from "@/hooks/useIsOnScreen";
import {
  getSeenXp,
  setSeenXp,
  takeOffItem,
  useAchievements,
  wearItems,
  type Equipped,
} from "@/lib/achievementsStore";
import { useGameStats } from "@/lib/gameStats";
import { getAppLocale } from "@/lib/i18n/formatLocale";
import { xpForStats } from "@/lib/xp";

const MAX_COLUMN_WIDTH = 430;
const SIDE_MARGIN = 16;
const COUNT_UP = { duration: 1100, easing: Easing.out(Easing.cubic) };
/** How far the white and bright-green tile flashes trail the counting XP. */
const FLASH_WHITE_MS = 140;
const FLASH_GREEN_MS = 420;
const UNLOCK_GAP_MS = 1000;

function ownedOnly(equipped: Equipped, unlockedCount: number): Equipped {
  const owned: Equipped = {};
  ITEMS.forEach((item, i) => {
    if (i < unlockedCount && equipped[item.slot] === item.id) owned[item.slot] = item.id;
  });
  return owned;
}

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const columnWidth = Math.min(windowWidth - 2 * SIDE_MARGIN, MAX_COLUMN_WIDTH);
  const locale = getAppLocale();
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const onScreen = useIsOnScreen();
  const active = isFocused && onScreen;

  const sheets = useAchievementSheets();
  const { stats } = useGameStats();
  const { equipped, hydrated, devXpBonus } = useAchievements();
  const statsXp = Math.floor(xpForStats(stats));
  const xp = Math.max(0, statsXp + devXpBonus);
  const targetCount = unlockedCountForXp(xp);

  /** Items whose unlock has played; trails `targetCount` while unlocks are queued. */
  const [unlockedCount, setUnlockedCount] = useState(targetCount);
  /** False until saved outfit is loaded, so the avatar mounts already dressed. */
  const [ready, setReady] = useState(false);

  const xpCounter = useSharedValue(xp);
  const xpFlashWhite = useSharedValue(xp);
  const xpFlashGreen = useSharedValue(xp);
  const shownXp = useRef(xp);
  const reachedCount = useRef(targetCount);
  const unlockQueue = useRef<number[]>([]);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatar = useRef<LuaAvatarHandle>(null);

  useEffect(() => {
    if (!hydrated || ready) return;
    // Items earned since the screen last showed XP go straight on, without the unlock show.
    const seen = getSeenXp();
    wearItems(
      ITEMS.filter((item) => item.unlockXp > seen && item.unlockXp <= xp).map((item) => item.id),
    );
    setSeenXp(xp);
    setReady(true);
  }, [hydrated, ready, xp]);

  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );

  const playNextUnlock = () => {
    if (unlockTimer.current) return;
    const index = unlockQueue.current.shift();
    if (index === undefined) return;
    const item = ITEMS[index];
    setUnlockedCount((count) => Math.max(count, index + 1));
    avatar.current?.celebrate(
      item.id,
      t("achievements.toast.unlocked", { item: t(`achievements.items.${item.id}`) }),
    );
    wearItems([item.id]);
    unlockTimer.current = setTimeout(() => {
      unlockTimer.current = null;
      playNextUnlock();
    }, UNLOCK_GAP_MS);
  };

  const onCountReached = (count: number) => {
    for (let i = reachedCount.current; i < count; i++) unlockQueue.current.push(i);
    reachedCount.current = Math.max(reachedCount.current, count);
    playNextUnlock();
  };

  // An item unlocks the moment the counting XP passes its threshold.
  useAnimatedReaction(
    () => unlockedCountForXp(xpCounter.value),
    (count, previous) => {
      if (previous !== null && count > previous) runOnJS(onCountReached)(count);
    },
  );

  useEffect(() => {
    if (!ready || !active || xp === shownXp.current) return;
    const from = shownXp.current;
    shownXp.current = xp;
    setSeenXp(xp);

    if (xp < from) {
      // XP went down (a new day, or the dev reset): jump to the new state, no count-down.
      cancelAnimation(xpCounter);
      cancelAnimation(xpFlashWhite);
      cancelAnimation(xpFlashGreen);
      xpCounter.value = xp;
      xpFlashWhite.value = xp;
      xpFlashGreen.value = xp;
      const count = unlockedCountForXp(xp);
      unlockQueue.current = unlockQueue.current.filter((i) => i < count);
      reachedCount.current = count;
      setUnlockedCount((current) => Math.min(current, count));
      return;
    }

    xpCounter.value = withTiming(xp, COUNT_UP);
    xpFlashWhite.value = reduceMotion
      ? withTiming(xp, COUNT_UP)
      : withDelay(FLASH_WHITE_MS, withTiming(xp, COUNT_UP));
    xpFlashGreen.value = reduceMotion
      ? withTiming(xp, COUNT_UP)
      : withDelay(FLASH_GREEN_MS, withTiming(xp, COUNT_UP));
  }, [xp, ready, active, reduceMotion, xpCounter, xpFlashWhite, xpFlashGreen]);

  const worn = ownedOnly(equipped, unlockedCount);

  const onPressItem = (id: ItemId) => {
    const index = ITEMS.findIndex((item) => item.id === id);
    const item = ITEMS[index];
    if (index >= unlockedCount) {
      avatar.current?.showToast(
        id,
        t("achievements.toast.earnToUnlock", { xp: formatXp(item.unlockXp, locale) }),
        true,
      );
      return;
    }
    if (worn[item.slot] === id) takeOffItem(id);
    else wearItems([id]);
  };

  const wornNames = ITEMS.filter((item) => worn[item.slot] === item.id).map((item) =>
    t(`achievements.items.${item.id}`),
  );
  const headline =
    unlockedCount === 0
      ? t("achievements.headline.none")
      : unlockedCount === ITEMS.length
        ? t("achievements.headline.all")
        : t("achievements.headline.some");
  const nextItem = ITEMS[targetCount];
  const [amountPrefix = "", amountSuffix = ""] = t("achievements.xpAmount", {
    xp: "\u0001",
  }).split("\u0001");

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 32,
          paddingHorizontal: SIDE_MARGIN,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: columnWidth }}>
          <Text
            className="mb-4 text-center text-lg"
            style={{ fontFamily: Pixelify.semibold, color: ACH.text }}
          >
            {t("achievements.title")}
          </Text>

          <XpBar
            width={columnWidth}
            xp={xpCounter}
            separator={thousandsSeparator(locale)}
            amountPrefix={amountPrefix}
            amountSuffix={amountSuffix}
            accessibilityLabel={t("achievements.xpBarLabel", {
              xp: formatXp(xp, locale),
              next: formatXp(nextStopXp(xp), locale),
            })}
          />

          {ready ? (
            <LuaAvatarStage
              ref={avatar}
              width={columnWidth}
              sheets={sheets}
              equipped={worn}
              active={active}
              reduceMotion={reduceMotion}
              accessibilityLabel={
                wornNames.length > 0
                  ? t("achievements.a11y.avatarWearing", { items: wornNames.join(", ") })
                  : t("achievements.a11y.avatar")
              }
              accessibilityHint={t("achievements.a11y.avatarHint")}
            />
          ) : (
            <View style={{ height: Math.round(columnWidth * 0.92) }} />
          )}

          <Text
            className="mb-2 text-center text-2xl"
            style={{ fontFamily: Pixelify.bold, color: ACH.text }}
          >
            {headline}
          </Text>
          <Text
            className="mb-5 text-center text-sm leading-relaxed"
            style={{ fontFamily: Pixelify.regular, color: ACH.textSecondary }}
          >
            {nextItem ? (
              <Trans
                i18nKey="achievements.nextUnlock"
                values={{
                  xp: formatXp(nextItem.unlockXp - xp, locale),
                  item: t(`achievements.items.${nextItem.id}`),
                }}
                components={{
                  bold: <Text style={{ fontFamily: Pixelify.bold, color: ACH.text }} />,
                }}
              />
            ) : (
              t("achievements.allUnlocked")
            )}
          </Text>

          <Wardrobe
            width={columnWidth}
            icons={sheets.icons}
            unlockedCount={unlockedCount}
            equipped={worn}
            onPressItem={onPressItem}
          />

          <UnlockPath
            width={columnWidth}
            sheets={sheets}
            unlockedCount={unlockedCount}
            xp={xpCounter}
            xpFlashWhite={xpFlashWhite}
            xpFlashGreen={xpFlashGreen}
            active={active}
            reduceMotion={reduceMotion}
          />

          {__DEV__ ? <DevXpControls statsXp={statsXp} devXpBonus={devXpBonus} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
