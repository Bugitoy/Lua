import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";

import { useAccount } from "@/lib/account";
import { useMyLook } from "@/lib/avatarLook";
import { getDayHistory, startDayHistory, type DayRecord } from "@/lib/dayHistory";
import { useGameStatsSelector } from "@/lib/gameStats";
import { useScheduleLoaded } from "@/lib/scheduleStore";
import { supabase } from "@/lib/supabase";
import { useTodayRecord } from "@/lib/todayRecord";
import { useStatsXp, useXpLoaded } from "@/lib/xp";

/**
 * While the user is signed in, copies what friends will see to the server:
 * their XP, streak and Lua's outfit on the profile, and one stats row per day.
 * The phone stays the source of truth; nothing comes back down.
 *
 * Today's row changes with every few steps, so changes are sent at most once
 * every few seconds, always with the newest numbers. Finished days are sent
 * once: the last day sent is remembered per account, and only newer days go up.
 */

/** At most one send per this long for each kind of update. */
const SEND_INTERVAL_MS = 10_000;
/** Rows per upsert when catching up on past days. */
const BATCH_SIZE = 200;

const syncedThroughKey = (userId: string) => `statsSyncedThrough:${userId}`;

function statsRow(userId: string, record: DayRecord) {
  return {
    user_id: userId,
    day: record.day,
    goals_done: record.goals.filter((g) => g.completed).length,
    goals_total: record.goals.length,
    steps: Math.round(record.steps),
    meters: record.meters,
    work_hours: record.workHours,
  };
}

/** Sends finished days newer than the last one sent from this phone. */
async function syncPastDays(userId: string, today: string): Promise<void> {
  if (!supabase) return;
  await startDayHistory();
  const syncedThrough = (await AsyncStorage.getItem(syncedThroughKey(userId))) ?? "";
  const days = Object.values(getDayHistory())
    .filter((r) => !r.sample && r.day > syncedThrough && r.day < today)
    .sort((a, b) => a.day.localeCompare(b.day));
  for (let i = 0; i < days.length; i += BATCH_SIZE) {
    const batch = days.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("daily_stats").upsert(batch.map((r) => statsRow(userId, r)));
    if (error) return;
    await AsyncStorage.setItem(syncedThroughKey(userId), batch[batch.length - 1].day);
  }
}

/**
 * Queues the newest value and sends it once the interval is up. Walking keeps
 * changing today's numbers, so the timer isn't reset by each change, or it
 * would never fire while the user walks. A value equal to the last one sent is
 * skipped; a failed send is retried with the next change.
 */
function makeSender<T>(send: (payload: T) => Promise<boolean>) {
  let sentKey: string | null = null;
  let latest: { key: string; payload: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (key: string, payload: T) => {
    latest = key === sentKey ? null : { key, payload };
    if (!latest || timer) return;
    timer = setTimeout(() => {
      timer = null;
      const next = latest;
      latest = null;
      if (!next) return;
      void send(next.payload)
        .then((ok) => {
          if (ok) sentKey = next.key;
        })
        .catch(() => {});
    }, SEND_INTERVAL_MS);
  };
}

type ProfilePayload = { userId: string; xp: number; streak: number; look: object };

const queueProfile = makeSender<ProfilePayload>(async ({ userId, ...fields }) => {
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  return !error;
});

const queueToday = makeSender<ReturnType<typeof statsRow>>(async (row) => {
  if (!supabase) return false;
  const { error } = await supabase.from("daily_stats").upsert(row);
  return !error;
});

export function AccountSync() {
  const { status, userId } = useAccount();
  const xpLoaded = useXpLoaded();
  const scheduleLoaded = useScheduleLoaded();
  const xp = useStatsXp();
  const look = useMyLook();
  const streak = useGameStatsSelector((s) => s.goalStreak);
  const today = useTodayRecord();

  // Nothing is sent until the phone's own data has loaded, so zeros never overwrite real numbers.
  const ready = status === "signedIn" && userId !== null && xpLoaded && scheduleLoaded;
  const activeUser = ready ? userId : null;

  useEffect(() => {
    if (!activeUser) return;
    void syncPastDays(activeUser, today.day).catch(() => {});
  }, [activeUser, today.day]);

  useEffect(() => {
    if (!activeUser) return;
    const payload = { userId: activeUser, xp: Math.max(0, Math.round(xp)), streak, look };
    queueProfile(JSON.stringify(payload), payload);
  }, [activeUser, xp, streak, look]);

  useEffect(() => {
    if (!activeUser) return;
    const row = statsRow(activeUser, today);
    queueToday(JSON.stringify(row), row);
  }, [activeUser, today]);

  return null;
}
