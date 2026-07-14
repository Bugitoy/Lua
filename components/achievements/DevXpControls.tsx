import { Pressable, Text, View } from "react-native";

import { ACH } from "@/components/achievements/theme";
import { XP_STOPS } from "@/components/achievements/unlockRoute";
import { Pixelify } from "@/constants/fonts";
import { clearEquipped, setDevXpBonus } from "@/lib/achievementsStore";

type DevXpControlsProps = {
  /** XP from game stats, before the dev bonus. */
  statsXp: number;
  devXpBonus: number;
};

/** The prototype's demo buttons, for trying unlocks in development builds only. */
export function DevXpControls({ statsXp, devXpBonus }: DevXpControlsProps) {
  const xp = statsXp + devXpBonus;
  const maxXp = XP_STOPS[XP_STOPS.length - 1];
  const actions = [
    { label: "+150 XP", onPress: () => setDevXpBonus(devXpBonus + 150) },
    { label: "+500 XP", onPress: () => setDevXpBonus(devXpBonus + 500) },
    { label: "Max out", onPress: () => setDevXpBonus(devXpBonus + Math.max(0, maxXp - xp)) },
    {
      label: "Reset",
      onPress: () => {
        setDevXpBonus(-statsXp);
        clearEquipped();
      },
    },
  ];

  return (
    <View className="rounded-2xl border border-dashed p-3" style={{ borderColor: ACH.border }}>
      <Text
        className="mb-2 text-center text-[11px] uppercase"
        style={{ fontFamily: Pixelify.semibold, color: ACH.textSecondary, letterSpacing: 0.5 }}
      >
        Dev only · simulate XP
      </Text>
      <View className="flex-row gap-2">
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            className="flex-1 items-center rounded-xl py-2.5 active:opacity-80"
            style={{ backgroundColor: action.label === "Reset" ? ACH.card : ACH.green }}
          >
            <Text
              className="text-xs"
              style={{
                fontFamily: Pixelify.bold,
                color: action.label === "Reset" ? ACH.text : "#ffffff",
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
