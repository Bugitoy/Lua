import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GeoMapView } from "@/components/map/GeoMapView";
import { AddScheduleModal } from "@/components/schedule/AddScheduleModal";
import { ScheduleItemCard } from "@/components/schedule/ScheduleItemCard";
import type { ScheduleItemData } from "@/components/schedule/scheduleTypes";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useFusedLocation } from "@/hooks/useFusedLocation";
import { updateGameStats } from "@/lib/gameStats";
import { setScheduledItems, useScheduledItems } from "@/lib/scheduleStore";

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ScheduleItemData[]>([]);
  const scheduledItems = useScheduledItems();
  const { location } = useFusedLocation();

  // Live clock — updates every second
  const [now, setNow] = useState(() => new Date());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Push the schedule into the shared store so the map can render markers
  // and run arrival detection against the same source of truth.
  useEffect(() => {
    setScheduledItems(
      items.map((i) => ({
        id: i.id,
        label: i.location,
        category: i.category,
        latitude: i.latitude,
        longitude: i.longitude,
      })),
    );
  }, [items]);

  // Reactive completion lookup driven by the store (updated by arrival detection).
  const completionById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of scheduledItems) map.set(item.id, item.completed);
    return map;
  }, [scheduledItems]);

  // Mirror schedule progress into the global stats store.
  useEffect(() => {
    const total = items.length;
    const done = scheduledItems.filter((i) => i.completed).length;
    updateGameStats({
      goalsTotal: total,
      goalsDone: done,
      goalDayPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }, [items.length, scheduledItems]);

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

        <View
          className="mb-8 overflow-hidden rounded-2xl"
          style={{ height: 148, backgroundColor: "#e5e5e5" }}
        >
          <GeoMapView
            currentLocation={location}
            destination={null}
            nearbyPlaces={[]}
            scheduledItems={scheduledItems}
            interactive={false}
          />
          <Link href="/" asChild>
            <Pressable
              accessibilityLabel="Open live map"
              style={StyleSheet.absoluteFill}
            >
              <View
                className="absolute inset-0 bg-neutral-900/25"
                pointerEvents="none"
              />
              <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between px-3 py-2">
                <View className="rounded-md bg-black/40 px-2 py-1">
                  <Text
                    className="text-xs text-white"
                    style={{ fontFamily: Pixelify.medium }}
                  >
                    Live map
                  </Text>
                </View>
                <Text
                  className="text-white"
                  style={{
                    fontFamily: Pixelify.bold,
                    fontSize: 32,
                    lineHeight: 32,
                  }}
                >
                  {timeString}
                </Text>
              </View>
            </Pressable>
          </Link>
        </View>

        {items.length === 0 ? (
          <View
            className="items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10"
            style={{ marginBottom: 24 }}
          >
            <Ionicons name="map-outline" size={32} color="#a3a3a3" />
            <Text
              className="mt-3 text-center text-neutral-700"
              style={{ fontFamily: Pixelify.semibold, fontSize: 14 }}
            >
              No goals yet
            </Text>
            <Text
              className="mt-1 text-center text-neutral-500"
              style={{ fontFamily: Pixelify.regular, fontSize: 12 }}
            >
              Tap the + button to add a place. Walking up to it on the live
              map completes the goal.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <ScheduleItemCard
              key={item.id}
              time={item.time}
              category={item.category}
              title={item.title}
              location={item.location}
              icon={item.icon}
              gradientColors={item.gradientColors}
              glowColor={item.glowColor}
              completed={completionById.get(item.id) ?? false}
            />
          ))
        )}
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
        userLocation={
          location
            ? { latitude: location.latitude, longitude: location.longitude }
            : null
        }
      />
    </View>
  );
}
