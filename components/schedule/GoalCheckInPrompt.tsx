import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useIsOnScreen } from "@/hooks/useIsOnScreen";
import { tickOffGoal } from "@/lib/goalCheckIn";
import { dismissCheckInPrompt, usePendingCheckInPrompt } from "@/lib/goalVisits";
import { formatAppTime } from "@/lib/i18n/formatLocale";
import { useScheduledItems, useScheduleLoaded, type ScheduledItem } from "@/lib/scheduleStore";

const TICK_GREEN = "#15803d";

/**
 * "You left the Library. Did you finish these?" and "Back at the Library"
 * prompts, shown over every screen while Lua is open. Mount once at the root,
 * after the navigator, so it draws on top.
 *
 * It closes on its own once every goal it asks about is ticked off (or
 * removed); "Not yet" or tapping outside puts the rest off.
 */
export function GoalCheckInHost() {
  const { t } = useTranslation();
  const prompt = usePendingCheckInPrompt();
  const items = useScheduledItems();
  const scheduleLoaded = useScheduleLoaded();
  const onScreen = useIsOnScreen();

  const goals = useMemo(() => {
    if (!prompt) return [];
    const byId = new Map(items.map((item) => [item.id, item]));
    return prompt.goalIds
      .map((id) => byId.get(id))
      .filter((item): item is ScheduledItem => item != null);
  }, [items, prompt]);
  const open = goals.filter((g) => !g.completed).length;

  useEffect(() => {
    if (prompt && scheduleLoaded && open === 0) dismissCheckInPrompt(prompt.id);
  }, [open, prompt, scheduleLoaded]);

  if (!prompt || !scheduleLoaded || !onScreen || open === 0) return null;

  const anyTicked = open < goals.length;
  const close = () => dismissCheckInPrompt(prompt.id);
  const leaving = prompt.kind === "leave";
  const time = formatAppTime(new Date(prompt.atMs), { hour: "numeric", minute: "2-digit" });

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/45 px-5">
      <Pressable className="absolute inset-0" onPress={close} accessibilityLabel={t("checkIn.notYet")} />
      <View
        className="w-full max-w-[400px] rounded-3xl bg-white px-5 pb-4 pt-6"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 12,
        }}
        accessibilityViewIsModal
      >
        <View
          className="mb-3 size-14 items-center justify-center self-center rounded-full"
          style={{ backgroundColor: `${LUA_GREEN}1a` }}
        >
          <Ionicons name={leaving ? "walk-outline" : "location-outline"} size={24} color={LUA_GREEN} />
        </View>
        <Text
          className="mb-1.5 text-center text-neutral-900"
          style={{ fontFamily: Pixelify.bold, fontSize: 18 }}
          accessibilityRole="header"
        >
          {t(leaving ? "checkIn.leaveTitle" : "checkIn.returnTitle", { place: prompt.place })}
        </Text>
        <Text
          className="mb-4 text-center text-neutral-500"
          style={{ fontFamily: Pixelify.regular, fontSize: 13, lineHeight: 18 }}
        >
          {t(leaving ? "checkIn.leaveMessage" : "checkIn.returnMessage", { count: goals.length, time })}
        </Text>

        <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }} bounces={false}>
          {goals.map((goal) => (
            <View
              key={goal.id}
              className="flex-row items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{ borderColor: goal.completed ? "#bbf7d0" : "#e5e5e5" }}
            >
              <View className="min-w-0 flex-1">
                <Text style={{ fontFamily: Pixelify.bold, fontSize: 12, color: "#171717" }}>{goal.time}</Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: Pixelify.semibold,
                    fontSize: 13,
                    lineHeight: 17,
                    color: goal.completed ? "#737373" : "#171717",
                    textDecorationLine: goal.completed ? "line-through" : "none",
                  }}
                >
                  {goal.title}
                </Text>
              </View>
              {goal.completed ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="checkmark-circle" size={14} color={TICK_GREEN} />
                  <Text style={{ fontFamily: Pixelify.bold, fontSize: 11, color: TICK_GREEN }}>
                    {t("checkIn.tickedOff")}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => tickOffGoal(goal.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("schedule.card.tickOffLabel", { title: goal.title })}
                  className="flex-row items-center gap-1 rounded-full bg-white px-2.5 py-1 active:opacity-70"
                  style={{ borderWidth: 1, borderColor: TICK_GREEN }}
                >
                  <Ionicons name="checkmark-circle-outline" size={13} color={TICK_GREEN} />
                  <Text style={{ fontFamily: Pixelify.bold, fontSize: 11, color: TICK_GREEN }}>
                    {t("schedule.card.tickOff")}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={close}
          accessibilityRole="button"
          className="mt-4 items-center rounded-xl border px-4 py-3 active:opacity-85"
          style={
            anyTicked
              ? { backgroundColor: LUA_GREEN, borderColor: LUA_GREEN }
              : { backgroundColor: "#ffffff", borderColor: "#e5e5e5" }
          }
        >
          <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, color: anyTicked ? "#ffffff" : "#171717" }}>
            {t(anyTicked ? "checkIn.done" : "checkIn.notYet")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
