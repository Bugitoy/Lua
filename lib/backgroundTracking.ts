import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { LUA_GREEN } from "@/constants/mapAssets";
import { isOnScreen, useIsOnScreen } from "@/hooks/useIsOnScreen";
import { haversineMeters, type LatLngPoint } from "@/lib/geo";
import { checkInAtGoals } from "@/lib/goalCheckIn";
import i18n from "@/lib/i18n";
import { recordOdometerFix } from "@/lib/odometerRecorder";
import { hasUnfinishedGoals, useHasUnfinishedGoals } from "@/lib/scheduleStore";

const BACKGROUND_TRACKING_TASK = "lua-background-tracking";

/** Same steady-state gate the map applies in `useLocation`. */
const MAX_ACCURACY_METERS = 60;
/** Below this speed a fix counts as standing still for the odometer. */
const STATIONARY_SPEED_MPS = 0.4;

type BackgroundFix = LatLngPoint & { timestamp: number };

/** Calendar day tracking started on; tracking ends when the day rolls over. */
let trackingDay: string | null = null;
let lastFix: BackgroundFix | null = null;
let pendingChange: Promise<void> = Promise.resolve();

function todayKey(): string {
  return new Date().toDateString();
}

function speedMps(loc: Location.LocationObject, fix: BackgroundFix): number | null {
  const reported = loc.coords.speed;
  if (reported != null && reported >= 0) return reported;
  if (!lastFix) return null;
  const dtSec = (fix.timestamp - lastFix.timestamp) / 1000;
  return dtSec > 0 ? haversineMeters(lastFix, fix) / dtSec : null;
}

function processFix(loc: Location.LocationObject): void {
  const accuracy = loc.coords.accuracy ?? null;
  if (accuracy != null && accuracy > MAX_ACCURACY_METERS) return;

  const fix: BackgroundFix = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp,
  };
  const speed = speedMps(loc, fix);
  lastFix = fix;

  recordOdometerFix(
    {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy,
      speed,
      isStationary: (speed ?? 0) < STATIONARY_SPEED_MPS,
    },
    fix.timestamp,
  );
  checkInAtGoals(fix);
}

async function startTracking(): Promise<void> {
  trackingDay = todayKey();
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK)) {
    return;
  }

  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return;
  // Android keeps foreground-service updates alive without "Allow all the time"; iOS needs it.
  if (Platform.OS === "ios") {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) return;
  }

  lastFix = null;
  await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: i18n.t("backgroundTracking.notificationTitle"),
      notificationBody: i18n.t("backgroundTracking.notificationBody"),
      notificationColor: LUA_GREEN,
      // The schedule only lives in memory, so there is nothing to track once Lua is closed.
      killServiceOnDestroy: true,
    },
  });
}

async function stopTracking(): Promise<void> {
  trackingDay = null;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
  }
}

/** Applies start/stop requests one at a time so they can't interleave. */
function enqueue(change: () => Promise<void>): Promise<void> {
  pendingChange = pendingChange.then(change).catch(() => {
    // Leave tracking as-is; the next app-state or goal change retries.
  });
  return pendingChange;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_TRACKING_TASK,
  async ({ data, error }) => {
    if (error || !data) return;

    // While Lua is on screen the map's own GPS pipeline handles every fix.
    if (isOnScreen(AppState.currentState)) {
      lastFix = null;
      return;
    }

    if (trackingDay !== todayKey() || !hasUnfinishedGoals()) {
      await enqueue(stopTracking);
      return;
    }

    for (const loc of data.locations) {
      processFix(loc);
    }

    if (!hasUnfinishedGoals()) {
      await enqueue(stopTracking);
    }
  },
);

/**
 * Keeps screen-off tracking running while there are unfinished goals today.
 * Android only allows the location service to start while Lua is on screen.
 */
export function useBackgroundTracking(): void {
  const goalsPending = useHasUnfinishedGoals();
  const onScreen = useIsOnScreen();

  useEffect(() => {
    if (!onScreen) return;
    void enqueue(goalsPending ? startTracking : stopTracking);
  }, [onScreen, goalsPending]);
}
