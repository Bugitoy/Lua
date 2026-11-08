import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { formatXp } from "@/components/achievements/theme";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { getAppLocale } from "@/lib/i18n/formatLocale";
import { DAILY_STEP_GOAL } from "@/lib/walkingRules";

type MapStatsCardProps = {
  goalsDone: number;
  goalsTotal: number;
  distanceMiles: number;
  stepsToday: number;
  bottomInset: number;
};

export function MapStatsCard({
  goalsDone,
  goalsTotal,
  distanceMiles,
  stepsToday,
  bottomInset,
}: MapStatsCardProps) {
  const { t } = useTranslation();
  const openHealthStatus = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/health-status");
  }, []);

  return (
    <View
      className="absolute z-10"
      pointerEvents="auto"
      style={{
        right: 12,
        // Level with the live tracking box on the left (app/(tabs)/index.tsx),
        // which is sized to stay clear of this column.
        bottom: 24 + bottomInset,
        maxWidth: 180,
        width: "58%",
      }}
    >
      <View
        className="rounded-xl bg-white p-3"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
            <Ionicons name="flag-outline" size={18} color={LUA_GREEN} />
            <Text
              className="shrink text-xs text-neutral-800"
              style={{ fontFamily: Pixelify.semibold }}
            >
              {t("map.statsCard.goalsCompleted")}
            </Text>
          </View>
          <Text
            className="text-base text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("map.statsCard.goalsRatio", {
              done: goalsDone,
              total: goalsTotal,
            })}
          </Text>
        </View>

        <View className="mt-2.5 flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
            <Ionicons name="walk-outline" size={18} color={LUA_GREEN} />
            <Text
              className="shrink text-xs text-neutral-800"
              style={{ fontFamily: Pixelify.semibold }}
            >
              {t("map.statsCard.stepsToday")}
            </Text>
          </View>
          <Text
            className="text-base text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("map.statsCard.stepsRatio", {
              steps: formatXp(stepsToday, getAppLocale()),
              goal: formatXp(DAILY_STEP_GOAL, getAppLocale()),
            })}
          </Text>
        </View>

        <View className="mt-2.5 flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
            <Ionicons name="footsteps" size={18} color={LUA_GREEN} />
            <Text
              className="shrink text-xs text-neutral-800"
              style={{ fontFamily: Pixelify.semibold }}
            >
              {t("map.statsCard.distanceWalked")}
            </Text>
          </View>
          <Text
            className="text-base text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("map.statsCard.distanceMiles", { distance: distanceMiles })}
          </Text>
        </View>

        <Pressable
          onPress={openHealthStatus}
          className="mt-2.5 items-center rounded-lg py-2 active:opacity-90"
          style={{ backgroundColor: LUA_GREEN }}
        >
          <Text
            className="text-xs text-white"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("map.statsCard.checkHealth")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
