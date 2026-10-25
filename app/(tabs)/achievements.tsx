import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { CostumeShopSheet } from "@/components/achievements/CostumeShopSheet";
import { DevXpControls } from "@/components/achievements/DevXpControls";
import { LuaAvatarStage, type LuaAvatarHandle } from "@/components/achievements/LuaAvatarStage";
import { ShopButton } from "@/components/achievements/ShopButton";
import { useAchievementSheets } from "@/components/achievements/spriteSheets";
import { ACH, formatXp, thousandsSeparator } from "@/components/achievements/theme";
import { lastUnlockedXp, nextStopXp, unlockedCountForXp } from "@/components/achievements/unlockRoute";
import { UnlockPath } from "@/components/achievements/UnlockPath";
import { Wardrobe } from "@/components/achievements/Wardrobe";
import { XpBar } from "@/components/achievements/XpBar";
import { Pixelify } from "@/constants/fonts";
import {
  ITEMS,
  PALETTE_SKINS,
  REWARDS,
  rewardI18nKey,
  type CostumeId,
  type ItemId,
  type PaletteSkinId,
} from "@/constants/luaSprites";
import { useIsOnScreen } from "@/hooks/useIsOnScreen";
import {
  acquireCostume,
  getSeenXp,
  markShopOpened,
  setSeenXp,
  takeOffCostume,
  takeOffItem,
  useAchievements,
  useSkin,
  wearCostume,
  wearItems,
  type Equipped,
} from "@/lib/achievementsStore";
import { getAppLocale } from "@/lib/i18n/formatLocale";
import { useStatsXp } from "@/lib/xp";

const MAX_COLUMN_WIDTH = 430;
const SIDE_MARGIN = 16;
const COUNT_UP = { duration: 1100, easing: Easing.out(Easing.cubic) };
/** How far the white and bright-green tile flashes trail the counting XP. */
const FLASH_WHITE_MS = 140;
const FLASH_GREEN_MS = 420;
const UNLOCK_GAP_MS = 1000;
const SHOW_DEV_XP_CONTROLS = __DEV__ || process.env.EXPO_PUBLIC_DEV_XP_CONTROLS === "1";

