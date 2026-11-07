import { Pedometer } from "expo-sensors";
import { AppState, Platform } from "react-native";

import { startOfDay, startOfNextDay } from "@/lib/dayKey";
import { getGameStats, updateGameStats } from "@/lib/gameStats";
import { METERS_PER_STEP } from "@/lib/walkingRules";

/**
 * Counts today's steps into `gameStats.stepsToday`.
 *
 * - iOS reads the phone's step history for the day, so steps taken while Lua
 *   was closed still count.
 * - Android counts live from the step sensor. The sensor keeps counting while
 *   Lua is in the background, but steps taken while Lua is fully closed are lost.
 * - With no step counter (or no permission), steps are estimated from the GPS
 *   distance walked today.
 *
 * The day itself is owned by `dailyProgress`, which calls `beginStepDay` at midnight.
 */

type StepSource = "pedometer" | "gps";

/** How often iOS re-reads the step history while Lua is open. */
const IOS_POLL_MS = 20_000;

let day: string | null = null;
let source: StepSource = "gps";
let started = false;
/** Metres walked today, from the GPS odometer. */
let gpsMeters = 0;
/** Android: steps counted today before this launch. */
let savedSteps = 0;
/** Android: the live sensor reading, which counts from when Lua subscribed. */
let sensorSteps = 0;
/** Android: the live sensor reading when today began. */
let sensorStepsAtDayStart = 0;

function publish(steps: number): void {
  const stepsToday = Math.max(0, Math.round(steps));
  if (stepsToday !== getGameStats().stepsToday) updateGameStats({ stepsToday });
}

function recompute(): void {
  if (source === "gps") {
    publish(gpsMeters / METERS_PER_STEP);
  } else if (Platform.OS === "android") {
    publish(savedSteps + sensorSteps - sensorStepsAtDayStart);
  }
  // iOS pedometer steps come straight from the step history in refreshIosSteps.
}

async function refreshIosSteps(): Promise<void> {
  const forDay = day;
  if (!forDay || source !== "pedometer" || Platform.OS !== "ios") return;
  const end = new Date(Math.min(Date.now(), startOfNextDay(forDay).getTime()));
  try {
    const { steps } = await Pedometer.getStepCountAsync(startOfDay(forDay), end);
    // Skip a reading that finished after midnight moved Lua to a new day.
    if (day === forDay) publish(steps);
  } catch {
    // Keep the last reading.
  }
}

function startIosPolling(): void {
  void refreshIosSteps();
  setInterval(() => {
    if (AppState.currentState === "active") void refreshIosSteps();
  }, IOS_POLL_MS);
  AppState.addEventListener("change", (next) => {
    if (next === "active") void refreshIosSteps();
  });
}

async function canUsePedometer(): Promise<boolean> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    let permission = await Pedometer.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Pedometer.requestPermissionsAsync();
    }
    return permission.granted;
  } catch {
    return false;
  }
}

export type StepDayRestore = {
  day: string;
  /** Steps saved earlier today (used on Android and for the GPS estimate). */
  steps: number;
  gpsMeters: number;
};

/** Starts counting once per launch. Asks for the motion permission the first time. */
export async function startStepCounter(restore: StepDayRestore): Promise<void> {
  if (started) return;
  started = true;
  day = restore.day;
  gpsMeters = restore.gpsMeters;
  savedSteps = restore.steps;

  source = (await canUsePedometer()) ? "pedometer" : "gps";

  if (source === "gps") {
    recompute();
  } else if (Platform.OS === "android") {
    publish(savedSteps);
    Pedometer.watchStepCount(({ steps }) => {
      sensorSteps = steps;
      recompute();
    });
  } else {
    startIosPolling();
  }
}

/** Starts a new day at zero steps. */
export function beginStepDay(newDay: string): void {
  day = newDay;
  gpsMeters = 0;
  savedSteps = 0;
  sensorStepsAtDayStart = sensorSteps;
  publish(0);
  void refreshIosSteps();
}

/** Adds GPS walking accepted by the odometer. */
export function addGpsMeters(meters: number): void {
  if (!(meters > 0)) return;
  gpsMeters += meters;
  if (source === "gps") recompute();
}

/** Metres walked today, from GPS. */
export function getGpsMetersToday(): number {
  return gpsMeters;
}

/** Whole-day steps for a past day from the iOS step history, or null when there is none. */
export async function stepsOnDay(pastDay: string): Promise<number | null> {
  if (Platform.OS !== "ios" || source !== "pedometer") return null;
  try {
    const { steps } = await Pedometer.getStepCountAsync(
      startOfDay(pastDay),
      startOfNextDay(pastDay),
    );
    return steps;
  } catch {
    return null;
  }
}
