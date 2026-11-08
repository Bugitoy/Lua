import { Ionicons } from "@expo/vector-icons";
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
  /** The goal type's icon (work, meal, social). */
  icon: keyof typeof Ionicons.glyphMap;
  /** Shows the ↻ tag next to the time. */
  repeating?: boolean;
  status: GoalCardStatus;
  /** Opens the goal for editing; shows the pencil. */
  onPress?: () => void;
  /** Long-press action, e.g. asking to remove the goal. */
  onLongPress?: () => void;
};

/**
 * Every goal type shares one calm green; the icon tells them apart. Goals
 * still to do (or missed) get a deeper shade than finished ones.
 */
const SHADES = {
  open: { bg: "#76db9b", border: "#53c67d" },
  finished: { bg: "#dcfce7", border: "#bbf7d0" },
} as const;
const INK = "#171717";
const MUTED = "#737373";

const PILLS = {
  complete: { icon: null, color: "#15803d", label: "schedule.card.complete" },
  done: { icon: "checkmark", color: "#15803d", label: "schedule.card.done" },
  missed: { icon: "close", color: "#b91c1c", label: "schedule.card.missed" },
  planned: { icon: "calendar-outline", color: "#404040", label: "schedule.card.planned" },
} as const;

export function ScheduleItemCard({
  time,
  title,
  location,
  note,
  icon,
  repeating = false,
  status,
  onPress,
  onLongPress,
}: ScheduleItemCardProps) {
  const { t } = useTranslation();
  const finished = status === "complete" || status === "done";
  const shade = finished ? SHADES.finished : SHADES.open;
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
      className="mb-3 overflow-hidden rounded-xl bg-white active:opacity-90"
      style={{
        borderWidth: 1,
        borderColor: shade.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <View
        style={{
          backgroundColor: shade.bg,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Ionicons name={icon} size={20} color={finished ? "#a3a3a3" : INK} />

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, lineHeight: 18, color: INK }}>{time}</Text>
            {repeating && (
              <View accessible accessibilityLabel={t("schedule.card.repeats")}>
                <Ionicons name="repeat" size={12} color={MUTED} />
              </View>
            )}
          </View>
          <Text
            style={{
              fontFamily: Pixelify.semibold,
              fontSize: 12,
              lineHeight: 16,
              color: finished ? MUTED : INK,
              textDecorationLine: finished ? "line-through" : "none",
            }}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>

        <View className="max-w-[45%] items-end gap-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="shrink text-right"
              style={{ fontFamily: Pixelify.semibold, fontSize: 11, lineHeight: 14, color: "#262626" }}
              numberOfLines={2}
            >
              {location}
            </Text>
            {onPress && <Ionicons name="pencil-outline" size={13} color="#404040" />}
          </View>
          {pill && (
            <View className="flex-row items-center gap-1 rounded-full bg-white px-2 py-0.5">
              {pill.icon && <Ionicons name={pill.icon} size={10} color={pill.color} />}
              <Text style={{ fontFamily: Pixelify.bold, fontSize: 9, color: pill.color }}>{t(pill.label)}</Text>
            </View>
          )}
        </View>
      </View>

      {note ? (
        <View className="bg-white px-3 py-2" style={{ borderTopWidth: 1, borderTopColor: shade.border }}>
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
