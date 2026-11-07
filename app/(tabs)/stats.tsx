import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LeaderboardControls } from "@/components/leaderboard/LeaderboardControls";
import { LeaderRow, MyLeaderRow } from "@/components/leaderboard/LeaderRow";
import { formatXp } from "@/components/achievements/theme";
import { DayDetailCard } from "@/components/stats/DayDetailCard";
import { DevHistoryControls } from "@/components/stats/DevHistoryControls";
import { StepCalendar } from "@/components/stats/StepCalendar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { weekDays } from "@/lib/calendarGrid";
import { startOfDay } from "@/lib/dayKey";
import { useDayHistory, type DayRecord } from "@/lib/dayHistory";
import { formatHours } from "@/lib/formatters";
import { formatAppDate, getAppLocale } from "@/lib/i18n/formatLocale";
import {
  rankLeaderboard,
  useLeaderValue,
  useMyLeaderEntry,
  type LeaderboardPeriod,
  type LeaderboardSortKey,
} from "@/lib/leaderboard";
import { useTodayRecord } from "@/lib/todayRecord";

/** Players shown on the Stats page before "See full leaderboard". */
const LEADER_PREVIEW = 3;

/** Same switch as the dev XP buttons on the Customize tab. */
const SHOW_DEV_HISTORY_CONTROLS = __DEV__ || process.env.EXPO_PUBLIC_DEV_XP_CONTROLS === "1";

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

const MILES_PER_METER = 0.000621371;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const history = useDayHistory();
  const todayRecord = useTodayRecord();
  const [calendarDay, setCalendarDay] = useState(todayRecord.day);
  const [leaderSort, setLeaderSort] = useState<LeaderboardSortKey>("goals");
  const [leaderPeriod, setLeaderPeriod] = useState<LeaderboardPeriod>("today");
  const leaderValue = useLeaderValue();

  // Averages for the Monday–Sunday week holding the day picked on the calendar,
  // over the days of it so far. A day with nothing saved counts as zero.
  const averageWeek = useMemo(() => {
    const days = weekDays(calendarDay);
    const counted = days.filter((d) => d <= todayRecord.day);
    const records = counted.map((d) => (d === todayRecord.day ? todayRecord : history[d]));
    const average = (pick: (r: DayRecord) => number) =>
      counted.length > 0 ? records.reduce((s, r) => s + (r ? pick(r) : 0), 0) / counted.length : 0;
    const fmt = { month: "short", day: "numeric" } as const;
    return {
      range: `${formatAppDate(startOfDay(days[0]), fmt)} – ${formatAppDate(startOfDay(days[6]), fmt)}`,
      steps: average((r) => r.steps),
      miles: average((r) => r.meters * MILES_PER_METER),
      workHours: average((r) => r.workHours),
    };
  }, [calendarDay, history, todayRecord]);

  const averages = [
    {
      icon: "walk-outline" as const,
      label: t("stats.day.steps"),
      accent: LUA_GREEN,
      value: formatXp(Math.round(averageWeek.steps), getAppLocale()),
    },
    {
      icon: "footsteps" as const,
      label: t("stats.summary.distance"),
      accent: "#3b82f6",
      value: t("stats.summary.distanceValue", { distance: averageWeek.miles.toFixed(1) }),
    },
    {
      icon: "briefcase-outline" as const,
      label: t("stats.averages.workTime"),
      accent: "#8b5cf6",
      value: formatHours(averageWeek.workHours),
    },
  ];

  const me = useMyLeaderEntry(leaderPeriod);
  const board = useMemo(() => rankLeaderboard(leaderPeriod, leaderSort, me), [leaderPeriod, leaderSort, me]);
  const preview = board.players.slice(0, LEADER_PREVIEW);

  return (
    <View className="flex-1 bg-neutral-100">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-5 text-3xl text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
          {t("stats.title")}
        </Text>

        {/* Averages for the calendar's chosen week */}
        <SectionLabel>{t("stats.averages.weekTitle", { range: averageWeek.range })}</SectionLabel>
        <View className="mb-5 flex-row gap-2.5">
          {averages.map((card) => (
            <View key={card.label} className="min-w-0 flex-1 rounded-2xl bg-white p-3" style={CARD_SHADOW}>
              <View
                className="mb-3 size-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${card.accent}15` }}
              >
                <Ionicons name={card.icon} size={17} color={card.accent} />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                className="text-neutral-900"
                style={{ fontFamily: Pixelify.bold, fontSize: 18 }}
              >
                {card.value}
              </Text>
              <Text numberOfLines={1} className="text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 11 }}>
                {card.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar + the tapped day */}
        <StepCalendar history={history} today={todayRecord} selectedDay={calendarDay} onSelectDay={setCalendarDay} />
        <DayDetailCard
          day={calendarDay}
          record={calendarDay === todayRecord.day ? todayRecord : history[calendarDay]}
          isToday={calendarDay === todayRecord.day}
        />
        {SHOW_DEV_HISTORY_CONTROLS ? <DevHistoryControls /> : null}

        {/* Leaderboard */}
        <View className="mt-2">
          <LeaderboardControls
            period={leaderPeriod}
            onPeriodChange={setLeaderPeriod}
            sort={leaderSort}
            onSortChange={setLeaderSort}
          />
        </View>
        <View className="overflow-hidden rounded-2xl bg-white" style={CARD_SHADOW}>
          {preview.map(({ entry, rank }) => (
            <View key={entry.id}>
              <LeaderRow entry={entry} rank={rank} value={leaderValue(entry, leaderSort)} />
              <View className="mx-4 h-px bg-neutral-100" />
            </View>
          ))}
          <MyLeaderRow entry={me} rank={board.myRank} value={leaderValue(me, leaderSort)} />
          <Pressable
            onPress={() => router.push({ pathname: "/leaderboard", params: { period: leaderPeriod, sort: leaderSort } })}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-1 py-3.5 active:bg-neutral-50"
          >
            <Text style={{ fontFamily: Pixelify.bold, fontSize: 13, color: LUA_GREEN }}>
              {t("stats.leaderboard.seeFull")}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={LUA_GREEN} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="mb-2.5 ml-1 text-xs uppercase tracking-widest text-neutral-400"
      style={{ fontFamily: Pixelify.semibold }}
    >
      {children}
    </Text>
  );
}
