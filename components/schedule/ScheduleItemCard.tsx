import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";

/**
 * - `pending`: today, not reached yet.
 * - `complete`: today, reached.
 * - `done` / `missed`: a past day's result.
 * - `planned`: a later day; it counts once that day starts.
 */
export type GoalCardStatus = "pending" | "complete" | "done" | "missed" | "planned";

export type ScheduleItemCardProps = {
  time: string;
  title: string;
  location: string;
  note?: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  glowColor: string;
  /** Shows the ↻ tag next to the time. */
  repeating?: boolean;
  status: GoalCardStatus;
  /** Opens the goal for editing; shows the pencil. */
  onPress?: () => void;
  /** Long-press action, e.g. asking to remove the goal. */
  onLongPress?: () => void;
};

const PILLS = {
  complete: { icon: "checkmark-circle", color: "#15803d", bg: "rgba(22,163,74,0.2)", label: "schedule.card.goalComplete" },
  done: { icon: "checkmark-circle", color: "#15803d", bg: "rgba(22,163,74,0.2)", label: "schedule.card.done" },
  missed: { icon: "close-circle", color: "#b91c1c", bg: "rgba(220,38,38,0.16)", label: "schedule.card.missed" },
  planned: { icon: "calendar-outline", color: "#404040", bg: "rgba(255,255,255,0.6)", label: "schedule.card.planned" },
} as const;

export function ScheduleItemCard({
  time,
  title,
  location,
  note,
  icon,
  gradientColors,
  glowColor,
  repeating = false,
  status,
  onPress,
  onLongPress,
}: ScheduleItemCardProps) {
  const { t } = useTranslation();
  const finished = status === "complete" || status === "done";
  const quiet = finished || status === "missed";
  const pill = status === "pending" ? null : PILLS[status];
  const hint = onPress
    ? t("schedule.card.editHint")
    : onLongPress
      ? t("schedule.remove.hint")
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityHint={hint}
      className="mb-3 overflow-hidden rounded-2xl bg-white"
      style={{
        opacity: finished ? 0.65 : status === "missed" ? 0.85 : 1,
        shadowColor: quiet ? "#000" : glowColor,
        shadowOffset: { width: 0, height: quiet ? 2 : 6 },
        shadowOpacity: quiet ? 0.06 : 0.38,
        shadowRadius: quiet ? 4 : 14,
        elevation: quiet ? 1 : 8,
      }}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Ionicons name={icon} size={20} color="#171717" />

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 14, lineHeight: 18 }}>
              {time}
            </Text>
            {repeating && (
              <View
                accessible
                accessibilityLabel={t("schedule.card.repeats")}
                className="rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: "rgba(255,255,255,0.55)" }}
              >
                <Ionicons name="repeat" size={10} color="#262626" />
              </View>
            )}
          </View>
          <Text
            className="text-neutral-900"
            style={{
              fontFamily: Pixelify.semibold,
              fontSize: 12,
              lineHeight: 16,
              textDecorationLine: finished ? "line-through" : "none",
            }}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>

        <View className="max-w-[45%] items-end gap-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="shrink text-right text-neutral-900"
              style={{ fontFamily: Pixelify.semibold, fontSize: 11, lineHeight: 14 }}
              numberOfLines={2}
            >
              {location}
            </Text>
            {onPress && <Ionicons name="pencil" size={11} color="#262626" />}
          </View>
          {pill && (
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: pill.bg }}>
              <Ionicons name={pill.icon} size={9} color={pill.color} />
              <Text style={{ fontFamily: Pixelify.bold, fontSize: 9, color: pill.color }}>{t(pill.label)}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {note ? (
        <View className="border-t border-black/5 bg-white px-3 py-2">
          <Text
            className="text-neutral-700"
            style={{ fontFamily: Pixelify.regular, fontSize: 11, lineHeight: 15 }}
            numberOfLines={4}
          >
            {note}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
