import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { formatXp } from "@/components/achievements/theme";
import { ProgressRing } from "@/components/stats/ProgressRing";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { startOfDay } from "@/lib/dayKey";
import type { DayRecord, GoalRecord } from "@/lib/dayHistory";
import { formatHours } from "@/lib/formatters";
import { formatAppDate, formatAppTime, getAppLocale } from "@/lib/i18n/formatLocale";
import { DAILY_STEP_GOAL } from "@/lib/walkingRules";

const MILES_PER_METER = 0.000621371;
const MISSED_RED = "#dc2626";

type DayDetailCardProps = {
  day: string;
  record: DayRecord | undefined;
  isToday: boolean;
};

/** What happened on one day: steps, distance, work, XP, health, and each goal done or missed. */
export function DayDetailCard({ day, record, isToday }: DayDetailCardProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const title = formatAppDate(startOfDay(day), { weekday: "long", month: "long", day: "numeric" });

  return (
    <View
      className="mb-4 rounded-2xl bg-white px-4 py-5"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="mb-4 flex-row items-center justify-between gap-2">
        <Text className="shrink text-base text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
          {title}
        </Text>
        {isToday ? (
          <Chip label={t("common.today")} color="#f59e0b" />
        ) : record?.fullDay ? (
          <Chip label={t("stats.day.fullDay")} color={LUA_GREEN} />
        ) : null}
      </View>

      {!record ? (
        <Text className="text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
          {t("stats.day.noRecord")}
        </Text>
      ) : (
        <>
          <View className="flex-row flex-wrap" style={{ rowGap: 14 }}>
            <Figure
              icon="footsteps"
              accent="#3b82f6"
              label={t("stats.summary.distance")}
              value={t("stats.summary.distanceValue", {
                distance: (record.meters * MILES_PER_METER).toFixed(2),
              })}
            />
            <Figure
              icon="briefcase-outline"
              accent="#8b5cf6"
              label={t("stats.summary.study")}
              value={formatHours(record.workHours)}
            />
            <Figure
              icon="star-outline"
              accent="#f59e0b"
              label={t("stats.day.xpEarned")}
              value={t("stats.day.xpValue", { xp: formatXp(record.xpEarned, locale) })}
            />
            <HealthFigure record={record} isToday={isToday} />
          </View>

          <StepsPanel steps={record.steps} locale={locale} />

          <GoalsList key={day} goals={record.goals} isToday={isToday} />
        </>
      )}
    </View>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}1f` }}>
      <Text style={{ fontFamily: Pixelify.bold, fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

function StepsPanel({ steps, locale }: { steps: number; locale: string }) {
  const { t } = useTranslation();
  const ratio = steps / DAILY_STEP_GOAL;
  return (
    <View className="mt-4 flex-row items-center gap-3.5 rounded-2xl px-4 py-3.5" style={{ backgroundColor: `${LUA_GREEN}12` }}>
      <ProgressRing size={52} thickness={5} progress={ratio} color={LUA_GREEN} trackColor={`${LUA_GREEN}2e`}>
        <Ionicons name="walk" size={22} color={LUA_GREEN} />
      </ProgressRing>
      <View className="min-w-0 shrink">
        <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 18 }}>
          {t("stats.day.stepsCount", { steps: formatXp(steps, locale) })}
        </Text>
        <Text style={{ fontFamily: Pixelify.regular, fontSize: 11, color: LUA_GREEN }}>
          {t("stats.day.ofGoal", { percent: Math.round(ratio * 100), goal: formatXp(DAILY_STEP_GOAL, locale) })}
        </Text>
      </View>
    </View>
  );
}

type FigureProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  label: string;
  value: string;
  valueColor?: string;
};

function Figure({ icon, accent, label, value, valueColor }: FigureProps) {
  return (
    <View className="flex-row items-center gap-3" style={{ width: "50%" }}>
      <View className="size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}15` }}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View className="min-w-0 shrink">
        <Text className="text-[11px] text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
          {label}
        </Text>
        <Text style={{ fontFamily: Pixelify.bold, fontSize: 15, color: valueColor ?? "#171717" }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function HealthFigure({ record, isToday }: { record: DayRecord; isToday: boolean }) {
  const { t } = useTranslation();
  const { healthBefore, healthAfter } = record;
  let value = t("common.emDash");
  let color: string | undefined;
  if (isToday) {
    value = t("stats.day.inProgress");
  } else if (healthBefore != null && healthAfter != null) {
    const change = Math.round((healthAfter - healthBefore) * 1000) / 10;
    value = change > 0 ? `+${change}%` : change < 0 ? `−${Math.abs(change)}%` : "0%";
    color = change > 0 ? LUA_GREEN : change < 0 ? MISSED_RED : undefined;
  }
  return (
    <Figure icon="heart-outline" accent="#ef4444" label={t("stats.day.health")} value={value} valueColor={color} />
  );
}

/** How many goals show before "Show all". */
const GOAL_PREVIEW = 3;

function GoalsList({ goals, isToday }: { goals: GoalRecord[]; isToday: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const done = goals.filter((g) => g.completed).length;
  const canFold = goals.length > GOAL_PREVIEW;
  const shown = canFold && !expanded ? goals.slice(0, GOAL_PREVIEW) : goals;
  return (
    <View className="mt-4 border-t border-neutral-100 pt-4">
      <Text className="mb-2 text-xs uppercase tracking-widest text-neutral-400" style={{ fontFamily: Pixelify.semibold }}>
        {goals.length > 0
          ? t("stats.day.goalsHeader", { done, total: goals.length })
          : t("stats.day.goalsHeaderEmpty")}
      </Text>
      {goals.length === 0 ? (
        <Text className="text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
          {t("stats.day.noGoals")}
        </Text>
      ) : (
        shown.map((goal) => <GoalRow key={goal.id} goal={goal} isToday={isToday} />)
      )}
      {canFold && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          className="mt-2 flex-row items-center justify-center gap-1.5 rounded-xl bg-neutral-50 py-3"
          style={{ borderWidth: 1, borderStyle: "dashed", borderColor: "#d4d4d4" }}
        >
          <Text className="text-neutral-600" style={{ fontFamily: Pixelify.semibold, fontSize: 12 }}>
            {expanded ? t("stats.day.showFewerGoals") : t("stats.day.showAllGoals", { count: goals.length })}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={13} color="#525252" />
        </Pressable>
      )}
    </View>
  );
}

function GoalRow({ goal, isToday }: { goal: GoalRecord; isToday: boolean }) {
  const { t } = useTranslation();
  const pending = !goal.completed && isToday;
  const icon = goal.completed ? "checkmark-circle" : pending ? "ellipse-outline" : "close-circle";
  const color = goal.completed ? LUA_GREEN : pending ? "#a3a3a3" : MISSED_RED;
  const status = goal.completed
    ? goal.completedAtMs != null
      ? t("stats.day.doneAt", {
          time: formatAppTime(new Date(goal.completedAtMs), { hour: "numeric", minute: "2-digit" }),
        })
      : t("stats.day.done")
    : pending
      ? t("stats.day.notYet")
      : t("stats.day.missed");
  const details = [goal.time, goal.location].filter((s) => s && s !== t("common.emDash")).join(" · ");

  return (
    <View className="flex-row items-start gap-2.5 py-2">
      <Ionicons name={icon} size={22} color={color} style={{ marginTop: 1 }} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm text-neutral-900" style={{ fontFamily: Pixelify.semibold }} numberOfLines={2}>
          {goal.title}
        </Text>
        {details ? (
          <Text className="text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }} numberOfLines={2}>
            {details}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontFamily: Pixelify.semibold, fontSize: 11, color }}>{status}</Text>
    </View>
  );
}
