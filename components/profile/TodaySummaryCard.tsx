import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { formatXp } from "@/components/achievements/theme";
import { ProgressRing } from "@/components/stats/ProgressRing";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { formatHours } from "@/lib/formatters";
import { getAppLocale } from "@/lib/i18n/formatLocale";
import { DAILY_STEP_GOAL } from "@/lib/walkingRules";

const STREAK_ORANGE = "#ea580c";

type TodaySummaryCardProps = {
  goalsDone: number;
  goalsTotal: number;
  goalStreak: number;
  stepsToday: number;
  distanceMiles: number;
  hoursWorked: number;
};

/**
 * Today on the Profile screen: a goals ring with what's left and the streak,
 * then steps, distance and work time side by side.
 */
export function TodaySummaryCard({
  goalsDone,
  goalsTotal,
  goalStreak,
  stepsToday,
  distanceMiles,
  hoursWorked,
}: TodaySummaryCardProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const left = Math.max(0, goalsTotal - goalsDone);
  const headline =
    goalsTotal === 0
      ? t("profile.summary.noGoals")
      : left === 0
        ? t("profile.summary.allDone")
        : t("profile.summary.goalsToGo", { count: left });

  return (
    <View
      className="mb-4 rounded-3xl bg-white px-4 py-3.5"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Goals ring + what's left + streak */}
      <View className="flex-row items-center gap-4 px-1">
        <ProgressRing
          size={72}
          thickness={7}
          progress={goalsTotal > 0 ? goalsDone / goalsTotal : 0}
          color={LUA_GREEN}
          trackColor={`${LUA_GREEN}1f`}
        >
          <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 16, lineHeight: 19 }}>
            {`${goalsDone}/${goalsTotal}`}
          </Text>
          <Text className="text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 9 }}>
            {t("profile.summary.goalsLabel")}
          </Text>
        </ProgressRing>

        <View className="min-w-0 flex-1 items-start">
          <Text
            className="uppercase tracking-widest text-neutral-500"
            style={{ fontFamily: Pixelify.semibold, fontSize: 10 }}
          >
            {t("common.today")}
          </Text>
          <Text className="mt-0.5 text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 15 }}>
            {headline}
          </Text>
          <View
            className="mt-1.5 flex-row items-center gap-1 rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: "rgba(249,115,22,0.1)" }}
          >
            <Ionicons name="flame-outline" size={11} color={STREAK_ORANGE} />
            <Text style={{ fontFamily: Pixelify.semibold, fontSize: 11, color: STREAK_ORANGE }}>
              {goalStreak > 0 ? t("profile.summary.streak", { count: goalStreak }) : t("profile.summary.streakNone")}
            </Text>
          </View>
        </View>
      </View>

      <View className="my-3 h-px bg-neutral-100" />

      {/* Steps, distance, work time */}
      <View className="flex-row">
        <Metric
          icon="walk"
          accent={LUA_GREEN}
          value={formatXp(stepsToday, locale)}
          label={t("profile.summary.ofSteps", { goal: formatXp(DAILY_STEP_GOAL, locale) })}
        />
        <View className="w-px bg-neutral-100" />
        <Metric
          icon="footsteps"
          accent="#3b82f6"
          value={`${distanceMiles} ${t("units.milesShort")}`}
          label={t("profile.summary.walked")}
        />
        <View className="w-px bg-neutral-100" />
        <Metric
          icon="briefcase"
          accent="#8b5cf6"
          value={formatHours(hoursWorked)}
          label={t("profile.summary.worked")}
        />
      </View>
    </View>
  );
}

function Metric({
  icon,
  accent,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  value: string;
  label: string;
}) {
  return (
    <View className="min-w-0 flex-1 items-center px-1">
      <View className="mb-1.5 size-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}18` }}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <Text
        className="text-neutral-900"
        style={{ fontFamily: Pixelify.bold, fontSize: 14 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text
        className="text-center text-neutral-500"
        style={{ fontFamily: Pixelify.regular, fontSize: 10 }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}
