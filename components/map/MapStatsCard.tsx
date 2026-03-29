import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

type MapStatsCardProps = {
  goalsDone: number;
  goalsTotal: number;
  goalDayPercent: number;
  distanceMiles: number;
  bottomInset: number;
};

export function MapStatsCard({
  goalsDone,
  goalsTotal,
  goalDayPercent,
  distanceMiles,
  bottomInset,
}: MapStatsCardProps) {
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
        bottom: (Platform.OS === "ios" ? 92 : 25) + bottomInset,
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
        <View className="flex-row items-start gap-1.5">
          <Ionicons name="flag-outline" size={18} color={LUA_GREEN} />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-xs text-neutral-800"
                  style={{ fontFamily: Pixelify.semibold }}
                >
                  Goals Completed
                </Text>
                <Text
                  className="mt-0.5 text-[11px] text-neutral-500"
                  style={{ fontFamily: Pixelify.semibold }}
                >
                  {goalDayPercent}% day
                </Text>
              </View>
              <Text
                className="text-base text-neutral-900"
                style={{ fontFamily: Pixelify.bold }}
              >
                {goalsDone}/{goalsTotal}
              </Text>
            </View>
            <View className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200">
              <View
                className="h-full rounded-full"
                style={{
                  width: "50%",
                  backgroundColor: LUA_GREEN,
                }}
              />
            </View>
          </View>
        </View>

        <View className="mt-2.5 flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
            <Ionicons name="footsteps" size={18} color={LUA_GREEN} />
            <Text
              className="shrink text-xs text-neutral-800"
              style={{ fontFamily: Pixelify.semibold }}
            >
              Distance Walked
            </Text>
          </View>
          <Text
            className="text-base text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            {distanceMiles} miles
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
            Check Health
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
