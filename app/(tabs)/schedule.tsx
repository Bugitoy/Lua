import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GeoMapView } from "@/components/map/GeoMapView";
import { MySpriteAvatar } from "@/components/profile/SpriteAvatar";
import { AddScheduleModal } from "@/components/schedule/AddScheduleModal";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { ScheduleItemCard, type GoalCardStatus } from "@/components/schedule/ScheduleItemCard";
import {
  SCHEDULE_THEME_PRESETS,
  type GoalFields,
  type ScheduleThemeKey,
} from "@/components/schedule/scheduleTypes";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useLocation } from "@/hooks/useLocation";
import { dayKey, startOfDay } from "@/lib/dayKey";
import { useDayHistory } from "@/lib/dayHistory";
import { getGoalPlan, planFields, planOccursOn, plansOn, useGoalPlans } from "@/lib/goalPlans";
import { formatAppDate, formatAppTime } from "@/lib/i18n/formatLocale";
import {
  addGoal,
  editGoal,
  isRepeating,
  removeGoal,
  type GoalDraft,
  type GoalTarget,
} from "@/lib/scheduleActions";
import { useScheduledItems, type ScheduledItem } from "@/lib/scheduleStore";

/** Past days are read-only, today is live, later days hold planned goals. */
type DayKind = "past" | "today" | "future";

type GoalCard = {
  key: string;
  time: string;
  title: string;
  location: string;
  note?: string;
  themeKey: ScheduleThemeKey;
  repeating: boolean;
  status: GoalCardStatus;
  /** Null for a past day's goal, which can't change. */
  target: GoalTarget | null;
};

const STATUS_DOT: Record<DayKind, string> = {
  past: "#a3a3a3",
  today: LUA_GREEN,
  future: "#f59e0b",
};

function itemFields(item: ScheduledItem): GoalFields {
  const {
    id: _id,
    label: _label,
    completed: _completed,
    completedAtMs: _completedAtMs,
    seriesId: _seriesId,
    ...fields
  } = item;
  return fields;
}

