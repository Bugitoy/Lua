import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { isOnScreen } from "@/hooks/useIsOnScreen";
import { dayKey } from "@/lib/dayKey";
import { tickOffGoal } from "@/lib/goalCheckIn";
import {
  dismissCheckInPrompt,
  getCheckInPrompts,
  startGoalVisits,
  subscribeGoalVisits,
  type CheckInPrompt,
} from "@/lib/goalVisits";
import i18n from "@/lib/i18n";
import { notificationsWanted } from "@/lib/notificationPrefs";
import {
  getScheduledItems,
  startSchedule,
  subscribeSchedule,
  type ScheduledItem,
} from "@/lib/scheduleStore";
import { startXpLedger } from "@/lib/xpLedger";

/**
 * Lua's own notifications:
 *
 * - Check-ins: when a "did you finish these?" prompt is queued while Lua is
 *   off screen (see `goalVisits`), one notification per place, with Tick off
 *   (or Tick all) and Not yet buttons. A newer one for a place replaces the
 *   older, and it's cleared once its prompt is answered anywhere.
 * - The evening reminder at 20:00 while some reached goal is still unticked.
 *
 * Both respect the Profile notifications switch (`notificationsWanted`).
 * While Lua is open the in-app prompt shows instead of a check-in.
 */

const CHANNEL_ID = "goal-check-ins";
const CATEGORY_ONE = "goal-check-in-one";
const CATEGORY_MANY = "goal-check-in-many";
const ACTION_TICK = "tick";
const ACTION_NOT_YET = "not-yet";
const NUDGE_ID = "evening-nudge";
const NUDGE_HOUR = 20;
/** Runs a notification button press while Lua is in the background or closed (Android). */
const ACTION_TASK = "lua-check-in-actions";

type CheckInData = { kind: "checkIn"; promptId: string; goalIds: string[] };
type NudgeData = { kind: "nudge" };

// ─── Answering from a notification ───────────────────────────────────────────

