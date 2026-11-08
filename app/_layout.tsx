import "@/global.css";
import "@/lib/i18n";
import {
  PixelifySans_400Regular,
  PixelifySans_500Medium,
  PixelifySans_600SemiBold,
  PixelifySans_700Bold,
} from "@expo-google-fonts/pixelify-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { GoalCheckInHost } from "@/components/schedule/GoalCheckInPrompt";
import { AppAlertHost } from "@/components/settings/AppAlertHost";
import { useDayRollover } from "@/hooks/useDayRollover";
import { useBackgroundTracking } from "@/lib/backgroundTracking";
import { startGoalNotifications } from "@/lib/goalNotifications";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { ProfileProvider } from "@/lib/ProfileProvider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const mountedRef = useRef(true);

  // Counts steps, loads saved health/XP, and grades each day at midnight
  useDayRollover();
  useBackgroundTracking();

  const [loaded, error] = useFonts({
    PixelifySans_400Regular,
    PixelifySans_500Medium,
    PixelifySans_600SemiBold,
    PixelifySans_700Bold,
  });

  useEffect(() => {
    // Goal check-in notifications and the evening reminder
    void startGoalNotifications();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded && !error) return;
    if (!mountedRef.current) return;
    void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <ProfileProvider>
          <View className="flex-1 font-sans">
            <Stack screenOptions={{ headerShown: false }} />
            <GoalCheckInHost />
            <AppAlertHost />
          </View>
        </ProfileProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}