/** The sheet's starting values for a goal being edited. */
function draftFor(target: GoalTarget, today: string): GoalDraft {
  if (target.kind === "planned") {
    return { fields: planFields(target.plan), day: target.day, repeat: target.plan.repeat };
  }
  const { item } = target;
  const series = item.seriesId ? getGoalPlan(item.seriesId) : undefined;
  return { fields: itemFields(item), day: today, repeat: series?.repeat ?? null };
}

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scheduledItems = useScheduledItems();
  const plans = useGoalPlans();
  const history = useDayHistory();
  // The map tab already tracks the user; this one only needs a position while it
  // is showing, and no compass for the small preview map.
  const isFocused = useIsFocused();
  const { location } = useLocation({ enabled: isFocused });

  /** Stable reference — inline `{ lat, lng }` changes every parent render and was resetting search debounce every second (live clock). */
  const lat = location?.latitude;
  const lng = location?.longitude;
  const userLocationForSearch = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  // Live clock — shows hours and minutes, so it ticks on each minute boundary
  // instead of re-rendering the whole screen every second.
  const [now, setNow] = useState(() => new Date());
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleTick = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      tickRef.current = setTimeout(() => {
        setNow(new Date());
        scheduleTick();
      }, msToNextMinute);
    };
    scheduleTick();
    return () => {
      if (tickRef.current) clearTimeout(tickRef.current);
    };
  }, []);
  const timeString = formatAppTime(now, {
    hour: "2-digit",
    minute: "2-digit",
  });

  // The clock also moves "today" on at midnight.
  const today = dayKey(now);
  /** The day picked on the calendar; null follows today. */
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const selectedDay = pickedDay ?? today;
  const kind: DayKind = selectedDay < today ? "past" : selectedDay === today ? "today" : "future";
  const selectDay = useCallback(
    (day: string) => setPickedDay(day === today ? null : day),
    [today],
  );

  const countFor = useCallback(
    (day: string) => {
      if (day < today) return history[day]?.goals.length ?? 0;
      if (day === today) return scheduledItems.length;
      let count = 0;
      for (const plan of plans) if (planOccursOn(plan, day)) count++;
      return count;
    },
    [history, plans, scheduledItems, today],
  );

  const cards = useMemo((): GoalCard[] => {
    if (kind === "past") {
      return (history[selectedDay]?.goals ?? []).map((goal) => ({
        key: goal.id,
        time: goal.time,
        title: goal.title,
        location: goal.location,
        note: goal.note,
        themeKey: goal.themeKey,
        repeating: goal.repeating === true,
        status: goal.completed ? "done" : "missed",
        target: null,
      }));
    }
    if (kind === "today") {
      return scheduledItems.map((item) => ({
        key: item.id,
        time: item.time,
        title: item.title,
        location: item.location,
        note: item.note,
        themeKey: item.themeKey,
        repeating: !!item.seriesId,
        status: item.completed ? "complete" : "pending",
        target: { kind: "today", item },
      }));
    }
    return plansOn(selectedDay, plans).map((plan) => ({
      key: `${plan.id}@${selectedDay}`,
      time: plan.time,
      title: plan.title,
      location: plan.location,
      note: plan.note,
      themeKey: plan.themeKey,
      repeating: plan.repeat != null,
      status: "planned",
      target: { kind: "planned", plan, day: selectedDay },
    }));
  }, [history, kind, plans, scheduledItems, selectedDay]);

  const doneCount = cards.filter((c) => c.status === "complete" || c.status === "done").length;
  const statusDetail =
    cards.length === 0
      ? t("schedule.status.empty")
      : kind === "future"
        ? t("schedule.status.goals", { count: cards.length })
        : t("schedule.status.done", { done: doneCount, total: cards.length });

  // ─── New goal / edit sheet ──────────────────────────────────────────────────

  const [sheetOpen, setSheetOpen] = useState(false);
  /** Kept after closing so the sheet doesn't change while it slides away. */
  const [sheetTarget, setSheetTarget] = useState<GoalTarget | null>(null);
  const [sheetDraft, setSheetDraft] = useState<GoalDraft | null>(null);

  const openNewGoal = useCallback(() => {
    setSheetTarget(null);
    setSheetDraft(null);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback(
    (target: GoalTarget) => {
      setSheetTarget(target);
      setSheetDraft(draftFor(target, today));
      setSheetOpen(true);
    },
    [today],
  );

  const handleSave = useCallback(
    (draft: GoalDraft) => {
      if (sheetTarget) editGoal(sheetTarget, draft, today);
      else addGoal(draft, today);
      // Show the day the goal landed on.
      selectDay(draft.day);
    },
    [selectDay, sheetTarget, today],
  );

  const confirmRemove = useCallback(
    (target: GoalTarget, title: string) => {
      const cancel = { text: t("common.cancel"), style: "cancel" as const };
      if (isRepeating(target)) {
        Alert.alert(t("schedule.remove.title"), t("schedule.remove.repeatMessage", { title }), [
          cancel,
          { text: t("schedule.remove.thisOnly"), onPress: () => removeGoal(target, "this", today) },
          {
            text: t("schedule.remove.thisAndFuture"),
            style: "destructive",
            onPress: () => removeGoal(target, "future", today),
          },
        ]);
        return;
      }
      Alert.alert(t("schedule.remove.title"), t("schedule.remove.message", { title }), [
        cancel,
        {
          text: t("schedule.remove.confirm"),
          style: "destructive",
          onPress: () => removeGoal(target, "this", today),
        },
      ]);
    },
    [t, today],
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
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text
              className="text-neutral-900"
              style={{ fontFamily: Pixelify.bold, fontSize: 30, lineHeight: 34 }}
            >
              {t("schedule.title")}
            </Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Text
                className="text-neutral-500"
                style={{ fontFamily: Pixelify.medium, fontSize: 13 }}
              >
                {formatAppDate(startOfDay(selectedDay), {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              {kind !== "today" && (
                <Pressable
                  onPress={() => setPickedDay(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t("schedule.backToToday")}
                  hitSlop={8}
                  className="flex-row items-center gap-1 rounded-full border px-2 py-0.5 active:opacity-70"
                  style={{ borderColor: LUA_GREEN, backgroundColor: "rgba(22,163,74,0.08)" }}
                >
                  <Ionicons name="arrow-back" size={11} color={LUA_GREEN} />
                  <Text style={{ fontFamily: Pixelify.semibold, fontSize: 12, color: LUA_GREEN }}>
                    {t("common.today")}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
          <Link href="/(tabs)/profile" asChild>
            <Pressable accessibilityLabel={t("a11y.openProfile")}>
              <MySpriteAvatar size={44} backdrop="transparent" />
            </Pressable>
          </Link>
        </View>

        {kind === "today" && (
          <View
            className="mb-5 overflow-hidden rounded-2xl"
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
                accessibilityLabel={t("a11y.openLiveMap")}
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
                      {t("schedule.liveMap")}
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
        )}

        <ScheduleCalendar
          selectedDay={selectedDay}
          today={today}
          onSelectDay={selectDay}
          countFor={countFor}
        />

        <View className="mb-4 mt-3 flex-row items-center gap-2 px-1">
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: STATUS_DOT[kind] }} />
          <Text className="text-neutral-600" style={{ fontFamily: Pixelify.medium, fontSize: 12 }}>
            {`${t(`schedule.status.${kind}`)} · ${statusDetail}`}
          </Text>
        </View>

        {cards.length === 0 ? (
          <View
            className="items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10"
            style={{ marginBottom: 24 }}
          >
            <Ionicons
              name={kind === "today" ? "map-outline" : "calendar-outline"}
              size={32}
              color="#a3a3a3"
            />
            <Text
              className="mt-3 text-center text-neutral-700"
              style={{ fontFamily: Pixelify.semibold, fontSize: 14 }}
            >
              {t(`schedule.empty.${kind}Title`)}
            </Text>
            <Text
              className="mt-1 text-center text-neutral-500"
              style={{ fontFamily: Pixelify.regular, fontSize: 12 }}
            >
              {t(`schedule.empty.${kind}Description`)}
            </Text>
          </View>
        ) : (
          cards.map((card) => {
            const preset = SCHEDULE_THEME_PRESETS[card.themeKey] ?? SCHEDULE_THEME_PRESETS.academic;
            const { target } = card;
            return (
              <ScheduleItemCard
                key={card.key}
                time={card.time}
                title={card.title}
                location={card.location}
                note={card.note}
                icon={preset.icon}
                gradientColors={preset.gradientColors}
                glowColor={preset.glowColor}
                repeating={card.repeating}
                status={card.status}
                onPress={target && card.status !== "complete" ? () => openEdit(target) : undefined}
                onLongPress={target ? () => confirmRemove(target, card.title) : undefined}
              />
            );
          })
        )}
      </ScrollView>

      {kind !== "past" && (
        <Pressable
          accessibilityLabel={t("a11y.addScheduleItem")}
          onPress={openNewGoal}
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
      )}

      <AddScheduleModal
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        userLocation={userLocationForSearch}
        today={today}
        defaultDay={kind === "past" ? today : selectedDay}
        editing={sheetDraft}
        lockDate={sheetTarget != null && isRepeating(sheetTarget)}
      />
    </View>
  );
}
