import { Pressable, Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { syncStreak } from "@/lib/dailyProgress";
import { dayKey } from "@/lib/dayKey";
import { useDayHistory } from "@/lib/dayHistory";
import { addSampleHistory, removeSampleDays } from "@/lib/sampleHistory";

/** Dev-only buttons to fill the Stats calendar with a year of made-up days, and clear them again. */
export function DevHistoryControls() {
  const history = useDayHistory();
  const sampleCount = Object.values(history).filter((r) => r.sample).length;

  const actions = [
    {
      label: sampleCount > 0 ? "Refill sample year" : "Add sample year",
      primary: true,
      onPress: () => {
        removeSampleDays();
        addSampleHistory(dayKey());
        syncStreak();
      },
    },
    {
      label: "Remove sample days",
      primary: false,
      onPress: () => {
        removeSampleDays();
        syncStreak();
      },
    },
  ];

  return (
    <View className="mb-4 gap-2">
      <Text className="text-center text-[11px] text-neutral-500" style={{ fontFamily: Pixelify.medium }}>
        Dev only: {sampleCount > 0 ? `${sampleCount} sample days in history` : "preview the calendar with made-up days"}
      </Text>
      <View className="flex-row gap-2">
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            disabled={!action.primary && sampleCount === 0}
            className="flex-1 items-center justify-center rounded-xl border active:opacity-80"
            style={{
              height: 40,
              backgroundColor: action.primary ? LUA_GREEN : "#fff",
              borderColor: action.primary ? LUA_GREEN : "#e5e5e5",
              opacity: !action.primary && sampleCount === 0 ? 0.45 : 1,
            }}
          >
            <Text
              className="text-xs"
              style={{ fontFamily: Pixelify.bold, color: action.primary ? "#fff" : "#171717" }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
