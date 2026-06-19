import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * iOS reports "inactive" for brief interruptions (app switcher, incoming call),
 * so only "background" means Lua is off screen.
 */
export function isOnScreen(state: AppStateStatus): boolean {
  return state !== "background";
}

/**
 * Android keeps Lua's JS running behind the background-tracking service, so
 * anything that only matters on screen (map GPS, compass, sprite animation)
 * should pause while this is false.
 */
export function useIsOnScreen(): boolean {
  const [onScreen, setOnScreen] = useState(() => isOnScreen(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setOnScreen(isOnScreen(state)),
    );
    // Catch a change that landed between the first render and subscribing.
    setOnScreen(isOnScreen(AppState.currentState));
    return () => subscription.remove();
  }, []);

  return onScreen;
}
