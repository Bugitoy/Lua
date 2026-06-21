import * as Location from "expo-location";

let prompt: Promise<boolean> | null = null;

/**
 * On Android, requesting opens the system permission screen even when access
 * is already granted, which briefly sends Lua to the background. Screen-gated
 * GPS and compass watchers restart on return, so check first and only ever
 * prompt once per launch to avoid a request loop.
 */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  prompt ??= Location.requestForegroundPermissionsAsync().then(
    (response) => response.granted,
    () => false,
  );
  return prompt;
}
