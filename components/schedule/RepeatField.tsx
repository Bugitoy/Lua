import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import {
  MAX_REPEAT_EVERY,
  REPEAT_PRESETS,
  REPEAT_UNITS,
  presetRule,
  type RepeatPreset,
  type RepeatRule,
  type RepeatUnit,
} from "@/lib/repeatRule";

export type RepeatChoice = {
  preset: RepeatPreset;
  /** Used while `preset` is custom. */
  every: number;
  unit: RepeatUnit;
};

export const DEFAULT_REPEAT_CHOICE: RepeatChoice = { preset: "never", every: 2, unit: "week" };

/** The rule a choice saves, or null for Never. */
export function ruleFromChoice(choice: RepeatChoice): RepeatRule | null {
  return choice.preset === "custom" ? { unit: choice.unit, every: choice.every } : presetRule(choice.preset);
}

/** "Every 2 weeks", "Every weekday", … */
export function describeRepeat(rule: RepeatRule, t: TFunction): string {
  if (rule.unit === "weekdays") return t("schedule.repeat.summary.single.weekdays");
  // Separate keys for 1, since some languages have no singular plural form.
  return rule.every === 1
    ? t(`schedule.repeat.summary.single.${rule.unit}`)
    : t(`schedule.repeat.summary.multiple.${rule.unit}`, { count: rule.every });
}

const ACCENT_BG = "rgba(22,163,74,0.08)";

function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  square = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  square?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      className={`items-center justify-center border active:opacity-80 ${square ? "size-8 rounded-lg" : "rounded-full px-3 py-1.5"}`}
      style={{
        borderColor: selected ? LUA_GREEN : "#d4d4d4",
        backgroundColor: selected ? "rgba(22,163,74,0.12)" : "#fafafa",
      }}
    >
      <Text style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: selected ? LUA_GREEN : "#262626" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: "remove" | "add";
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="h-8 w-8 items-center justify-center active:opacity-70"
    >
      <Ionicons name={icon} size={16} color={enabled ? "#262626" : "#d4d4d4"} />
    </Pressable>
  );
}

/**
 * The Repeat row: Never / Daily / Weekdays / Weekly / Monthly / Custom.
 * Custom shows "Every [− N +] [D W M Y]", and a green line spells out the rule.
 */
export function RepeatField({ value, onChange }: { value: RepeatChoice; onChange: (next: RepeatChoice) => void }) {
  const { t } = useTranslation();
  const rule = ruleFromChoice(value);

  return (
    <View>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {REPEAT_PRESETS.map((preset) => (
          <Chip
            key={preset}
            label={t(`schedule.repeat.presets.${preset}`)}
            selected={value.preset === preset}
            onPress={() => onChange({ ...value, preset })}
          />
        ))}
      </View>

      {value.preset === "custom" && (
        <View className="mb-3 flex-row flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5">
          <Text className="text-neutral-800" style={{ fontFamily: Pixelify.semibold, fontSize: 13 }}>
            {t("schedule.repeat.every")}
          </Text>
          <View className="flex-row items-center rounded-lg border border-neutral-200 bg-white">
            <StepButton
              icon="remove"
              label={t("schedule.repeat.fewer")}
              enabled={value.every > 1}
              onPress={() => onChange({ ...value, every: value.every - 1 })}
            />
            <Text
              className="min-w-7 text-center text-neutral-900"
              style={{ fontFamily: Pixelify.bold, fontSize: 14 }}
              accessibilityLiveRegion="polite"
            >
              {value.every}
            </Text>
            <StepButton
              icon="add"
              label={t("schedule.repeat.more")}
              enabled={value.every < MAX_REPEAT_EVERY}
              onPress={() => onChange({ ...value, every: value.every + 1 })}
            />
          </View>
          <View className="flex-row gap-1.5">
            {REPEAT_UNITS.map((unit) => (
              <Chip
                key={unit}
                square
                label={t(`schedule.repeat.unitShort.${unit}`)}
                accessibilityLabel={t(`schedule.repeat.unitName.${unit}`)}
                selected={value.unit === unit}
                onPress={() => onChange({ ...value, unit })}
              />
            ))}
          </View>
        </View>
      )}

      {rule && (
        <View className="mb-1 flex-row items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: ACCENT_BG }}>
          <Ionicons name="repeat" size={15} color={LUA_GREEN} />
          <Text className="flex-1" style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: LUA_GREEN }}>
            {describeRepeat(rule, t)}
          </Text>
        </View>
      )}
    </View>
  );
}
