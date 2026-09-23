import { Pressable, Text, View } from "react-native";

import { ACH } from "@/components/achievements/theme";
import { XP_STOPS } from "@/components/achievements/unlockRoute";
import { Pixelify } from "@/constants/fonts";
import { resetLook, setDevXpBonus } from "@/lib/achievementsStore";

type DevXpControlsProps = {
  /** XP from game stats, before the dev bonus. */
  statsXp: number;
  devXpBonus: number;
};

/** The prototype's demo buttons, for trying unlocks without playing lessons. */
export function DevXpControls({ statsXp, devXpBonus }: DevXpControlsProps) {
  const xp = statsXp + devXpBonus;
  const maxXp = XP_STOPS[XP_STOPS.length - 1];
  const secondary = [
    { label: "+1,000 XP", onPress: () => setDevXpBonus(devXpBonus + 1000) },
    { label: "Max out", onPress: () => setDevXpBonus(devXpBonus + Math.max(0, maxXp - xp)) },
    {
      label: "Reset",
      onPress: () => {
        setDevXpBonus(-statsXp);
        resetLook();
      },
    },
  ];

  return (
    <View className="gap-2">
      <Text
        className="text-center text-[11px]"
        style={{ fontFamily: Pixelify.medium, color: ACH.textSecondary, letterSpacing: 0.3 }}
      >
        Dev only: simulate earning XP
      </Text>
      <Pressable
        onPress={() => setDevXpBonus(devXpBonus + 150)}
        className="items-center justify-center rounded-xl active:opacity-80"
        style={{ height: 48, backgroundColor: ACH.green }}
      >
        <Text
          className="text-[13px] uppercase text-white"
          style={{ fontFamily: Pixelify.bold, letterSpacing: 1 }}
        >
          +150 XP · Finish a lesson
        </Text>
      </Pressable>
      <View className="flex-row gap-2">
        {secondary.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            className="flex-1 items-center justify-center rounded-xl border active:opacity-70"
            style={{ height: 38, backgroundColor: ACH.card, borderColor: ACH.border }}
          >
            <Text className="text-xs" style={{ fontFamily: Pixelify.semibold, color: ACH.text }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
