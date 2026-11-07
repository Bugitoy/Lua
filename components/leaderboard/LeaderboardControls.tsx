import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { DropdownMenu } from "@/components/stats/DropdownMenu";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import {
  LEADERBOARD_PERIODS,
  LEADERBOARD_SORT_KEYS,
  type LeaderboardPeriod,
  type LeaderboardSortKey,
} from "@/lib/leaderboard";

const SORT_ACCENT: Record<LeaderboardSortKey, string> = {
  goals: LUA_GREEN,
  distance: "#3b82f6",
  study: "#8b5cf6",
};

type LeaderboardControlsProps = {
  period: LeaderboardPeriod;
  onPeriodChange: (period: LeaderboardPeriod) => void;
  sort: LeaderboardSortKey;
  onSortChange: (sort: LeaderboardSortKey) => void;
};

/** "LEADERBOARD · [TODAY ▾]" and the Goals / Distance / Work buttons, on Stats and the full leaderboard. */
export function LeaderboardControls({ period, onPeriodChange, sort, onSortChange }: LeaderboardControlsProps) {
  const { t } = useTranslation();
  const periodLabel = (p: LeaderboardPeriod) => t(`stats.periods.${p}`);

  return (
    <View>
      <View className="mb-4 ml-1 flex-row items-center gap-2">
        <Text className="text-xs uppercase tracking-widest text-neutral-400" style={{ fontFamily: Pixelify.semibold }}>
          {t("stats.leaderboard.title")}
        </Text>
        <DropdownMenu
          value={period}
          options={LEADERBOARD_PERIODS.map((p) => ({ value: p, label: periodLabel(p) }))}
          onChange={onPeriodChange}
          renderTrigger={(open) => (
            <View
              className="flex-row items-center gap-1.5 rounded-lg bg-white px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: "#e5e5e5" }}
            >
              <Text className="text-xs uppercase tracking-widest" style={{ fontFamily: Pixelify.bold, color: LUA_GREEN }}>
                {periodLabel(period)}
              </Text>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color={LUA_GREEN} />
            </View>
          )}
        />
      </View>

      <View className="mb-3 flex-row gap-2">
        {LEADERBOARD_SORT_KEYS.map((key) => {
          const active = key === sort;
          const accent = SORT_ACCENT[key];
          return (
            <Pressable
              key={key}
              onPress={() => onSortChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: active ? "#ffffff" : "transparent",
                borderWidth: 1.5,
                borderColor: active ? accent : "transparent",
              }}
            >
              <Text
                style={{
                  fontFamily: active ? Pixelify.bold : Pixelify.medium,
                  fontSize: 13,
                  color: active ? accent : "#737373",
                }}
              >
                {t(`stats.metrics.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
