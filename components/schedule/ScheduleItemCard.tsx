import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

export type ScheduleItemCardProps = {
  time: string;
  category: string;
  title: string;
  location: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  glowColor: string;
  checked: boolean;
  onToggleCheck: () => void;
};

export function ScheduleItemCard({
  time,
  category,
  title,
  location,
  icon,
  gradientColors,
  glowColor,
  checked,
  onToggleCheck,
}: ScheduleItemCardProps) {
  return (
    <View
      className="mb-5 overflow-hidden rounded-2xl bg-white"
      style={{
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.38,
        shadowRadius: 14,
        elevation: 8,
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
        <Text
          className="max-w-[48%] text-right text-neutral-900"
          style={{ fontFamily: Pixelify.semibold, fontSize: 13, lineHeight: 18 }}
          numberOfLines={3}
        >
          {location}
        </Text>
      </LinearGradient>

      <View className="flex-row items-center gap-3 border-t border-black/5 bg-white px-4 py-3.5">
        <Ionicons name={icon} size={28} color="#171717" />
        <Text
          className="min-w-0 flex-1 text-base leading-snug text-neutral-900"
          style={{ fontFamily: Pixelify.semibold }}
          numberOfLines={3}
        >
          {title}
        </Text>
        <Pressable
          onPress={onToggleCheck}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View
            className="items-center justify-center rounded border-2 border-neutral-400"
            style={{
              width: 24,
              height: 24,
              backgroundColor: checked ? LUA_GREEN : "transparent",
              borderColor: checked ? LUA_GREEN : "#a3a3a3",
            }}
          >
            {checked ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
