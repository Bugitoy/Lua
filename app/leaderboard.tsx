import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LeaderboardControls } from "@/components/leaderboard/LeaderboardControls";
import { LeaderRow, MyLeaderRow } from "@/components/leaderboard/LeaderRow";
import { Pixelify } from "@/constants/fonts";
import {
  LEADERBOARD_SIZE,
  isLeaderboardPeriod,
  isLeaderboardSortKey,
  rankLeaderboard,
  useLeaderValue,
  useMyLeaderEntry,
  type LeaderboardPeriod,
  type LeaderboardSortKey,
} from "@/lib/leaderboard";

type Row = { kind: "me" } | { kind: "player"; index: number };

/** The full leaderboard: the top 50 players, with the player's own row pinned first. */
export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ period?: string; sort?: string }>();
  const [period, setPeriod] = useState<LeaderboardPeriod>(
    isLeaderboardPeriod(params.period) ? params.period : "today",
  );
  const [sort, setSort] = useState<LeaderboardSortKey>(isLeaderboardSortKey(params.sort) ? params.sort : "goals");

  const me = useMyLeaderEntry(period);
  const leaderValue = useLeaderValue();
  const board = useMemo(() => rankLeaderboard(period, sort, me), [period, sort, me]);
  const top = board.players.slice(0, LEADERBOARD_SIZE);
  const rows: Row[] = [{ kind: "me" }, ...top.map((_, index) => ({ kind: "player" as const, index }))];

  const header = (
    <View>
      <Pressable
        onPress={() => router.back()}
        className="mb-5 flex-row items-center gap-1 self-start active:opacity-70"
        hitSlop={8}
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={22} color="#64748b" />
        <Text className="text-base" style={{ fontFamily: Pixelify.medium, color: "#94a3b8" }}>
          {t("common.back")}
        </Text>
      </Pressable>

      <LeaderboardControls period={period} onPeriodChange={setPeriod} sort={sort} onSortChange={setSort} />
    </View>
  );

  return (
    <View className="flex-1 bg-neutral-100">
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "me" ? "me" : top[row.index].entry.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        renderItem={({ item, index }) => {
          const first = index === 0;
          const last = index === rows.length - 1;
          return (
            <View
              className="overflow-hidden bg-white"
              style={{
                borderTopLeftRadius: first ? 16 : 0,
                borderTopRightRadius: first ? 16 : 0,
                borderBottomLeftRadius: last ? 16 : 0,
                borderBottomRightRadius: last ? 16 : 0,
              }}
            >
              {item.kind === "me" ? (
                <MyLeaderRow entry={me} rank={board.myRank} value={leaderValue(me, sort)} showStreak />
              ) : (
                <LeaderRow
                  entry={top[item.index].entry}
                  rank={top[item.index].rank}
                  value={leaderValue(top[item.index].entry, sort)}
                  showTagline
                />
              )}
              {!last && <View className="mx-4 h-px bg-neutral-100" />}
            </View>
          );
        }}
      />
    </View>
  );
}
