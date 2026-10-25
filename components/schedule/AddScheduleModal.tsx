import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Keyboard,
    type LayoutChangeEvent,
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

import { MapLocationPicker } from "@/components/schedule/MapLocationPicker";
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

type FieldKey = "time" | "category" | "title" | "location";

/**
 * Height of the on-screen keyboard. Android runs edge-to-edge, so the modal
 * window is not resized for the keyboard and we have to make room ourselves.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
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
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const keyboardHeight = useKeyboardHeight();
  /** Overlay height with the keyboard hidden vs now — detects if the OS already resized the window. */
  const [baseHeight, setBaseHeight] = useState(0);
  const [rootHeight, setRootHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
  const focusedField = useRef<FieldKey | null>(null);

  const onRootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setRootHeight(h);
      if (keyboardHeight === 0) setBaseHeight(h);
    },
    [keyboardHeight],
  );

  // Only pad for the part of the keyboard the window didn't already shrink away from.
  const keyboardOverlap = Math.max(
    0,
    keyboardHeight - Math.max(0, baseHeight - rootHeight),
  );

  const recordFieldY = useCallback(
    (key: FieldKey) => (e: LayoutChangeEvent) => {
      fieldY.current[key] = e.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToField = useCallback((key: FieldKey) => {
    const y = fieldY.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, []);

  const focusField = useCallback(
    (key: FieldKey) => {
      focusedField.current = key;
      scrollToField(key);
    },
    [scrollToField],
  );

  // Once the keyboard opens and the sheet has re-laid out, bring the focused field back into view.
  useEffect(() => {
    if (keyboardOverlap <= 0 || !focusedField.current) return;
    const key = focusedField.current;
    const handle = setTimeout(() => scrollToField(key), 50);
    return () => clearTimeout(handle);
  }, [keyboardOverlap, scrollToField]);

  const reset = useCallback(() => {
    setTime(null);
    setShowTimePicker(false);
    setCategory("");
    setTitle("");
    setSearchQuery("");
    setPicked(null);
    setTheme("academic");
    setMapPickerOpen(false);
  }, []);

  const openMapPicker = useCallback(() => {
    Keyboard.dismiss();
    setShowTimePicker(false);
    setMapPickerOpen(true);
  }, []);

  const handleMapPick = useCallback((place: NearbyPlace) => {
    setPicked(place);
    setSearchQuery(place.title);
    setMapPickerOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const openTimePicker = useCallback(() => {
    // Seed with a sensible default so the wheel doesn't fall on midnight if the
    // user opens and immediately confirms without scrolling.
    if (time == null) setTime(defaultPickerTime());
    // The wheel isn't a text input, so close any open keyboard that would cover it.
    Keyboard.dismiss();
    focusedField.current = "time";
    if (!showTimePicker) setTimeout(() => scrollToField("time"), 50);
    setShowTimePicker((prev) => !prev);
  }, [scrollToField, showTimePicker, time]);

  const handleSave = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !picked) return;
    const preset = SCHEDULE_THEME_PRESETS[theme];
    onSave({
      themeKey: theme,
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
      onRequestClose={
        mapPickerOpen ? () => setMapPickerOpen(false) : handleClose
      }
    >
      {mapPickerOpen ? (
        <MapLocationPicker
          initial={
            picked
              ? { latitude: picked.latitude, longitude: picked.longitude }
              : userLocation
          }
          userLocation={userLocation}
          onCancel={() => setMapPickerOpen(false)}
          onConfirm={handleMapPick}
        />
      ) : (
        <View
          className="flex-1 justify-end bg-black/45"
          onLayout={onRootLayout}
        >
          <Pressable className="flex-1" onPress={handleClose} />
          <View
            className="max-h-[92%] rounded-t-3xl bg-white px-5 pt-4"
            style={{
              paddingBottom:
                keyboardOverlap > 0
                  ? keyboardOverlap + 12
                  : Math.max(insets.bottom, 16) + 12,
            }}
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
              ref={scrollRef}
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
                onLayout={recordFieldY("time")}
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
                    ? formatAppTime(time, {
                        hour: "numeric",
                        minute: "2-digit",
                      })
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
                onLayout={recordFieldY("category")}
              >
                {t("schedule.addModal.category")}
              </Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                onFocus={() => focusField("category")}
                placeholder={t("schedule.addModal.categoryPlaceholder")}
                placeholderTextColor="#a3a3a3"
                className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
                style={{ fontFamily: Pixelify.regular }}
              />

              <Text
                className="mb-1.5 text-xs text-neutral-500"
                style={{ fontFamily: Pixelify.medium }}
                onLayout={recordFieldY("title")}
              >
                {t("schedule.addModal.titleLabel")}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                onFocus={() => focusField("title")}
                placeholder={t("schedule.addModal.titlePlaceholder")}
                placeholderTextColor="#a3a3a3"
                className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
                style={{ fontFamily: Pixelify.regular }}
                multiline
              />

              <Text
                className="mb-1.5 text-xs text-neutral-500"
                style={{ fontFamily: Pixelify.medium }}
                onLayout={recordFieldY("location")}
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
                onFocus={() => focusField("location")}
              />
              <Pressable
                onPress={openMapPicker}
                className="mb-2 flex-row items-center self-start rounded-full border px-3 py-2 active:opacity-80"
                style={{
                  borderColor: LUA_GREEN,
                  backgroundColor: "rgba(22,163,74,0.08)",
                }}
              >
                <Ionicons name="map-outline" size={16} color={LUA_GREEN} />
                <Text
                  className="ml-1.5 text-sm"
                  style={{ fontFamily: Pixelify.semibold, color: LUA_GREEN }}
                >
                  {t("schedule.addModal.pickOnMap")}
                </Text>
              </Pressable>
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
        </View>
      )}
    </Modal>
  );
}
