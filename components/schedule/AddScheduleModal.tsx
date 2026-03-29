import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  LocationSearchField,
  matchMapStopLocation,
} from "@/components/schedule/LocationSearchField";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

import {
  SCHEDULE_THEME_PRESETS,
  type ScheduleItemData,
  type ScheduleThemeKey,
} from "./scheduleTypes";

type AddScheduleModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (item: Omit<ScheduleItemData, "id">) => void;
};

export function AddScheduleModal({
  visible,
  onClose,
  onSave,
}: AddScheduleModalProps) {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [theme, setTheme] = useState<ScheduleThemeKey>("academic");

  const reset = useCallback(() => {
    setTime("");
    setCategory("");
    setTitle("");
    setLocation("");
    setTheme("academic");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSave = useCallback(() => {
    const t = title.trim();
    if (!t) return;
    const resolved = matchMapStopLocation(location);
    if (!resolved) return;
    const preset = SCHEDULE_THEME_PRESETS[theme];
    onSave({
      time: time.trim() || "—",
      category: category.trim() || "Event",
      title: t,
      location: resolved,
      icon: preset.icon,
      gradientColors: preset.gradientColors,
      glowColor: preset.glowColor,
    });
    reset();
    onClose();
  }, [category, location, onClose, onSave, reset, theme, time, title]);

  const canSave =
    !!title.trim() && matchMapStopLocation(location) !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/45"
      >
        <Pressable className="flex-1" onPress={handleClose} />
        <View
          className="max-h-[92%] rounded-t-3xl bg-white px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text
              className="text-xl text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              New item
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={26} color="#525252" />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              Type
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {(
                [
                  ["academic", "Academic"],
                  ["meal", "Meal"],
                  ["social", "Social"],
                ] as const
              ).map(([key, label]) => {
                const selected = theme === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTheme(key)}
                    className="rounded-full border px-3 py-2 active:opacity-80"
                    style={{
                      borderColor: selected ? LUA_GREEN : "#d4d4d4",
                      backgroundColor: selected
                        ? "rgba(22,163,74,0.12)"
                        : "#fafafa",
                    }}
                  >
                    <Text
                      className="text-sm text-neutral-800"
                      style={{ fontFamily: Pixelify.semibold }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              Time
            </Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 2:30 pm"
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
              style={{ fontFamily: Pixelify.regular }}
            />

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              Category
            </Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Study, Club"
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
              style={{ fontFamily: Pixelify.regular }}
            />

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              Title
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Add a title"
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
              style={{ fontFamily: Pixelify.regular }}
              multiline
            />

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              Location
            </Text>
            <LocationSearchField
              value={location}
              onChange={setLocation}
              active={visible}
            />
            <Text
              className="mb-6 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              Search map stops, then tap one to select.
            </Text>

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className="items-center rounded-xl py-3.5 active:opacity-90"
              style={{
                backgroundColor: LUA_GREEN,
                opacity: canSave ? 1 : 0.45,
              }}
            >
              <Text
                className="text-base text-white"
                style={{ fontFamily: Pixelify.bold }}
              >
                Add to schedule
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
