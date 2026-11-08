import { useEffect, useState } from "react";
import { BackHandler } from "react-native";

import { ChoicePrompt } from "@/components/schedule/ChoicePrompt";
import {
  addAlertHost,
  closeAppAlert,
  useAppAlert,
  useTopAlertHost,
  type AppAlertButton,
} from "@/lib/appAlert";

/**
 * Draws Lua's alerts (`showAppAlert`) over everything behind it. Mount one
 * at the app root, after the navigator, and one at the end of any sheet that
 * is its own native layer; only the most recently mounted host draws.
 */
export function AppAlertHost() {
  const alert = useAppAlert();
  const top = useTopAlertHost();
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    const host = addAlertHost();
    setId(host.id);
    return host.remove;
  }, []);

  const showing = alert != null && id != null && top === id;

  // Android's back button cancels, like it does on a system alert.
  useEffect(() => {
    if (!showing) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeAppAlert();
      return true;
    });
    return () => sub.remove();
  }, [showing]);

  if (!showing) return null;

  const press = (button: AppAlertButton) => {
    closeAppAlert();
    button.onPress?.();
  };

  return (
    <ChoicePrompt
      key={alert.key}
      icon={alert.icon}
      tone={alert.tone}
      title={alert.title}
      message={alert.message}
      choices={alert.buttons.map((button) => ({
        label: button.label,
        tone: button.tone,
        onPress: () => press(button),
      }))}
      onCancel={closeAppAlert}
      cancelLabel={alert.cancelLabel}
    />
  );
}
