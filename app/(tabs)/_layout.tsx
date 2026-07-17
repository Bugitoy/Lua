import "@/global.css";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, Text } from "react-native";

const LUA_GREEN = "#16a34a";
const TAB_INACTIVE = "#6b7280";
const TAB_LABEL_STYLE = {
  fontSize: 11,
  fontFamily: "PixelifySans_600SemiBold",
};

export default function TabsLayout() {
  const { t } = useTranslation();

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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
