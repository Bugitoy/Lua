import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

type MapHealthBarCardProps = {
  healthRatio: number;
};

export function MapHealthBarCard({ healthRatio }: MapHealthBarCardProps) {
  return (
    <View className="mt-2 items-center px-4" pointerEvents="auto">
      <View
        className="w-full max-w-[340px] rounded-2xl bg-white p-3"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text
          className="text-left text-sm text-neutral-800"
          style={{ fontFamily: Pixelify.bold }}
        >
          Health Bar
        </Text>
        <View className="mt-1 h-4 overflow-hidden rounded-full bg-neutral-200">
          <LinearGradient
            colors={[LUA_GREEN, "#eab308"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              height: "100%",
              width: `${healthRatio * 100}%`,
              borderRadius: 999,
            }}
          />
        </View>
      </View>
    </View>
  );
}
