import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddScheduleModal } from "@/components/schedule/AddScheduleModal";
import { ScheduleItemCard } from "@/components/schedule/ScheduleItemCard";
import type { ScheduleItemData } from "@/components/schedule/scheduleTypes";
import { Pixelify } from "@/constants/fonts";
import { CAMPUS_MAP, LUA_GREEN } from "@/constants/mapAssets";
import { updateGameStats } from "@/lib/gameStats";
import { setScheduledLocations, useCompletedLocations } from "@/lib/scheduleStore";

const INITIAL_SCHEDULE_ITEMS: ScheduleItemData[] = [
  {
    id: "1",
    time: "9:00 am",
    category: "Academic",
    title: "CS 301 - Algorithms",
    location: "Zimmer Hall",
    icon: "school-outline",
    gradientColors: ["#bbf7d0", "#4ade80"],
    glowColor: "#22c55e",
  },
  {
    id: "2",
    time: "11:15 am",
    category: "Meal",
    title: "Meal - Lunch at Dining Hall",
    location: "Center Court Dining Hall",
    icon: "restaurant-outline",
    gradientColors: ["#fed7aa", "#fb923c"],
    glowColor: "#ea580c",
  },
  {
    id: "3",
    time: "12:00 pm",
    category: "Social",
    title: "Social - Meet up with friends at Soccer Field",
    location: "Nippert Stadium",
    icon: "people-outline",
    gradientColors: ["#bfdbfe", "#60a5fa"],
    glowColor: "#2563eb",
  },
];

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ScheduleItemData[]>(INITIAL_SCHEDULE_ITEMS);
  const completedLocations = useCompletedLocations();

  // Live clock — updates every second
  const [now, setNow] = useState(() => new Date());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);
  const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Keep the map store and game stats in sync whenever schedule items change
  useEffect(() => {
    setScheduledLocations(items.map((i) => ({ label: i.location, category: i.category })));
    // goalsTotal = number of schedule items; recompute percentage too
    updateGameStats({
      goalsTotal: items.length,
      goalDayPercent:
        items.length > 0
          ? Math.round((completedLocations.size / items.length) * 100)
          : 0,
    });
  }, [items, completedLocations]);
  const [addOpen, setAddOpen] = useState(false);

  const handleSaveNewItem = useCallback(
    (data: Omit<ScheduleItemData, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setItems((prev) => [...prev, { ...data, id }]);
    },
    [],
  );

  const tabBarClearance = Platform.OS === "ios" ? 88 : 72;
  const fabBottom = insets.bottom + tabBarClearance - 74;

  return (
    <View className="flex-1 bg-neutral-100">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 160,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-start justify-between gap-3">
          <Text
            className="flex-1 text-neutral-900"
            style={{ fontFamily: Pixelify.bold, fontSize: 30, lineHeight: 34 }}
          >
            Today&apos;s Schedule.
          </Text>
          <Link href="/(tabs)/profile" asChild>
            <Pressable accessibilityLabel="Open profile">
              <Image
                source={{ uri: "https://i.pravatar.cc/120?img=12" }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.08)",
                }}
              />
            </Pressable>
          </Link>
        </View>

        <Link href="/" asChild>
          <Pressable
            accessibilityLabel="Open campus map"
            className="mb-8 overflow-hidden rounded-2xl active:opacity-95"
            style={{
              height: 148,
              backgroundColor: "#e5e5e5",
            }}
          >
            <Image
              source={CAMPUS_MAP}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
            <View
              className="absolute inset-0 bg-neutral-600/35"
              pointerEvents="none"
            />
            <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between px-3 py-2">
              <View className="rounded-md bg-black/35 px-2 py-1">
                <Text
                  className="text-xs text-white"
                  style={{ fontFamily: Pixelify.medium }}
                >
                  Campus map
                </Text>
              </View>
              <Text
                className="text-white"
                style={{ fontFamily: Pixelify.bold, fontSize: 32, lineHeight: 32 }}
              >
                {timeString}
              </Text>
            </View>
          </Pressable>
        </Link>

        {items.map((item) => (
          <ScheduleItemCard
            key={item.id}
            time={item.time}
            category={item.category}
            title={item.title}
            location={item.location}
            icon={item.icon}
            gradientColors={item.gradientColors}
            glowColor={item.glowColor}
            locationReached={completedLocations.has(item.location)}
          />
        ))}
      </ScrollView>

      <Pressable
        accessibilityLabel="Add schedule item"
        onPress={() => setAddOpen(true)}
        className="absolute right-6 z-10 size-14 items-center justify-center rounded-full shadow-lg active:opacity-90"
        style={{
          bottom: fabBottom,
          backgroundColor: LUA_GREEN,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      <AddScheduleModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleSaveNewItem}
      />
    </View>
  );
}
