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

import { HomeAddressPrompt } from "@/components/schedule/HomeAddressPrompt";
import { MapLocationPicker } from "@/components/schedule/MapLocationPicker";
import { NearbyLocationSearchField } from "@/components/schedule/NearbyLocationSearchField";
import {
  DEFAULT_REPEAT_CHOICE,
  RepeatField,
  ruleFromChoice,
  type RepeatChoice,
} from "@/components/schedule/RepeatField";
import { ChoicePrompt } from "@/components/schedule/ChoicePrompt";
import { RepeatUntilPicker } from "@/components/schedule/RepeatUntilPicker";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { TimeWheelPicker } from "@/components/schedule/TimeWheelPicker";
import { AppAlertHost } from "@/components/settings/AppAlertHost";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { closeAppAlert, useAppAlert } from "@/lib/appAlert";
import { startOfDay } from "@/lib/dayKey";
import { haversineMeters } from "@/lib/geo";
import { HOME_PLACE_ID, homeAsPlace } from "@/lib/homeAddress";
import { formatAppDate, formatAppTime } from "@/lib/i18n/formatLocale";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";
import { useProfile, type HomeAddress } from "@/lib/profileStore";
import { presetOf, type RepeatRule } from "@/lib/repeatRule";
import type { GoalDraft, RepeatScope } from "@/lib/scheduleActions";
import { TOO_CLOSE_GOAL_METERS } from "@/lib/walkingRules";

import { SCHEDULE_THEME_PRESETS, type ScheduleThemeKey } from "./scheduleTypes";

