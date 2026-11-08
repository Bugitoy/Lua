import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { monthWeeks, shiftPeriod, weekDays, type Week } from "@/lib/calendarGrid";
import { startOfDay } from "@/lib/dayKey";
import { formatAppDate } from "@/lib/i18n/formatLocale";

/** A day shows one line per goal, up to this many. */
const MAX_LINES = 4;

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

type ScheduleCalendarProps = {
  selectedDay: string;
  today: string;
  onSelectDay: (day: string) => void;
  /** Goals on a day, drawn as small lines under its date. */
  countFor?: (day: string) => number;
  /** Days before this can't be picked (the sheet's date picker). */
  minDay?: string;
  /** Always show the whole month, with no week strip (the sheet's date picker). */
  monthOnly?: boolean;
};

/**
 * The Schedule calendar: one week with ‹ › arrows. Tapping the month name
 * opens the whole month. Today is outlined; the chosen day is filled green.
 */
export function ScheduleCalendar({
  selectedDay,
  today,
  onSelectDay,
  countFor,
  minDay,
  monthOnly = false,
}: ScheduleCalendarProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(monthOnly);
  const [anchor, setAnchor] = useState(selectedDay);

  // Jump to the chosen day when it changes from outside (e.g. the Today chip).
  useEffect(() => setAnchor(selectedDay), [selectedDay]);

  const showMonth = monthOnly || expanded;
  const weeks: Week[] = showMonth ? monthWeeks(anchor) : [weekDays(anchor)];
  const step = (dir: 1 | -1) => setAnchor(shiftPeriod(anchor, showMonth ? "month" : "week", dir));
  // The date picker can't go back to a week or month that is all before `minDay`.
  const canGoBack = !minDay || firstShownDay(anchor, showMonth) > minDay;

  const pick = (day: string) => {
    onSelectDay(day);
    if (!monthOnly) setExpanded(false);
  };

  const monthLabel = formatAppDate(startOfDay(anchor), { month: "long", year: "numeric" });

  return (
    <View
      className={monthOnly ? "rounded-xl border border-neutral-200 bg-white p-3" : "rounded-2xl bg-white px-3 pb-3 pt-3"}
      style={monthOnly ? undefined : CARD_SHADOW}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <ArrowButton
          icon="chevron-back"
          label={t("schedule.calendar.previous")}
          enabled={canGoBack}
          onPress={() => step(-1)}
        />
        {monthOnly ? (
          <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 15 }}>
            {monthLabel}
          </Text>
        ) : (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t(expanded ? "schedule.calendar.showWeek" : "schedule.calendar.showMonth")}
            accessibilityState={{ expanded }}
            hitSlop={8}
            className="flex-row items-center gap-1.5 active:opacity-70"
          >
            <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 15 }}>
              {monthLabel}
            </Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#262626" />
          </Pressable>
        )}
        <ArrowButton icon="chevron-forward" label={t("schedule.calendar.next")} enabled onPress={() => step(1)} />
      </View>

      <View className="mb-1 flex-row">
        {weekDays(anchor).map((day) => (
          <Text
            key={day}
            className="flex-1 text-center text-neutral-400"
            style={{ fontFamily: Pixelify.medium, fontSize: 11 }}
          >
            {formatAppDate(startOfDay(day), { weekday: "short" })}
          </Text>
        ))}
      </View>

      <View style={{ gap: 2 }}>
        {weeks.map((week, w) => (
          <View key={w} className="flex-row">
            {week.map((day, i) =>
              day ? (
                <DayCell
                  key={day}
                  day={day}
                  today={today}
                  selected={day === selectedDay}
                  count={countFor?.(day) ?? 0}
                  disabled={minDay != null && day < minDay}
                  compact={showMonth}
                  onPress={pick}
                />
              ) : (
                <View key={i} className="flex-1" />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The first day on screen: the week's Monday, or the 1st of the month. */
function firstShownDay(anchor: string, month: boolean): string {
  return month ? `${anchor.slice(0, 8)}01` : weekDays(anchor)[0];
}

function DayCell({
  day,
  today,
  selected,
  count,
  disabled,
  compact,
  onPress,
}: {
  day: string;
  today: string;
  selected: boolean;
  count: number;
  disabled: boolean;
  compact: boolean;
  onPress: (day: string) => void;
}) {
  const { t } = useTranslation();
  const isToday = day === today;
  const past = day < today;
  const date = startOfDay(day);
  const textColor = selected ? "#ffffff" : disabled ? "#d4d4d4" : past ? "#8a8a8a" : "#171717";
  const lineColor = selected ? "#ffffff" : LUA_GREEN;
  const lines = Math.min(count, MAX_LINES);
  const dateLabel = formatAppDate(date, { weekday: "long", month: "long", day: "numeric" });

  return (
    <View className="flex-1 items-center">
      <Pressable
        onPress={() => onPress(day)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? t("schedule.calendar.dayGoals", { date: dateLabel, count }) : dateLabel}
        accessibilityState={{ selected, disabled }}
        className="items-center justify-center active:opacity-70"
        style={{
          width: "92%",
          maxWidth: compact ? 38 : 42,
          height: compact ? 40 : 46,
          borderRadius: 12,
          backgroundColor: selected ? LUA_GREEN : "transparent",
          borderWidth: isToday && !selected ? 1.5 : 0,
          borderColor: LUA_GREEN,
        }}
      >
        <Text style={{ fontFamily: Pixelify.bold, fontSize: compact ? 14 : 16, color: textColor }}>
          {date.getDate()}
        </Text>
        <View className="mt-1 flex-row" style={{ height: 2, gap: 2 }}>
          {Array.from({ length: lines }, (_, i) => (
            <View key={i} style={{ width: 5, height: 2, borderRadius: 1, backgroundColor: lineColor }} />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

function ArrowButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityLabel={label}
      hitSlop={10}
      className="size-8 items-center justify-center rounded-full active:opacity-70"
    >
      <Ionicons name={icon} size={18} color={enabled ? "#525252" : "#d4d4d4"} />
    </Pressable>
  );
}
