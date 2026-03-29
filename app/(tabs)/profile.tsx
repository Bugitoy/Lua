import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { formatHours } from "@/lib/formatters";
import { useGameStats } from "@/lib/gameStats";

const AVATAR_URI = "https://i.pravatar.cc/240?img=12";

const LEVEL_XP_REQUIRED = 1000;

function xpForStats(stats: { goalsDone: number; distanceMiles: number; hoursStudied: number }) {
  return stats.goalsDone * 50 + Math.floor(stats.distanceMiles) * 30 + stats.hoursStudied * 40;
}

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  tintColor?: string;
};

function SettingRow({
  icon,
  label,
  sublabel,
  rightElement,
  onPress,
  tintColor = LUA_GREEN,
}: SettingRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-50"
    >
      <View
        className="size-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${tintColor}18` }}
      >
        <Ionicons name={icon} size={20} color={tintColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-sm text-neutral-900"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            className="text-xs text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
      {rightElement ?? (
        onPress ? (
          <Ionicons name="chevron-forward" size={18} color="#a3a3a3" />
        ) : null
      )}
    </Pressable>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="mb-4 overflow-hidden rounded-2xl bg-white"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { stats } = useGameStats();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const xp = xpForStats(stats);
  const level = Math.floor(xp / LEVEL_XP_REQUIRED) + 1;
  const xpInLevel = xp % LEVEL_XP_REQUIRED;
  const xpProgress = xpInLevel / LEVEL_XP_REQUIRED;

  const onEditProfile = useCallback(() => {
    Alert.alert("Edit Profile", "Profile editing coming soon!");
  }, []);

  const onSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => {} },
    ]);
  }, []);

  return (
    <View className="flex-1 bg-neutral-100">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="mb-5 text-3xl text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          Profile
        </Text>

        {/* Avatar + name card */}
        <View
          className="mb-4 overflow-hidden rounded-2xl bg-white"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <LinearGradient
            colors={["#d1fae5", "#ffffff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ padding: 20, alignItems: "center" }}
          >
            <Pressable onPress={onEditProfile} className="active:opacity-80">
              <Image
                source={{ uri: AVATAR_URI }}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 3,
                  borderColor: LUA_GREEN,
                }}
                accessibilityLabel="Profile avatar"
              />
              <View
                className="absolute bottom-0 right-0 size-7 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: LUA_GREEN }}
              >
                <Ionicons name="pencil" size={13} color="#fff" />
              </View>
            </Pressable>

            <Text
              className="mt-3 text-xl text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              Mason
            </Text>
            <Text
              className="text-sm text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              University of Cincinnati
            </Text>

            <View className="mt-4 w-full">
              <View className="mb-1 flex-row items-center justify-between">
                <Text
                  className="text-xs text-neutral-600"
                  style={{ fontFamily: Pixelify.semibold }}
                >
                  Level {level}
                </Text>
                <Text
                  className="text-xs text-neutral-400"
                  style={{ fontFamily: Pixelify.regular }}
                >
                  {xpInLevel} / {LEVEL_XP_REQUIRED} XP
                </Text>
              </View>
              <View className="h-3 overflow-hidden rounded-full bg-neutral-200">
                <LinearGradient
                  colors={[LUA_GREEN, "#84cc16"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{
                    height: "100%",
                    width: `${xpProgress * 100}%`,
                    borderRadius: 999,
                  }}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stats grid */}
        <View className="mb-4 flex-row flex-wrap gap-3">
          {[
            {
              label: "Goals Today",
              value: `${stats.goalsDone}`,
              sub: `/ ${stats.goalsTotal}`,
              icon: "flag-outline" as const,
              accent: LUA_GREEN,
            },
            {
              label: "Goal Completion Streak",
              value: `${stats.goalStreak}`,
              sub: "days",
              icon: "flame-outline" as const,
              accent: "#f97316",
            },
            {
              label: "Miles Walked",
              value: `${stats.distanceMiles}`,
              sub: "mi",
              icon: "footsteps" as const,
              accent: "#3b82f6",
            },
            {
              label: "Hours Studied",
              value: formatHours(stats.hoursStudied),
              sub: "",
              icon: "book-outline" as const,
              accent: "#8b5cf6",
            },
          ].map((item) => (
            <View
              key={item.label}
              className="items-center rounded-2xl bg-white py-4"
              style={{
                width: "47.5%",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View
                className="mb-2 size-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${item.accent}15` }}
              >
                <Ionicons name={item.icon} size={20} color={item.accent} />
              </View>
              <View className="flex-row items-baseline gap-1">
                <Text
                  className="text-2xl text-neutral-900"
                  style={{ fontFamily: Pixelify.bold }}
                >
                  {item.value}
                </Text>
                <Text
                  className="text-sm text-neutral-400"
                  style={{ fontFamily: Pixelify.regular }}
                >
                  {item.sub}
                </Text>
              </View>
              <Text
                className="mt-0.5 text-center text-[11px] text-neutral-500"
                style={{ fontFamily: Pixelify.regular }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Account */}
        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          Account
        </Text>
        <SectionCard>
          <SettingRow
            icon="person-outline"
            label="Edit Profile"
            sublabel="Name, photo, university"
            onPress={onEditProfile}
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="trophy-outline"
            label="Achievements"
            sublabel={`Level ${level} · ${xp} XP total`}
            onPress={() => {}}
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy"
            sublabel="Control your data"
            onPress={() => {}}
          />
        </SectionCard>

        {/* Preferences */}
        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          Preferences
        </Text>
        <SectionCard>
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            sublabel="Daily reminders"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ true: LUA_GREEN, false: "#d4d4d4" }}
                thumbColor="#fff"
              />
            }
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="map-outline"
            label="Campus Map"
            sublabel="Open the map"
            onPress={() => router.push("/")}
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="settings-outline"
            label="App Settings"
            onPress={() => router.push("/(tabs)/settings")}
            tintColor="#6366f1"
          />
        </SectionCard>

        {/* About */}
        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          About
        </Text>
        <SectionCard>
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            sublabel="Lua v1.0.0"
            tintColor="#64748b"
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="document-text-outline"
            label="Terms & Privacy"
            onPress={() => {}}
            tintColor="#64748b"
          />
        </SectionCard>

        {/* Sign out */}
        <Pressable
          onPress={onSignOut}
          className="items-center rounded-2xl bg-white py-4 active:opacity-80"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Text
            className="text-base text-red-500"
            style={{ fontFamily: Pixelify.semibold }}
          >
            Sign Out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