function ownedOnly(equipped: Equipped, unlockedCount: number): Equipped {
  const cap = lastUnlockedXp(unlockedCount);
  const owned: Equipped = {};
  ITEMS.forEach((item) => {
    if (item.unlockXp <= cap && equipped[item.slot] === item.id) owned[item.slot] = item.id;
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

  const { equipped, hydrated, devXpBonus, skin, costume, ownedCostumes, shopOpened } =
    useAchievements();
  const sheets = useAchievementSheets();
  const statsXp = useStatsXp();
  const xp = Math.max(0, statsXp + devXpBonus);
  const targetCount = unlockedCountForXp(xp);

  /** Rewards whose unlock has played; trails `targetCount` while unlocks are queued. */
  const [unlockedCount, setUnlockedCount] = useState(targetCount);
  /** False until saved outfit is loaded, so the avatar mounts already dressed. */
  const [ready, setReady] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

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
    // Rewards earned since the screen last showed XP go straight on, without the unlock show.
    const seen = getSeenXp();
    const newly = REWARDS.filter((reward) => reward.xp > seen && reward.xp <= xp);
    wearItems(newly.flatMap((reward) => (reward.kind === "item" ? [reward.id] : [])));
    const lastSkin = [...newly].reverse().find((reward) => reward.kind === "skin");
    if (lastSkin && lastSkin.kind === "skin") useSkin(lastSkin.id);
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
    const reward = REWARDS[index];
    setUnlockedCount((count) => Math.max(count, index + 1));
    const name = t(rewardI18nKey(reward));
    if (reward.kind === "item") {
      avatar.current?.celebrateItem(reward.id, t("achievements.toast.unlocked", { item: name }));
      wearItems([reward.id]);
    } else {
      useSkin(reward.id);
      avatar.current?.celebrateLook(
        { type: "skin", id: reward.id },
        t("achievements.toast.unlocked", { item: name }),
      );
    }
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

  // A reward unlocks the moment the counting XP passes its threshold.
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

  // Stable between renders so the memoized avatar stage and wardrobe can skip re-rendering.
  const worn = useMemo(() => ownedOnly(equipped, unlockedCount), [equipped, unlockedCount]);
  const unlockedXp = lastUnlockedXp(unlockedCount);

  const onPressItem = useCallback((id: ItemId) => {
    const item = ITEMS.find((entry) => entry.id === id)!;
    if (item.unlockXp > unlockedXp) {
      avatar.current?.showToast(
        { type: "item", id, locked: true },
        t("achievements.toast.earnToUnlock", { xp: formatXp(item.unlockXp, locale) }),
      );
      return;
    }
    if (worn[item.slot] === id) {
      if (costume) takeOffCostume();
      else takeOffItem(id);
      return;
    }
    wearItems([id]);
  }, [worn, unlockedXp, costume, locale, t]);

  const onPressSkin = useCallback((id: PaletteSkinId) => {
    const palette = PALETTE_SKINS.find((entry) => entry.id === id)!;
    if (palette.unlockXp > unlockedXp) {
      avatar.current?.showToast(
        { type: "skin", id, locked: true },
        t("achievements.toast.earnToUnlock", { xp: formatXp(palette.unlockXp, locale) }),
      );
      return;
    }
    if (!costume && skin === id) return;
    useSkin(id);
    avatar.current?.celebrateLook(
      { type: "skin", id },
      t("achievements.toast.skinOn", { name: t(`achievements.skins.${id}`) }),
    );
  }, [unlockedXp, costume, skin, locale, t]);

  const onPressCostume = useCallback((id: CostumeId) => {
    if (costume === id) return;
    wearCostume(id);
    avatar.current?.celebrateLook(
      { type: "costume", id },
      t("achievements.toast.skinOn", { name: t(`achievements.costumes.${id}`) }),
    );
  }, [costume, t]);

  const openShop = () => {
    markShopOpened();
    setShopOpen(true);
  };

  const onBuyCostume = (id: CostumeId) => {
    acquireCostume(id);
    setShopOpen(false);
    avatar.current?.celebrateLook(
      { type: "costume", id },
      t("achievements.toast.skinOn", { name: t(`achievements.costumes.${id}`) }),
    );
  };

  const onUseCostume = (id: CostumeId) => {
    wearCostume(id);
    setShopOpen(false);
    avatar.current?.celebrateLook(
      { type: "costume", id },
      t("achievements.toast.skinOn", { name: t(`achievements.costumes.${id}`) }),
    );
  };

  const wornNames = ITEMS.filter((item) => worn[item.slot] === item.id).map((item) =>
    t(`achievements.items.${item.id}`),
  );
  const headline =
    unlockedCount === 0
      ? t("achievements.headline.none")
      : unlockedCount === REWARDS.length
        ? t("achievements.headline.all")
        : t("achievements.headline.some");
  const nextReward = REWARDS[targetCount];
  const [amountPrefix = "", amountSuffix = ""] = t("achievements.xpAmount", {
    xp: "\u0001",
  }).split("\u0001");

  const avatarLabel = costume
    ? t("achievements.a11y.avatarCostume", { name: t(`achievements.costumes.${costume}`) })
    : wornNames.length > 0
      ? t("achievements.a11y.avatarWearing", { items: wornNames.join(", ") })
      : t("achievements.a11y.avatar");

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
          <View className="mb-4 h-[38px] justify-center">
            <Text
              className="text-center text-lg"
              style={{ fontFamily: Pixelify.semibold, color: ACH.text }}
            >
              {t("achievements.title")}
            </Text>
            <View className="absolute right-0 top-0">
              <ShopButton
                showNew={!shopOpened}
                reduceMotion={reduceMotion}
                onPress={openShop}
                label={t("achievements.shop.button")}
                newLabel={t("achievements.shop.new")}
                accessibilityLabel={t("achievements.a11y.shop")}
                accessibilityHint={t("achievements.a11y.shopHint")}
              />
            </View>
          </View>

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
              skin={skin}
              equipped={worn}
              costume={costume}
              active={active}
              reduceMotion={reduceMotion}
              accessibilityLabel={avatarLabel}
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
            {nextReward ? (
              <Trans
                i18nKey="achievements.nextUnlock"
                values={{
                  xp: formatXp(nextReward.xp - xp, locale),
                  item: t(rewardI18nKey(nextReward)),
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
            iconsLocked={sheets.iconsLocked}
            skinIcons={sheets.skinIcons}
            costumeStills={sheets.costumeStills}
            unlockedCount={unlockedCount}
            equipped={worn}
            skin={skin}
            costume={costume}
            ownedCostumes={ownedCostumes}
            onPressItem={onPressItem}
            onPressSkin={onPressSkin}
            onPressCostume={onPressCostume}
          />

          <UnlockPath
            width={columnWidth}
            sheets={sheets}
            skin={skin}
            unlockedCount={unlockedCount}
            xp={xpCounter}
            xpFlashWhite={xpFlashWhite}
            xpFlashGreen={xpFlashGreen}
            active={active}
            reduceMotion={reduceMotion}
          />

          {SHOW_DEV_XP_CONTROLS ? <DevXpControls statsXp={statsXp} devXpBonus={devXpBonus} /> : null}
        </View>
      </ScrollView>

      <CostumeShopSheet
        visible={shopOpen}
        costumeStills={sheets.costumeStills}
        ownedCostumes={ownedCostumes}
        using={costume}
        onClose={() => setShopOpen(false)}
        onBuy={onBuyCostume}
        onUse={onUseCostume}
      />
    </View>
  );
}