/** Returns a clean copy of `now` with seconds cleared. */
function defaultPickerTime(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

function timeFromMinutes(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/** "Sat, Nov 14" */
function shortDate(day: string): string {
  return formatAppDate(startOfDay(day), { weekday: "short", month: "short", day: "numeric" });
}

function choiceFromRule(rule: RepeatRule | null): RepeatChoice {
  const preset = presetOf(rule);
  if (preset === "custom" && rule && rule.unit !== "weekdays") {
    return { preset, every: rule.every, unit: rule.unit };
  }
  return { ...DEFAULT_REPEAT_CHOICE, preset };
}

type FieldKey = "when" | "title" | "note" | "location";

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
  /** `scope` is "this" only when editing one day of a repeating goal and that was chosen. */
  onSave: (draft: GoalDraft, scope: RepeatScope) => void;
  /** Current user coordinates — used to rank / disambiguate search results. */
  userLocation: { latitude: number; longitude: number } | null;
  today: string;
  /** The day a new goal starts on: the day chosen on the calendar. */
  defaultDay: string;
  /** The goal being edited, or null for a new goal. */
  editing?: GoalDraft | null;
  /** Keeps the date fixed while editing (a repeating goal). */
  lockDate?: boolean;
  /** Editing one day of a repeating goal: ask "This goal only / This and future goals" on save. */
  askScope?: boolean;
};

export function AddScheduleModal({
  visible,
  onClose,
  onSave,
  userLocation,
  today,
  defaultDay,
  editing = null,
  lockDate = false,
  askScope = false,
}: AddScheduleModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const appAlert = useAppAlert();
  const [day, setDay] = useState(defaultDay);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState<Date | null>(null);
  /** Time text of an edited goal saved before times were stored as minutes. */
  const [fallbackTime, setFallbackTime] = useState<string | null>(null);
  /** iOS only — the spinner is rendered inline; Android uses an imperative dialog. */
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [picked, setPicked] = useState<NearbyPlace | null>(null);
  const [theme, setTheme] = useState<ScheduleThemeKey>("academic");
  const [repeat, setRepeat] = useState<RepeatChoice>(DEFAULT_REPEAT_CHOICE);
  /** Last day of a repeating goal; null repeats forever. */
  const [until, setUntil] = useState<string | null>(null);
  const [untilPickerOpen, setUntilPickerOpen] = useState(false);
  /** "This goal only / This and future goals" is open, for saving at `place`. */
  const [scopePrompt, setScopePrompt] = useState<{ place: NearbyPlace } | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  /** "Set your home address" is open; `saveAfter` adds the goal once the home is saved. */
  const [homePrompt, setHomePrompt] = useState<{ saveAfter: boolean } | null>(null);

  const { profile } = useProfile();
  const homeLabel = t("schedule.search.home");
  const homePlace = profile.home ? homeAsPlace(profile.home, homeLabel) : null;

  const keyboardHeight = useKeyboardHeight();
  /** Overlay height with the keyboard hidden vs now — detects if the OS already resized the window. */
  const [baseHeight, setBaseHeight] = useState(0);
  const [rootHeight, setRootHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
  const focusedField = useRef<FieldKey | null>(null);

  // Fill the form each time the sheet opens: the edited goal, or a blank goal on the chosen day.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      if (editing) {
        const { fields } = editing;
        setDay(editing.day);
        setTheme(fields.themeKey);
        setTime(fields.minutes != null ? timeFromMinutes(fields.minutes) : null);
        setFallbackTime(fields.minutes == null ? fields.time : null);
        setTitle(fields.title);
        setNote(fields.note ?? "");
        setPicked({
          id: fields.placeId ?? `${fields.latitude},${fields.longitude}`,
          title: fields.location,
          latitude: fields.latitude,
          longitude: fields.longitude,
        });
        setSearchQuery(fields.location);
        setRepeat(choiceFromRule(editing.repeat));
        setUntil(editing.until);
      } else {
        setDay(defaultDay);
      }
    }
    wasVisible.current = visible;
  }, [visible, editing, defaultDay]);

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
      setShowDatePicker(false);
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
    setDay(defaultDay);
    setShowDatePicker(false);
    setTime(null);
    setFallbackTime(null);
    setShowTimePicker(false);
    setTitle("");
    setNote("");
    setSearchQuery("");
    setPicked(null);
    setTheme("academic");
    setRepeat(DEFAULT_REPEAT_CHOICE);
    setUntil(null);
    setUntilPickerOpen(false);
    setScopePrompt(null);
    setMapPickerOpen(false);
    setHomePrompt(null);
  }, [defaultDay]);

  const openMapPicker = useCallback(() => {
    Keyboard.dismiss();
    setShowTimePicker(false);
    setShowDatePicker(false);
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

  const openDatePicker = useCallback(() => {
    Keyboard.dismiss();
    setShowTimePicker(false);
    focusedField.current = "when";
    if (!showDatePicker) setTimeout(() => scrollToField("when"), 50);
    setShowDatePicker((prev) => !prev);
  }, [scrollToField, showDatePicker]);

  const openTimePicker = useCallback(() => {
    // Seed with a sensible default so the wheel doesn't fall on midnight if the
    // user opens and immediately confirms without scrolling.
    if (time == null) setTime(defaultPickerTime());
    // The wheel isn't a text input, so close any open keyboard that would cover it.
    Keyboard.dismiss();
    setShowDatePicker(false);
    focusedField.current = "when";
    if (!showTimePicker) setTimeout(() => scrollToField("when"), 50);
    setShowTimePicker((prev) => !prev);
  }, [scrollToField, showTimePicker, time]);

  /** The end day that would be saved: dropped when it falls before the goal's first day. */
  const goalDay = day < today ? today : day;
  const savedRule = ruleFromChoice(repeat);
  const savedUntil = savedRule && until && until >= goalDay ? until : null;

  /** Saves the goal at `place`. */
  const saveAt = useCallback((place: NearbyPlace, scope: RepeatScope = "future") => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const preset = SCHEDULE_THEME_PRESETS[theme];
    const trimmedNote = note.trim();
    onSave({
      day: goalDay,
      repeat: savedRule,
      until: savedUntil,
      fields: {
        themeKey: theme,
        time: time
          ? formatAppTime(time, { hour: "numeric", minute: "2-digit" })
          : (fallbackTime ?? t("common.emDash")),
        minutes: time ? time.getHours() * 60 + time.getMinutes() : null,
        title: trimmedTitle,
        // Always set, so clearing the note while editing removes it.
        note: trimmedNote || undefined,
        location: place.title,
        latitude: place.latitude,
        longitude: place.longitude,
        placeId: place.id,
        icon: preset.icon,
        gradientColors: preset.gradientColors,
        glowColor: preset.glowColor,
      },
    }, scope);
    reset();
    onClose();
  }, [fallbackTime, goalDay, note, onClose, onSave, reset, savedRule, savedUntil, t, theme, time, title]);

  /**
   * One day of a repeating goal asks which days change. A new repeat rule or
   * end day can only apply going forward, so then it doesn't ask.
   */
  const repeatChanged =
    editing != null &&
    (JSON.stringify(savedRule) !== JSON.stringify(editing.repeat) || savedUntil !== editing.until);
  const saveOrAsk = useCallback(
    (place: NearbyPlace) => {
      if (askScope && !repeatChanged) {
        Keyboard.dismiss();
        setScopePrompt({ place });
      } else {
        saveAt(place);
      }
    },
    [askScope, repeatChanged, saveAt],
  );

  /** A goal with no place is set at home; with no home yet, ask for one first. */
  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    const place = picked ?? homePlace;
    if (place) {
      saveOrAsk(place);
      return;
    }
    Keyboard.dismiss();
    setHomePrompt({ saveAfter: true });
  }, [homePlace, picked, saveOrAsk, title]);

  /** The Home button: use the saved home, or ask for one. */
  const pickHome = useCallback(() => {
    if (homePlace) {
      setPicked(homePlace);
      setSearchQuery(homePlace.title);
      return;
    }
    Keyboard.dismiss();
    setHomePrompt({ saveAfter: false });
  }, [homePlace]);

  const handleHomeSaved = useCallback(
    (home: HomeAddress) => {
      const place = homeAsPlace(home, homeLabel);
      const saveAfter = homePrompt?.saveAfter ?? false;
      setHomePrompt(null);
      if (saveAfter) {
        saveAt(place);
      } else {
        setPicked(place);
        setSearchQuery(place.title);
      }
    },
    [homeLabel, homePrompt, saveAt],
  );

  const canSave = !!title.trim();
  const repeatRule = ruleFromChoice(repeat);
  /** Where the goal will be: the picked place, or home when none is picked. */
  const goalPlace = picked ?? homePlace;
  const pickedIsHome = picked?.id === HOME_PLACE_ID;
  /** A goal right where the user stands completes without walking, so it won't pay XP. */
  const pickedTooClose =
    day === today &&
    goalPlace != null &&
    userLocation != null &&
    haversineMeters(userLocation, goalPlace) <= TOO_CLOSE_GOAL_METERS;

  const timeText = time
    ? formatAppTime(time, { hour: "numeric", minute: "2-digit" })
    : fallbackTime;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={
        appAlert
          ? closeAppAlert
          : mapPickerOpen
          ? () => setMapPickerOpen(false)
          : homePrompt
            ? () => setHomePrompt(null)
            : untilPickerOpen
              ? () => setUntilPickerOpen(false)
              : scopePrompt
                ? () => setScopePrompt(null)
              : handleClose
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
                {t(editing ? "schedule.addModal.editTitle" : "schedule.addModal.title")}
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
              <FieldLabel>{t("schedule.addModal.type")}</FieldLabel>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {(
                  [
                    // One green for every type, matching the goal cards.
                    ["academic", "schedule.addModal.types.academic", LUA_GREEN],
                    ["meal", "schedule.addModal.types.meal", LUA_GREEN],
                    ["social", "schedule.addModal.types.social", LUA_GREEN],
                  ] as const
                ).map(([key, labelKey, accent]) => {
                  const selected = theme === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setTheme(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className="rounded-lg border px-2.5 py-1.5 active:opacity-80"
                      style={{
                        borderColor: selected ? accent : "#d4d4d4",
                        backgroundColor: selected ? `${accent}1F` : "#fafafa",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Pixelify.semibold,
                          fontSize: 13,
                          color: selected ? accent : "#262626",
                        }}
                      >
                        {t(labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Date and time side by side */}
              <View className="mb-2 flex-row gap-3" onLayout={recordFieldY("when")}>
                <View className="min-w-0 flex-1">
                  <FieldLabel>{t("schedule.addModal.date")}</FieldLabel>
                  <SelectButton
                    text={formatAppDate(startOfDay(day), { weekday: "short", month: "short", day: "numeric" })}
                    open={showDatePicker}
                    disabled={lockDate}
                    onPress={openDatePicker}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <FieldLabel>{t("schedule.addModal.time")}</FieldLabel>
                  <SelectButton
                    text={timeText}
                    placeholder={t("schedule.addModal.timePlaceholder")}
                    open={showTimePicker}
                    onPress={openTimePicker}
                  />
                </View>
              </View>
              {showDatePicker ? (
                <View className="mb-2">
                  <ScheduleCalendar
                    monthOnly
                    selectedDay={day}
                    today={today}
                    minDay={today}
                    onSelectDay={(next) => {
                      setDay(next);
                      setShowDatePicker(false);
                    }}
                  />
                </View>
              ) : null}
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
              <View className="mb-2" />

              <FieldLabel onLayout={recordFieldY("title")}>{t("schedule.addModal.titleLabel")}</FieldLabel>
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

              <FieldLabel onLayout={recordFieldY("note")}>{t("schedule.addModal.note")}</FieldLabel>
              <TextInput
                value={note}
                onChangeText={setNote}
                onFocus={() => focusField("note")}
                placeholder={t("schedule.addModal.notePlaceholder")}
                placeholderTextColor="#a3a3a3"
                className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
                style={{ fontFamily: Pixelify.regular }}
                multiline
              />

              <FieldLabel onLayout={recordFieldY("location")}>{t("schedule.addModal.location")}</FieldLabel>
              <NearbyLocationSearchField
                value={searchQuery}
                onChangeQuery={setSearchQuery}
                onPick={(place) => {
                  setPicked(place);
                  setSearchQuery(place.title);
                }}
                userLocation={userLocation}
                active={visible && homePrompt == null}
                pickedTitle={picked?.title ?? null}
                onClearPick={() => setPicked(null)}
                onFocus={() => focusField("location")}
                offerHome
                compact
                trailing={
                  <>
                    <Pressable
                      onPress={openMapPicker}
                      accessibilityRole="button"
                      accessibilityLabel={t("schedule.addModal.pickOnMap")}
                      className="w-[52px] items-center justify-center rounded-xl border active:opacity-80"
                      style={{
                        borderColor: LUA_GREEN,
                        backgroundColor: "rgba(22,163,74,0.08)",
                      }}
                    >
                      <Ionicons name="map-outline" size={20} color={LUA_GREEN} />
                    </Pressable>
                    <Pressable
                      onPress={pickHome}
                      accessibilityRole="button"
                      accessibilityLabel={t("schedule.addModal.useHome")}
                      accessibilityState={{ selected: pickedIsHome }}
                      className="w-[52px] items-center justify-center rounded-xl border active:opacity-80"
                      style={{
                        borderColor: pickedIsHome ? LUA_GREEN : "#e5e5e5",
                        backgroundColor: pickedIsHome ? "rgba(22,163,74,0.08)" : "#fafafa",
                      }}
                    >
                      <Ionicons
                        name={pickedIsHome ? "home" : "home-outline"}
                        size={20}
                        color={pickedIsHome ? LUA_GREEN : "#525252"}
                      />
                    </Pressable>
                  </>
                }
              />
              <View className="mb-3" />
              {pickedTooClose ? (
                <View
                  className="-mt-1 mb-4 flex-row items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: "rgba(245,158,11,0.12)" }}
                >
                  <Ionicons name="walk-outline" size={16} color="#b45309" />
                  <Text
                    className="flex-1 text-xs"
                    style={{ fontFamily: Pixelify.medium, color: "#92400e" }}
                  >
                    {t("schedule.addModal.tooCloseWarning")}
                  </Text>
                </View>
              ) : null}

              <RepeatField
                value={repeat}
                onChange={setRepeat}
                until={until && until >= day ? until : null}
                onPressUntil={() => {
                  Keyboard.dismiss();
                  setUntilPickerOpen(true);
                }}
              />

              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                className="mt-5 items-center rounded-xl py-3.5 active:opacity-90"
                style={{
                  backgroundColor: LUA_GREEN,
                  opacity: canSave ? 1 : 0.45,
                }}
              >
                <Text
                  className="text-base text-white"
                  style={{ fontFamily: Pixelify.bold }}
                >
                  {t(editing ? "schedule.addModal.saveButton" : "schedule.addModal.addButton")}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
          {homePrompt ? (
            <HomeAddressPrompt
              userLocation={userLocation}
              bottomInset={keyboardOverlap}
              onCancel={() => setHomePrompt(null)}
              onSaved={handleHomeSaved}
            />
          ) : null}
          {scopePrompt ? (
            <ChoicePrompt
              icon="create-outline"
              tone="primary"
              title={t("schedule.scope.editTitle")}
              message={t("schedule.scope.editMessage", { title: title.trim() })}
              onCancel={() => setScopePrompt(null)}
              choices={[
                {
                  label: t("schedule.remove.thisOnly"),
                  detail: t("schedule.scope.onlyDay", { date: shortDate(goalDay) }),
                  tone: "neutral",
                  onPress: () => saveAt(scopePrompt.place, "this"),
                },
                {
                  label: t("schedule.remove.thisAndFuture"),
                  detail: t("schedule.scope.fromDay", { date: shortDate(goalDay) }),
                  tone: "primary",
                  onPress: () => saveAt(scopePrompt.place, "future"),
                },
              ]}
            />
          ) : null}
          {untilPickerOpen && repeatRule ? (
            <RepeatUntilPicker
              startDay={day}
              rule={repeatRule}
              value={until && until >= day ? until : null}
              onCancel={() => setUntilPickerOpen(false)}
              onConfirm={(next) => {
                setUntil(next);
                setUntilPickerOpen(false);
              }}
            />
          ) : null}
          {/* Alerts raised while the sheet is open (e.g. by the home prompt) draw here, above it. */}
          <AppAlertHost />
        </View>
      )}
    </Modal>
  );
}

function FieldLabel({
  children,
  onLayout,
}: {
  children: string;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Text
      className="mb-1.5 text-xs text-neutral-500"
      style={{ fontFamily: Pixelify.medium }}
      onLayout={onLayout}
    >
      {children}
    </Text>
  );
}

/** A dropdown-style field (Date, Time) that opens a picker below the row. */
function SelectButton({
  text,
  placeholder,
  open,
  disabled = false,
  onPress,
}: {
  text: string | null;
  placeholder?: string;
  open: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled }}
      className="flex-row items-center justify-between rounded-xl border px-3.5 py-3.5 active:opacity-80"
      style={{
        borderColor: open ? LUA_GREEN : "#e5e5e5",
        backgroundColor: open ? "rgba(22,163,74,0.08)" : "#fafafa",
      }}
    >
      <Text
        className="shrink"
        numberOfLines={1}
        style={{
          fontFamily: Pixelify.regular,
          fontSize: 15,
          color: disabled ? "#737373" : text ? "#171717" : "#a3a3a3",
        }}
      >
        {text ?? placeholder}
      </Text>
      {!disabled && (
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={open ? LUA_GREEN : "#737373"}
        />
      )}
    </Pressable>
  );
}
