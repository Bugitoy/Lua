import { Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";

export default function StatsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text
        className="text-lg text-neutral-800"
        style={{ fontFamily: Pixelify.semibold }}
      >
        Stats
      </Text>
      <Text
        className="mt-2 px-8 text-center text-neutral-500"
        style={{ fontFamily: Pixelify.regular }}
      >
        Distance, goals, and sprite health over time.
      </Text>
    </View>
  );
}
