import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

/**
 * Whether Lua may send its own notifications (goal check-ins and the evening
 * reminder). The Profile switch sets it; until the user touches the switch it
 * follows the phone's notification permission, so a user who allowed
 * notifications gets check-ins without hunting for the switch.
 */

export const NOTIFICATIONS_ENABLED_KEY = "notificationsEnabled";

/** The user's choice on the Profile switch, or null if they never changed it. */
export async function getNotificationChoice(): Promise<boolean | null> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return stored === null ? null : stored === "true";
  } catch {
    return null;
  }
}

export async function setNotificationChoice(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
}

/** True when the switch isn't off and the phone lets Lua post notifications. */
export async function notificationsWanted(): Promise<boolean> {
  if ((await getNotificationChoice()) === false) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
