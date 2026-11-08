import "@/global.css";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, Text } from "react-native";

import { useIncomingCount } from "@/lib/friends";

const LUA_GREEN = "#16a34a";
const TAB_INACTIVE = "#6b7280";
const TAB_LABEL_STYLE = {
  fontSize: 11,
  fontFamily: "PixelifySans_600SemiBold",
};

export default function TabsLayout() {
  const { t } = useTranslation();
  // Friend requests waiting for an answer, so they're noticed from any tab.
  const incomingRequests = useIncomingCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: LUA_GREEN,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "rgba(0,0,0,0.06)",
          paddingTop: 4,
          height: Platform.OS === "ios" ? 88 : 64,
        },
        tabBarLabelStyle: TAB_LABEL_STYLE,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.map"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("tabs.schedule"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          // Display-only tabs subscribe to game stats; freezing them while hidden stops
          // re-renders on every distance update and study-timer second.
          freezeOnBlur: true,
          tabBarBadge: incomingRequests > 0 ? (incomingRequests > 9 ? "9+" : incomingRequests) : undefined,
          tabBarBadgeStyle: { fontFamily: "PixelifySans_700Bold", fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          title: t("tabs.achievements"),
          // "Achievements" is longer than a fifth of a phone's width allows at full size.
          tabBarLabel: ({ color, children }) => (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[TAB_LABEL_STYLE, { color, textAlign: "center" }]}
            >
              {children}
            </Text>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("tabs.stats"),
          freezeOnBlur: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
