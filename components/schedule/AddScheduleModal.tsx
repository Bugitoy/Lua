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
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NearbyLocationSearchField } from "@/components/schedule/NearbyLocationSearchField";
import { TimeWheelPicker } from "@/components/schedule/TimeWheelPicker";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { formatAppTime } from "@/lib/i18n/formatLocale";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";

import {
    SCHEDULE_THEME_PRESETS,
    type ScheduleItemData,
    type ScheduleThemeKey,
} from "./scheduleTypes";

/** Returns a clean copy of `now` rounded down to the current hour. */
function defaultPickerTime(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

type AddScheduleModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (item: Omit<ScheduleItemData, "id">) => void;
  /** Current user coordinates — used to rank / disambiguate search results. */
  userLocation: { latitude: number; longitude: number } | null;
};

export function AddScheduleModal({
  visible,
  onClose,
  onSave,
  userLocation,
}: AddScheduleModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState<Date | null>(null);
  /** iOS only — the spinner is rendered inline; Android uses an imperative dialog. */
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [picked, setPicked] = useState<NearbyPlace | null>(null);
  const [theme, setTheme] = useState<ScheduleThemeKey>("academic");

  const reset = useCallback(() => {
    setTime(null);
    setShowTimePicker(false);
    setCategory("");
    setTitle("");
    setSearchQuery("");
    setPicked(null);
    setTheme("academic");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const openTimePicker = useCallback(() => {
    // Seed with a sensible default so the wheel doesn't fall on midnight if the
    // user opens and immediately confirms without scrolling.
    if (time == null) setTime(defaultPickerTime());
    setShowTimePicker((prev) => !prev);
  }, [time]);

  const handleSave = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !picked) return;
    const preset = SCHEDULE_THEME_PRESETS[theme];
    onSave({
      time: time
        ? formatAppTime(time, { hour: "numeric", minute: "2-digit" })
        : t("common.emDash"),
      category: category.trim() || t("schedule.addModal.defaultCategory"),
      title: trimmedTitle,
      location: picked.title,
      latitude: picked.latitude,
      longitude: picked.longitude,
      placeId: picked.id,
      icon: preset.icon,
      gradientColors: preset.gradientColors,
      glowColor: preset.glowColor,
    });
    reset();
    onClose();
  }, [category, onClose, onSave, picked, reset, t, theme, time, title]);

  const canSave = !!title.trim() && picked != null;

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
              {t("schedule.addModal.title")}
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
              {t("schedule.addModal.type")}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {(
                [
                  ["academic", "schedule.addModal.types.academic"],
                  ["meal", "schedule.addModal.types.meal"],
                  ["social", "schedule.addModal.types.social"],
                ] as const
              ).map(([key, labelKey]) => {
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
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              {t("schedule.addModal.time")}
            </Text>
            <Pressable
              onPress={openTimePicker}
              className="mb-2 flex-row items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 active:opacity-80"
              style={{
                borderColor: showTimePicker ? LUA_GREEN : "#e5e5e5",
              }}
            >
              <Text
                className="text-base"
                style={{
                  fontFamily: Pixelify.regular,
                  color: time ? "#171717" : "#a3a3a3",
                }}
              >
                {time
                  ? formatAppTime(time, { hour: "numeric", minute: "2-digit" })
                  : t("schedule.addModal.timePlaceholder")}
              </Text>
              <Ionicons
                name={showTimePicker ? "chevron-up" : "chevron-down"}
                size={18}
                color={showTimePicker ? LUA_GREEN : "#737373"}
              />
            </Pressable>
            {showTimePicker ? (
              <View className="mb-2">
                <TimeWheelPicker
                  value={time ?? defaultPickerTime()}
                  onChange={setTime}
                />
                <Pressable
                  onPress={() => setShowTimePicker(false)}
                  className="mt-2 items-center rounded-xl py-2.5 active:opacity-90"
                  style={{ backgroundColor: LUA_GREEN }}
                >
                  <Text
                    className="text-sm text-white"
                    style={{ fontFamily: Pixelify.bold }}
                  >
                    {t("common.done")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <View className="mb-4" />

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              {t("schedule.addModal.category")}
            </Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder={t("schedule.addModal.categoryPlaceholder")}
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
              style={{ fontFamily: Pixelify.regular }}
            />

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              {t("schedule.addModal.titleLabel")}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("schedule.addModal.titlePlaceholder")}
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
              style={{ fontFamily: Pixelify.regular }}
              multiline
            />

            <Text
              className="mb-1.5 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.medium }}
            >
              {t("schedule.addModal.location")}
            </Text>
            <NearbyLocationSearchField
              value={searchQuery}
              onChangeQuery={setSearchQuery}
              onPick={(place) => {
                setPicked(place);
                setSearchQuery(place.title);
              }}
              userLocation={userLocation}
              active={visible}
              pickedTitle={picked?.title ?? null}
              onClearPick={() => setPicked(null)}
            />
            <Text
              className="mb-6 text-xs text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              {t("schedule.addModal.locationSearchHint")}
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
                {t("schedule.addModal.addButton")}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
