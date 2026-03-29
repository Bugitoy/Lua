import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HealthStatusSprite } from "@/components/health/HealthStatusSprite";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useGameStats } from "@/lib/gameStats";
import { formatHours } from "@/lib/formatters";

function StatRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between border-b border-neutral-100 py-3.5">
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={22} color="#525252" />
        <Text
          className="text-base text-neutral-700"
          style={{ fontFamily: Pixelify.medium }}
        >
          {label}
        </Text>
      </View>
      <Text
        className="text-base text-neutral-900"
        style={{ fontFamily: Pixelify.bold }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function HealthStatusScreen() {
  const insets = useSafeAreaInsets();
  const { stats } = useGameStats();

  const { healthRatio, goalsDone, goalsTotal, distanceMiles, hoursStudied, goalStreak } =
    stats;

  const healthPercent = Math.round(healthRatio * 100);
  const isDead = healthRatio <= 0.001 || goalsDone === 0;

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="mb-5 text-center text-lg text-neutral-800"
          style={{ fontFamily: Pixelify.semibold }}
        >
          Health Bar
        </Text>

        <View className="mb-[-14rem] px-1">
          <View className="h-8 overflow-hidden rounded-full bg-neutral-200">
            <View className="absolute bottom-2 left-3 top-2 z-10 justify-center">
              <Text
                className="text-sm text-neutral-800"
                style={{ fontFamily: Pixelify.bold }}
              >
                {healthPercent}
              </Text>
            </View>
            {healthRatio > 0 ? (
              <LinearGradient
                colors={[LUA_GREEN, "#eab308"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  height: "100%",
                  width: `${healthRatio * 100}%`,
                  borderRadius: 999,
                }}
              />
            ) : null}
          </View>
        </View>

        <View className="mb-2 items-center">
          <HealthStatusSprite healthRatio={healthRatio} />
        </View>

        {isDead ? (
          <>
            <Text
              className="mb-3 text-center text-3xl uppercase text-neutral-900"
              style={{ fontFamily: Pixelify.bold, letterSpacing: 0.5 }}
            >
              LUA HAS DIED
            </Text>
            <Text
              className="mb-5 text-center text-base leading-relaxed text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              Zero goals completed today. Let&apos;s try again tomorrow.
            </Text>
          </>
        ) : (
          <>
            <Text
              className="mb-3 text-center text-2xl text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              Lua is healthy
            </Text>
            <Text
              className="mb-5 text-center text-base leading-relaxed text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              {goalsDone} of {goalsTotal} goals done today. Keep it up!
            </Text>
          </>
        )}

        <View
          className="relative mb-3 overflow-hidden rounded-2xl px-4"
          style={{
            backgroundColor: "#f5f5f5",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="pt-1">
            <StatRow
              icon="flag-outline"
              label="Goals Completed Today"
              value={`${goalsDone} / ${goalsTotal}`}
            />
            <StatRow
              icon="flame-outline"
              label="Goal Completion Streak"
              value={`${goalStreak} day${goalStreak === 1 ? "" : "s"}`}
            />
            <StatRow
              icon="footsteps"
              label="Distance Walked"
              value={`${distanceMiles} miles`}
            />
            <StatRow
              icon="book-outline"
              label="Hours Studied"
              value={formatHours(hoursStudied)}
            />
          </View>
        </View>

        <Pressable
          onPress={() => router.back()}
          className="mb-3 items-center rounded-xl py-4 active:opacity-90"
          style={{ backgroundColor: LUA_GREEN }}
        >
          <Text
            className="text-base uppercase text-white"
            style={{ fontFamily: Pixelify.bold, letterSpacing: 0.5 }}
          >
            Back
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/stats")}
          className="items-center rounded-xl border border-neutral-200 bg-neutral-50 py-4 active:opacity-90"
        >
          <Text
            className="text-base text-neutral-700"
            style={{ fontFamily: Pixelify.medium }}
          >
            View last session stats
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
