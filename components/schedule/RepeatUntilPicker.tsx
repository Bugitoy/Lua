import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { describeRepeat } from "@/components/schedule/RepeatField";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { monthWeeks, shiftPeriod, weekDays } from "@/lib/calendarGrid";
import { startOfDay } from "@/lib/dayKey";
import { formatAppDate } from "@/lib/i18n/formatLocale";
import { occursOn, type RepeatRule } from "@/lib/repeatRule";

type RepeatUntilPickerProps = {
  /** The goal's first day. */
  startDay: string;
  rule: RepeatRule;
  /** The current last day, or null for forever. */
  value: string | null;
  onCancel: () => void;
  /** The chosen last day, or null to repeat forever. */
  onConfirm: (until: string | null) => void;
};

/**
 * "Repeat until": a month calendar where the green days are the days the
 * goal happens. Picking one makes it the last; Forever clears the end.
 * Drawn over the New goal sheet.
 */
export function RepeatUntilPicker({ startDay, rule, value, onCancel, onConfirm }: RepeatUntilPickerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(value);
  const [anchor, setAnchor] = useState(value ?? startDay);

  const firstOfMonth = `${anchor.slice(0, 8)}01`;
  const canGoBack = firstOfMonth > startDay;

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/45 px-5">
      <Pressable className="absolute inset-0" onPress={onCancel} accessibilityLabel={t("common.cancel")} />
      <View
        className="w-full max-w-[400px] rounded-3xl bg-white px-4 pb-4 pt-5"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        <Text className="px-1 text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 18 }} accessibilityRole="header">
          {t("schedule.repeat.until.title")}
        </Text>
        <Text className="mb-4 px-1 text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 12 }}>
          {`${describeRepeat(rule, t)} · ${t("schedule.repeat.until.hint")}`}
        </Text>

        <View className="mb-3 flex-row items-center justify-between">
          <ArrowButton
            icon="chevron-back"
            label={t("schedule.calendar.previous")}
            enabled={canGoBack}
            onPress={() => setAnchor(shiftPeriod(anchor, "month", -1))}
          />
          <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 15 }}>
            {formatAppDate(startOfDay(anchor), { month: "long", year: "numeric" })}
          </Text>
          <ArrowButton
            icon="chevron-forward"
            label={t("schedule.calendar.next")}
            enabled
            onPress={() => setAnchor(shiftPeriod(anchor, "month", 1))}
          />
        </View>

        <View className="mb-1 flex-row">
          {weekDays(anchor).map((day) => (
            <Text
              key={day}
              className="flex-1 text-center text-neutral-400"
              style={{ fontFamily: Pixelify.medium, fontSize: 11 }}
            >
              {formatAppDate(startOfDay(day), { weekday: "narrow" })}
            </Text>
          ))}
        </View>

        <View style={{ gap: 4 }}>
          {monthWeeks(anchor).map((week, w) => (
            <View key={w} className="flex-row">
              {week.map((day, i) => {
                if (!day) return <View key={i} className="flex-1" />;
                const happens = occursOn(startDay, rule, day);
                const isSelected = day === selected;
                return (
                  <View key={day} className="flex-1 items-center">
                    <Pressable
                      onPress={() => setSelected(day)}
                      disabled={!happens}
                      accessibilityRole="button"
                      accessibilityLabel={formatAppDate(startOfDay(day), { weekday: "long", month: "long", day: "numeric" })}
                      accessibilityState={{ selected: isSelected, disabled: !happens }}
                      className="items-center justify-center active:opacity-70"
                      style={{
                        width: "92%",
                        maxWidth: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: isSelected ? LUA_GREEN : happens ? "rgba(22,163,74,0.12)" : "transparent",
                        borderWidth: happens && !isSelected ? 1 : 0,
                        borderColor: "rgba(22,163,74,0.35)",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Pixelify.bold,
                          fontSize: 14,
                          color: isSelected ? "#ffffff" : happens ? "#15803d" : "#d4d4d4",
                        }}
                      >
                        {startOfDay(day).getDate()}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => onConfirm(null)}
            accessibilityRole="button"
            className="flex-1 items-center rounded-xl border border-neutral-200 py-3.5 active:opacity-80"
          >
            <Text className="text-neutral-700" style={{ fontFamily: Pixelify.semibold, fontSize: 14 }}>
              {t("schedule.repeat.until.forever")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(selected)}
            accessibilityRole="button"
            className="flex-1 items-center rounded-xl py-3.5 active:opacity-90"
            style={{ backgroundColor: LUA_GREEN }}
          >
            <Text className="text-white" style={{ fontFamily: Pixelify.bold, fontSize: 14 }}>
              {t("common.done")}
            </Text>
          </Pressable>
        </View>
      </View>
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
