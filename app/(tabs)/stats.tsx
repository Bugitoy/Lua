import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useGameStats } from "@/lib/gameStats";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayData = {
  label: string;
  fullDate: string;
  distanceMiles: number;
  goalsDone: number;
  goalsTotal: number;
  hoursStudied: number;
};

type MetricKey = "distance" | "goals" | "study";

type MetricConfig = {
  key: MetricKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  unit: string;
  format: (d: DayData) => string;
  getValue: (d: DayData) => number;
  getMax: (d: DayData) => number;
};

// ─── Leaderboard ─────────────────────────────────────────────────────────────

type LeaderboardSortKey = "goals" | "distance" | "study";

type LeaderEntry = {
  id: string;
  name: string;
  major: string;
  avatarImg: number;
  goalsDone: number;
  goalsTotal: number;
  distanceMiles: number;
  hoursStudied: number;
  streak: number;
};

const LEADERBOARD: LeaderEntry[] = [
  { id: "1", name: "Jordan Park",    major: "Computer Science",  avatarImg: 3,  goalsDone: 11, goalsTotal: 12, distanceMiles: 8.4, hoursStudied: 5.5, streak: 14 },
  { id: "2", name: "Maya Chen",      major: "Biomedical Eng.",   avatarImg: 5,  goalsDone: 10, goalsTotal: 12, distanceMiles: 7.1, hoursStudied: 6.0, streak: 21 },
  { id: "3", name: "Liam Torres",    major: "Business",          avatarImg: 8,  goalsDone: 9,  goalsTotal: 10, distanceMiles: 5.8, hoursStudied: 3.5, streak: 9  },
  { id: "4", name: "Ava Johnson",    major: "Nursing",           avatarImg: 9,  goalsDone: 8,  goalsTotal: 10, distanceMiles: 9.2, hoursStudied: 4.0, streak: 6  },
  { id: "5", name: "Noah Williams",  major: "Architecture",      avatarImg: 11, goalsDone: 8,  goalsTotal: 12, distanceMiles: 6.3, hoursStudied: 4.5, streak: 11 },
  { id: "6", name: "Sofia Nguyen",   major: "Pharmacy",          avatarImg: 15, goalsDone: 7,  goalsTotal: 10, distanceMiles: 4.5, hoursStudied: 5.0, streak: 4  },
  { id: "7", name: "Ethan Brown",    major: "Mechanical Eng.",   avatarImg: 17, goalsDone: 7,  goalsTotal: 12, distanceMiles: 3.9, hoursStudied: 3.0, streak: 7  },
];

const RANK_COLORS = ["#f59e0b", "#9ca3af", "#92400e"];
const RANK_ICONS: Array<keyof typeof Ionicons.glyphMap> = ["trophy", "medal", "ribbon"];

function sortLeaderboard(entries: LeaderEntry[], key: LeaderboardSortKey): LeaderEntry[] {
  return [...entries].sort((a, b) => {
    if (key === "goals") return b.goalsDone / b.goalsTotal - a.goalsDone / a.goalsTotal;
    if (key === "distance") return b.distanceMiles - a.distanceMiles;
    return b.hoursStudied - a.hoursStudied;
  });
}

function leaderValue(entry: LeaderEntry, key: LeaderboardSortKey): string {
  if (key === "goals") return `${entry.goalsDone}/${entry.goalsTotal}`;
  if (key === "distance") return `${entry.distanceMiles} mi`;
  return `${entry.hoursStudied} hrs`;
}

// ─── Mock history (past 6 days + today placeholder filled from live stats) ───

const DAYS_AGO = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const HISTORY: Omit<DayData, "label" | "fullDate">[] = [
  { distanceMiles: 2.1, goalsDone: 4,  goalsTotal: 10, hoursStudied: 1.5 },
  { distanceMiles: 4.8, goalsDone: 8,  goalsTotal: 10, hoursStudied: 3.0 },
  { distanceMiles: 3.3, goalsDone: 5,  goalsTotal: 12, hoursStudied: 2.5 },
  { distanceMiles: 6.0, goalsDone: 11, goalsTotal: 12, hoursStudied: 4.0 },
  { distanceMiles: 1.7, goalsDone: 2,  goalsTotal: 8,  hoursStudied: 0.5 },
  { distanceMiles: 5.2, goalsDone: 9,  goalsTotal: 12, hoursStudied: 3.5 },
];

// ─── Metrics config ───────────────────────────────────────────────────────────