function dataOf(response: Notifications.NotificationResponse): Record<string, unknown> | null {
  const data = response?.notification?.request?.content?.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

/** Tick off / Not yet pressed on a check-in. A plain tap just opens Lua, where the prompt shows. */
async function handleResponse(response: Notifications.NotificationResponse): Promise<void> {
  const data = dataOf(response);
  if (data?.kind !== "checkIn") return;
  const action = response.actionIdentifier;
  if (action !== ACTION_TICK && action !== ACTION_NOT_YET) return;

  const goalIds = Array.isArray(data.goalIds)
    ? data.goalIds.filter((id): id is string => typeof id === "string")
    : [];
  // The phone may start Lua just to run this, before anything has loaded.
  await Promise.all([startSchedule(), startGoalVisits(), startXpLedger()]);
  if (action === ACTION_TICK) for (const id of goalIds) tickOffGoal(id);
  if (typeof data.promptId === "string") dismissCheckInPrompt(data.promptId);
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(ACTION_TASK, async ({ data, error }) => {
  if (error || !data || !("actionIdentifier" in data)) return;
  await handleResponse(data);
});

// ─── Sending ─────────────────────────────────────────────────────────────────

/** Notification work runs one step at a time, so a clear can't land after the newer post it raced. */
let queue: Promise<void> = Promise.resolve();
function enqueue(step: () => Promise<void>): void {
  queue = queue.then(step).catch(() => {});
}

/** One notification slot per place, so a newer check-in there replaces the older. */
function placeIdentifier(place: string): string {
  let hash = 5381;
  for (let i = 0; i < place.length; i++) hash = ((hash * 33) ^ place.charCodeAt(i)) >>> 0;
  return `check-in-${hash.toString(36)}`;
}

function untickedGoals(ids: readonly string[]): ScheduledItem[] {
  const byId = new Map(getScheduledItems().map((item) => [item.id, item]));
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is ScheduledItem => item != null && !item.completed);
}

async function postCheckIn(prompt: CheckInPrompt): Promise<void> {
  if (!(await notificationsWanted())) return;
  const goals = untickedGoals(prompt.goalIds);
  if (goals.length === 0) return;
  const data: CheckInData = { kind: "checkIn", promptId: prompt.id, goalIds: goals.map((g) => g.id) };
  await Notifications.scheduleNotificationAsync({
    identifier: placeIdentifier(prompt.place),
    content: {
      title: i18n.t(prompt.kind === "leave" ? "checkIn.leaveTitle" : "checkIn.returnTitle", {
        place: prompt.place,
      }),
      body: i18n.t(
        prompt.kind === "leave" ? "checkIn.notification.leaveBody" : "checkIn.notification.returnBody",
        { count: goals.length, goal: goals[0].title },
      ),
      data,
      categoryIdentifier: goals.length === 1 ? CATEGORY_ONE : CATEGORY_MANY,
    },
    trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
  });
}

/** Clears check-ins whose prompt was answered, put off or replaced. */
async function clearAnsweredCheckIns(): Promise<void> {
  const open = new Set(getCheckInPrompts().map((p) => p.id));
  const shown = await Notifications.getPresentedNotificationsAsync();
  for (const n of shown) {
    const data = n.request.content.data as Partial<CheckInData> | null;
    if (data?.kind === "checkIn" && (!data.promptId || !open.has(data.promptId))) {
      await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  }
}

/** Prompts already seen, so only newly queued ones are posted. Null until started. */
let knownPrompts: Set<string> | null = null;

function onVisitsChange(): void {
  if (!knownPrompts) return;
  const prompts = getCheckInPrompts();
  const fresh = prompts.filter((p) => !knownPrompts!.has(p.id));
  knownPrompts = new Set(prompts.map((p) => p.id));
  enqueue(clearAnsweredCheckIns);
  if (fresh.length === 0 || isOnScreen(AppState.currentState)) return;
  for (const prompt of fresh) enqueue(() => postCheckIn(prompt));
}

// ─── Evening reminder ────────────────────────────────────────────────────────

/** What the reminder last said, so unrelated schedule changes don't reschedule it. */
let lastNudge: string | null = null;

/**
 * Schedules (or clears) today's 20:00 reminder about reached goals that aren't
 * ticked off. `force` reschedules even if nothing changed, e.g. after the
 * notifications switch is turned back on.
 */
export function syncEveningNudge(force = false): void {
  enqueue(async () => {
    const waiting = getScheduledItems().filter((item) => item.reachedAtMs != null && !item.completed);
    const at = new Date();
    at.setHours(NUDGE_HOUR, 0, 0, 0);
    const due = waiting.length > 0 && Date.now() < at.getTime() && (await notificationsWanted());
    const key = due ? [dayKey(), waiting.length, waiting[0].title, i18n.language].join("|") : "none";
    if (!force && key === lastNudge) return;
    lastNudge = key;

    await Notifications.cancelScheduledNotificationAsync(NUDGE_ID).catch(() => {});
    if (waiting.length === 0) await Notifications.dismissNotificationAsync(NUDGE_ID).catch(() => {});
    if (!due) return;
    const data: NudgeData = { kind: "nudge" };
    await Notifications.scheduleNotificationAsync({
      identifier: NUDGE_ID,
      content: {
        title: i18n.t("checkIn.notification.nudgeTitle"),
        body: i18n.t("checkIn.notification.nudgeBody", { count: waiting.length, goal: waiting[0].title }),
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

/** Button titles and the Android channel name follow the app language. */
async function registerCategories(): Promise<void> {
  const notYet = {
    identifier: ACTION_NOT_YET,
    buttonTitle: i18n.t("checkIn.notYet"),
    options: { opensAppToForeground: false },
  };
  await Notifications.setNotificationCategoryAsync(CATEGORY_ONE, [
    { identifier: ACTION_TICK, buttonTitle: i18n.t("schedule.card.tickOff"), options: { opensAppToForeground: false } },
    notYet,
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_MANY, [
    {
      identifier: ACTION_TICK,
      buttonTitle: i18n.t("checkIn.notification.tickAll"),
      options: { opensAppToForeground: false },
    },
    notYet,
  ]);
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t("checkIn.notification.channelName"),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

let startPromise: Promise<void> | null = null;

/**
 * Starts check-in notifications and the evening reminder. Safe to call
 * repeatedly; call it at app start and from background tasks, which may run
 * before the app has started.
 */
export function startGoalNotifications(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    // While Lua is open, check-ins show in the app instead; the reminder still shows.
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const show = (notification.request.content.data as { kind?: unknown } | null)?.kind === "nudge";
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
      },
    });
    Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });

    // Buttons first, so no check-in goes out without them.
    await registerCategories().catch(() => {});
    await Promise.all([startSchedule(), startGoalVisits()]);
    knownPrompts = new Set(getCheckInPrompts().map((p) => p.id));
    subscribeGoalVisits(onVisitsChange);
    subscribeSchedule(() => syncEveningNudge());

    i18n.on("languageChanged", () => {
      void registerCategories().catch(() => {});
      syncEveningNudge(true);
    });
    await Notifications.registerTaskAsync(ACTION_TASK).catch(() => {});
    enqueue(clearAnsweredCheckIns);
    syncEveningNudge();
  })();
  return startPromise;
}

/**
 * Opens the Schedule when the evening reminder is tapped, including the tap
 * that launched Lua. Use it in a component that renders after the navigator.
 */
export function useNudgeOpensSchedule(): void {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (dataOf(response)?.kind !== "nudge") return;
    void Notifications.clearLastNotificationResponseAsync();
    // Let the navigator finish mounting on a cold start.
    const timer = setTimeout(() => {
      try {
        router.push("/(tabs)/schedule");
      } catch {
        // Lua still opens; the user can switch tabs.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [response]);
}
