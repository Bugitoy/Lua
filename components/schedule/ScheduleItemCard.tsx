import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";

export type ScheduleItemCardProps = {
  time: string;
  category: string;
  title: string;
  location: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  glowColor: string;
  /** True when the sprite arrived at this location via GPS. */
  locationReached?: boolean;
};

export function ScheduleItemCard({
  time,
  category,
  title,
  location,
  icon,
  gradientColors,
  glowColor,
  locationReached = false,
}: ScheduleItemCardProps) {
  return (
    <View
      className="mb-5 overflow-hidden rounded-2xl bg-white"
      style={{
        opacity: locationReached ? 0.6 : 1,
        shadowColor: locationReached ? "#000" : glowColor,
        shadowOffset: { width: 0, height: locationReached ? 2 : 6 },
        shadowOpacity: locationReached ? 0.06 : 0.38,
        shadowRadius: locationReached ? 4 : 14,
        elevation: locationReached ? 1 : 8,
      }}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View className="min-w-0 flex-1 pr-3">
          <Text
            className="text-neutral-900"
            style={{ fontFamily: Pixelify.bold, fontSize: 18 }}
          >
            {time}
          </Text>
          <Text
            className="text-neutral-800"
            style={{ fontFamily: Pixelify.medium, fontSize: 13, opacity: 0.9 }}
          >
            {category}
          </Text>
        </View>
        <View className="max-w-[48%] items-end gap-1">
          <Text
            className="text-right text-neutral-900"
            style={{ fontFamily: Pixelify.semibold, fontSize: 13, lineHeight: 18 }}
            numberOfLines={3}
          >
            {location}
          </Text>
          {locationReached && (
            <View className="flex-row items-center gap-1 rounded-full bg-green-600/20 px-2 py-0.5">
              <Ionicons name="location" size={10} color="#15803d" />
              <Text style={{ fontFamily: Pixelify.bold, fontSize: 9, color: "#15803d" }}>
                Arrived!
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View className="flex-row items-center gap-3 border-t border-black/5 bg-white px-4 py-3.5">
        <Ionicons name={icon} size={28} color={locationReached ? "#a3a3a3" : "#171717"} />
        <Text
          className="min-w-0 flex-1 text-base leading-snug"
          style={{
            fontFamily: Pixelify.semibold,
            color: locationReached ? "#a3a3a3" : "#171717",
            textDecorationLine: locationReached ? "line-through" : "none",
          }}
          numberOfLines={3}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}