const METRICS: MetricConfig[] = [
  {
    key: "distance",
    label: "Distance",
    icon: "footsteps",
    accent: "#3b82f6",
    unit: "mi",
    getValue: (d) => d.distanceMiles,
    getMax: (d) => d.distanceMiles,
    format: (d) => `${d.distanceMiles} mi`,
  },
  {
    key: "goals",
    label: "Goals",
    icon: "flag-outline",
    accent: LUA_GREEN,
    unit: "goals",
    getValue: (d) => d.goalsDone,
    getMax: (d) => d.goalsTotal,
    format: (d) => `${d.goalsDone} / ${d.goalsTotal}`,
  },
  {
    key: "study",
    label: "Study",
    icon: "book-outline",
    accent: "#8b5cf6",
    unit: "hrs",
    getValue: (d) => d.hoursStudied,
    getMax: (d) => d.hoursStudied,
    format: (d) => `${d.hoursStudied} hrs`,
  },
];

// ─── Bar chart ────────────────────────────────────────────────────────────────

const CHART_H = 160;

type BarChartProps = {
  data: DayData[];
  metric: MetricConfig;
  selectedIdx: number;
  onSelect: (idx: number) => void;
};

function BarChart({ data, metric, selectedIdx, onSelect }: BarChartProps) {
  const screenW = Dimensions.get("window").width;
  const chartW = screenW - 48; // 24px horizontal padding each side
  const barAreaW = chartW / data.length;
  const barW = Math.min(barAreaW * 0.5, 32);

  const absMax = Math.max(...data.map((d) => metric.getMax(d)), 1);

  return (
    <View style={{ height: CHART_H + 36 }}>
      {/* Y-axis grid lines */}
      <View
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: CHART_H }}
        pointerEvents="none"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <View
            key={frac}
            style={{
              position: "absolute",
              top: CHART_H * (1 - frac),
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: frac === 0 ? "#e5e7eb" : "#f3f4f6",
            }}
          />
        ))}
      </View>

      {/* Bars */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: CHART_H,
          paddingHorizontal: 0,
        }}
      >
        {data.map((day, i) => {
          const val = metric.getValue(day);
          const maxVal = metric.getMax(day);
          const filledH = Math.max((val / absMax) * CHART_H, val > 0 ? 4 : 0);
          const totalH = Math.max((maxVal / absMax) * CHART_H, maxVal > 0 ? 4 : 0);
          const isSelected = i === selectedIdx;
          const isGoals = metric.key === "goals";

          return (
            <Pressable
              key={day.label}
              onPress={() => onSelect(i)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                height: CHART_H,
              }}
            >
              <View
                style={{
                  width: barW,
                  height: isGoals ? totalH : filledH,
                  borderRadius: 6,
                  overflow: "hidden",
                  opacity: isSelected ? 1 : 0.55,
                }}
              >
                {/* Background (total goals) bar */}
                {isGoals && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: totalH,
                      backgroundColor: `${metric.accent}30`,
                      borderRadius: 6,
                    }}
                  />
                )}
                {/* Filled bar */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: filledH,
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={[metric.accent, `${metric.accent}99`]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Day labels */}
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {data.map((day, i) => (
          <View key={day.label} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontFamily: i === selectedIdx ? Pixelify.bold : Pixelify.regular,
                fontSize: 11,
                color: i === selectedIdx ? metric.accent : "#9ca3af",
              }}
            >
              {day.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { stats } = useGameStats();
  const [activeMetric, setActiveMetric] = useState<MetricKey>("goals");
  const [selectedIdx, setSelectedIdx] = useState(6); // today by default
  const [leaderSort, setLeaderSort] = useState<LeaderboardSortKey>("goals");

  // Build dataset: 6 historical days + today from live stats
  const today = new Date();
  const data: DayData[] = [
    ...HISTORY.map((h, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (HISTORY.length - i));
      return {
        ...h,
        label: DAYS_AGO[i],
        fullDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
    }),
    {
      label: "Today",
      fullDate: today.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      distanceMiles: stats.distanceMiles,
      goalsDone: stats.goalsDone,
      goalsTotal: stats.goalsTotal,
      hoursStudied: stats.hoursStudied,
    },
  ];

  const metric = METRICS.find((m) => m.key === activeMetric)!;
  const selected = data[selectedIdx];

  // Summary cards for selected day
  const summaryCards = [
    { label: "Distance", value: `${selected.distanceMiles} mi`, icon: "footsteps" as const, accent: "#3b82f6" },
    { label: "Goals", value: `${selected.goalsDone}/${selected.goalsTotal}`, icon: "flag-outline" as const, accent: LUA_GREEN },
    { label: "Study", value: `${selected.hoursStudied} hrs`, icon: "book-outline" as const, accent: "#8b5cf6" },
  ];

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
        <Text
          className="mb-5 text-3xl text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          Stats
        </Text>

        {/* Chart card */}
        <View
          className="mb-4 rounded-2xl bg-white px-4 pt-5 pb-4"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Metric selector */}
          <View className="mb-5 flex-row gap-2">
            {METRICS.map((m) => {
              const active = m.key === activeMetric;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setActiveMetric(m.key)}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{
                    backgroundColor: active ? `${m.accent}18` : "#f5f5f5",
                    borderWidth: 1.5,
                    borderColor: active ? m.accent : "transparent",
                  }}
                >
                  <Ionicons name={m.icon} size={14} color={active ? m.accent : "#9ca3af"} />
                  <Text
                    style={{
                      fontFamily: active ? Pixelify.bold : Pixelify.regular,
                      fontSize: 12,
                      color: active ? m.accent : "#9ca3af",
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Selected day callout */}
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text
                className="text-xs text-neutral-400"
                style={{ fontFamily: Pixelify.regular }}
              >
                {selected.fullDate} {selected.label === "Today" ? "· Today" : ""}
              </Text>
              <Text
                className="mt-0.5 text-2xl"
                style={{ fontFamily: Pixelify.bold, color: metric.accent }}
              >
                {metric.format(selected)}
              </Text>
            </View>
            <View
              className="size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${metric.accent}15` }}
            >
              <Ionicons name={metric.icon} size={20} color={metric.accent} />
            </View>
          </View>

          {/* Goals legend */}
          {activeMetric === "goals" && (
            <View className="mb-3 flex-row gap-4">
              <View className="flex-row items-center gap-1.5">
                <View className="size-2.5 rounded-sm" style={{ backgroundColor: LUA_GREEN }} />
                <Text className="text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
                  Completed
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="size-2.5 rounded-sm" style={{ backgroundColor: `${LUA_GREEN}30` }} />
                <Text className="text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
                  Total
                </Text>
              </View>
            </View>
          )}

          <BarChart
            data={data}
            metric={metric}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />
        </View>

        {/* Selected day summary */}
        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {selected.label === "Today" ? "Today" : selected.fullDate} · All stats
        </Text>
        <View className="flex-row gap-3">
          {summaryCards.map((card) => (
            <View
              key={card.label}
              className="flex-1 items-center rounded-2xl bg-white py-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View
                className="mb-2 size-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${card.accent}15` }}
              >
                <Ionicons name={card.icon} size={18} color={card.accent} />
              </View>
              <Text
                className="text-base text-neutral-900"
                style={{ fontFamily: Pixelify.bold }}
              >
                {card.value}
              </Text>
              <Text
                className="mt-0.5 text-[11px] text-neutral-500"
                style={{ fontFamily: Pixelify.regular }}
              >
                {card.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 7-day averages */}
        <Text
          className="mb-2 ml-1 mt-5 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          7-Day Averages
        </Text>
        <View
          className="rounded-2xl bg-white px-4"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {[
            {
              icon: "footsteps" as const,
              label: "Avg Distance",
              accent: "#3b82f6",
              value: `${(data.reduce((s, d) => s + d.distanceMiles, 0) / data.length).toFixed(1)} mi`,
            },
            {
              icon: "flag-outline" as const,
              label: "Avg Goals Done",
              accent: LUA_GREEN,
              value: `${(data.reduce((s, d) => s + d.goalsDone, 0) / data.length).toFixed(1)}`,
            },
            {
              icon: "book-outline" as const,
              label: "Avg Study Time",
              accent: "#8b5cf6",
              value: `${(data.reduce((s, d) => s + d.hoursStudied, 0) / data.length).toFixed(1)} hrs`,
            },
          ].map((row, i, arr) => (
            <View key={row.label}>
              <View className="flex-row items-center justify-between py-3.5">
                <View className="flex-row items-center gap-3">
                  <View
                    className="size-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${row.accent}15` }}
                  >
                    <Ionicons name={row.icon} size={17} color={row.accent} />
                  </View>
                  <Text
                    className="text-sm text-neutral-700"
                    style={{ fontFamily: Pixelify.medium }}
                  >
                    {row.label}
                  </Text>
                </View>
                <Text
                  className="text-sm text-neutral-900"
                  style={{ fontFamily: Pixelify.bold }}
                >
                  {row.value}
                </Text>
              </View>
              {i < arr.length - 1 && (
                <View className="h-px bg-neutral-100" />
              )}
            </View>
          ))}
        </View>
        {/* Leaderboard */}
        <Text
          className="mb-2 ml-1 mt-5 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          UC Leaderboard · Today
        </Text>

        {/* Sort pills */}
        <View className="mb-3 flex-row gap-2">
          {(
            [
              { key: "goals" as const,    label: "Goals",    icon: "flag-outline" as const,  accent: LUA_GREEN  },
              { key: "distance" as const, label: "Distance", icon: "footsteps" as const,      accent: "#3b82f6"  },
              { key: "study" as const,    label: "Study",    icon: "book-outline" as const,   accent: "#8b5cf6"  },
            ] as const
          ).map((opt) => {
            const active = leaderSort === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setLeaderSort(opt.key)}
                className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: active ? `${opt.accent}18` : "#f5f5f5",
                  borderWidth: 1.5,
                  borderColor: active ? opt.accent : "transparent",
                }}
              >
                <Ionicons name={opt.icon} size={13} color={active ? opt.accent : "#9ca3af"} />
                <Text
                  style={{
                    fontFamily: active ? Pixelify.bold : Pixelify.regular,
                    fontSize: 12,
                    color: active ? opt.accent : "#9ca3af",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Entries */}
        <View
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* "You" row — always first if competitive */}
          {(() => {
            const meGoalsDone = stats.goalsDone;
            const meGoalsTotal = stats.goalsTotal;
            const meDistance = stats.distanceMiles;
            const meStudy = stats.hoursStudied;

            // Build combined list including "you" to find rank
            const meEntry: LeaderEntry = {
              id: "me",
              name: "You",
              major: "University of Cincinnati",
              avatarImg: 12,
              goalsDone: meGoalsDone,
              goalsTotal: meGoalsTotal,
              distanceMiles: meDistance,
              hoursStudied: meStudy,
              streak: stats.goalStreak,
            };
            const combined = sortLeaderboard([...LEADERBOARD, meEntry], leaderSort);
            const meRank = combined.findIndex((e) => e.id === "me") + 1;
            const sorted = sortLeaderboard(LEADERBOARD, leaderSort);

            const sortAccent =
              leaderSort === "goals" ? LUA_GREEN :
              leaderSort === "distance" ? "#3b82f6" : "#8b5cf6";

            return (
              <>
                {/* You banner */}
                <LinearGradient
                  colors={[`${sortAccent}18`, `${sortAccent}08`]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Rank badge */}
                    <View
                      className="w-7 items-center"
                    >
                      {meRank <= 3 ? (
                        <Ionicons name={RANK_ICONS[meRank - 1]} size={20} color={RANK_COLORS[meRank - 1]} />
                      ) : (
                        <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, color: sortAccent }}>
                          #{meRank}
                        </Text>
                      )}
                    </View>
                    <Image
                      source={{ uri: "https://i.pravatar.cc/80?img=12" }}
                      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: sortAccent }}
                    />
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-1.5">
                        <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, color: "#171717" }}>
                          You
                        </Text>
                        <View
                          className="rounded px-1.5 py-0.5"
                          style={{ backgroundColor: `${sortAccent}20` }}
                        >
                          <Text style={{ fontFamily: Pixelify.bold, fontSize: 9, color: sortAccent }}>
                            YOU
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: Pixelify.regular, fontSize: 11, color: "#737373" }}>
                        🔥 {stats.goalStreak}-day streak
                      </Text>
                    </View>
                    <Text style={{ fontFamily: Pixelify.bold, fontSize: 15, color: sortAccent }}>
                      {leaderValue(meEntry, leaderSort)}
                    </Text>
                  </View>
                </LinearGradient>

                <View className="h-px bg-neutral-100" />

                {/* Other users */}
                {sorted.map((entry, i) => {
                  const rank = combined.findIndex((e) => e.id === entry.id) + 1;
                  return (
                    <View key={entry.id}>
                      <View className="flex-row items-center gap-3 px-4 py-3">
                        {/* Rank */}
                        <View className="w-7 items-center">
                          {rank <= 3 ? (
                            <Ionicons name={RANK_ICONS[rank - 1]} size={20} color={RANK_COLORS[rank - 1]} />
                          ) : (
                            <Text style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: "#a3a3a3" }}>
                              #{rank}
                            </Text>
                          )}
                        </View>
                        <Image
                          source={{ uri: `https://i.pravatar.cc/80?img=${entry.avatarImg}` }}
                          style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                        <View className="flex-1 min-w-0">
                          <Text
                            style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: "#171717" }}
                            numberOfLines={1}
                          >
                            {entry.name}
                          </Text>
                          <Text
                            style={{ fontFamily: Pixelify.regular, fontSize: 11, color: "#737373" }}
                            numberOfLines={1}
                          >
                            {entry.major}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, color: "#171717" }}>
                          {leaderValue(entry, leaderSort)}
                        </Text>
                      </View>
                      {i < sorted.length - 1 && (
                        <View className="ml-[72px] mr-4 h-px bg-neutral-100" />
                      )}
                    </View>
                  );
                })}
              </>
            );
          })()}
        </View>

      </ScrollView>
    </View>
  );
}
