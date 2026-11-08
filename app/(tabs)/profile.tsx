import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatXp } from "@/components/achievements/theme";
import { xpBarProgress } from "@/components/achievements/unlockRoute";
import { MySpriteAvatar } from "@/components/profile/SpriteAvatar";
import { TodaySummaryCard } from "@/components/profile/TodaySummaryCard";
import { LanguagePickerModal } from "@/components/settings/LanguagePickerModal";
import { APP_VERSION } from "@/constants/appVersion";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useAchievements } from "@/lib/achievementsStore";
import { showAppAlert, showAppNotice } from "@/lib/appAlert";
import { useGameStats } from "@/lib/gameStats";
import { syncEveningNudge } from "@/lib/goalNotifications";
import { getAppLocale } from "@/lib/i18n/formatLocale";
import { useLanguagePreference } from "@/lib/i18n/LanguageProvider";
import { notificationsWanted, setNotificationChoice } from "@/lib/notificationPrefs";
import { useProfile } from "@/lib/profileStore";
import { useStatsXp } from "@/lib/xp";


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
  const { t } = useTranslation();
  const { languageLabel } = useLanguagePreference();
  const { stats } = useGameStats();
  const { devXpBonus } = useAchievements();
  const statsXp = useStatsXp();
  const { profile } = useProfile();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => {
    let active = true;
    // On unless the user turned it off, and only if the phone allows notifications.
    void notificationsWanted().then((wanted) => {
      if (active) setNotificationsEnabled(wanted);
    });
    return () => {
      active = false;
    };
  }, []);

  const onToggleNotifications = useCallback(
    async (value: boolean) => {
      const notificationError = (message: string) =>
        showAppNotice(
          { icon: "alert-circle-outline", tone: "danger", title: t("notifications.errorTitle"), message },
          t("common.ok"),
        );

      if (value) {
        if (!Device.isDevice) {
          showAppNotice(
            {
              icon: "phone-portrait-outline",
              tone: "primary",
              title: t("notifications.unsupportedTitle"),
              message: t("notifications.unsupportedMessage"),
            },
            t("common.ok"),
          );
          return;
        }

        try {
          let permission = await Notifications.getPermissionsAsync();

          if (permission.status !== "granted") {
            permission = await Notifications.requestPermissionsAsync();
          }

          if (permission.status !== "granted") {
            showAppAlert({
              icon: "notifications-off-outline",
              tone: "primary",
              title: t("notifications.permissionDeniedTitle"),
              message: t("notifications.permissionDeniedMessage"),
              buttons: [
                { label: t("common.openSettings"), tone: "primary", onPress: () => void Linking.openSettings() },
              ],
              cancelLabel: t("common.notNow"),
            });
            setNotificationsEnabled(false);
            return;
          }

          setNotificationsEnabled(true);
          await setNotificationChoice(true);
          syncEveningNudge(true);
        } catch {
          notificationError(t("notifications.errorEnabling"));
        }
      } else {
        try {
          setNotificationsEnabled(false);
          await setNotificationChoice(false);
          await Notifications.cancelAllScheduledNotificationsAsync();
          syncEveningNudge(true);
        } catch {
          notificationError(t("notifications.errorDisabling"));
        }
      }
    },
    [t],
  );

  const xp = Math.max(0, statsXp + devXpBonus);
  const xpLabel = formatXp(xp, getAppLocale());
  const xpProgress = xpBarProgress(xp);


  const onManageProfile = useCallback(() => {
    router.push("/manage-profile");
  }, []);

  const onOpenWardrobe = useCallback(() => {
    router.push("/achievements");
  }, []);

  const onOpenAppSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const onSignOut = useCallback(() => {
    showAppAlert({
      icon: "log-out-outline",
      tone: "danger",
      title: t("common.signOutConfirmTitle"),
      message: t("common.signOutConfirmMessage"),
      // Signing out isn't wired up yet; the button only closes the alert, as before.
      buttons: [{ label: t("common.signOut"), tone: "danger" }],
    });
  }, [t]);

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
          {t("profile.title")}
        </Text>

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
            style={{ paddingHorizontal: 16, paddingVertical: 14, alignItems: "center" }}
          >
            <Pressable
              onPress={onOpenWardrobe}
              className="active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={t("a11y.profileAvatar")}
              accessibilityHint={t("a11y.customizeAvatarHint")}
            >
              <MySpriteAvatar size={64} ringWidth={2} ringColor={LUA_GREEN} />
              <View
                className="absolute bottom-0 right-0 size-6 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: LUA_GREEN }}
              >
                <Ionicons name="shirt" size={11} color="#fff" />
              </View>
            </Pressable>

            <Text
              className="mt-2 text-lg text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              {profile.displayName}
            </Text>
            <Text
              className="text-sm text-neutral-500"
              style={{ fontFamily: Pixelify.regular }}
            >
              {profile.handle}
            </Text>

            <View className="mt-3 w-full">
              <View className="mb-1 flex-row items-center justify-between">
                <Text
                  className="text-xs text-neutral-600"
                  style={{ fontFamily: Pixelify.semibold }}
                >
                  {t("profile.experienceLevel")}
                </Text>
                <Text
                  className="text-xs text-neutral-400"
                  style={{ fontFamily: Pixelify.regular }}
                >
                  {t("achievements.xpAmount", { xp: xpLabel })}
                </Text>
              </View>
              <View className="h-2.5 overflow-hidden rounded-full bg-neutral-200">
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

        <TodaySummaryCard
          goalsDone={stats.goalsDone}
          goalsTotal={stats.goalsTotal}
          goalStreak={stats.goalStreak}
          stepsToday={stats.stepsToday}
          distanceMiles={stats.distanceMiles}
          hoursWorked={stats.hoursStudied}
        />

        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {t("profile.sections.account")}
        </Text>
        <SectionCard>
          <SettingRow
            icon="person-outline"
            label={t("profile.rows.manageProfile")}
            sublabel={t("profile.rows.manageProfileSublabel")}
            onPress={onManageProfile}
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="trophy-outline"
            label={t("profile.rows.achievements")}
            sublabel={t("profile.rows.achievementsSublabel", { xp: xpLabel })}
            onPress={() => router.push("/achievements")}
          />
        </SectionCard>

        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {t("profile.sections.preferences")}
        </Text>
        <SectionCard>
          <SettingRow
            icon="notifications-outline"
            label={t("profile.rows.notifications")}
            sublabel={t("profile.rows.notificationsSublabel")}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={onToggleNotifications}
                trackColor={{ true: LUA_GREEN, false: "#d4d4d4" }}
                thumbColor="#fff"
              />
            }
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="language-outline"
            label={t("profile.rows.language")}
            sublabel={languageLabel}
            onPress={() => setLanguageModalVisible(true)}
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="settings-outline"
            label={t("profile.rows.appSettings")}
            sublabel={t("settings.systemSettingsDescription")}
            onPress={onOpenAppSettings}
            tintColor="#6366f1"
          />
        </SectionCard>

        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {t("profile.sections.about")}
        </Text>
        <SectionCard>
          <SettingRow
            icon="information-circle-outline"
            label={t("profile.rows.appVersion")}
            sublabel={t("profile.rows.appVersionValue", { version: APP_VERSION })}
            tintColor="#64748b"
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="people-outline"
            label={t("profile.rows.aboutUs")}
            onPress={() => router.push("/about-us")}
            tintColor="#64748b"
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="help-circle-outline"
            label={t("profile.rows.helpCenter")}
            onPress={() => router.push("/help-center")}
            tintColor="#64748b"
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="document-text-outline"
            label={t("profile.rows.termsConditions")}
            onPress={() => router.push("/terms")}
            tintColor="#64748b"
          />
          <View className="mx-4 h-px bg-neutral-100" />
          <SettingRow
            icon="shield-checkmark-outline"
            label={t("profile.rows.privacyPolicy")}
            onPress={() => router.push("/privacy-policy")}
            tintColor="#64748b"
          />
        </SectionCard>

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
            {t("common.signOut")}
          </Text>
        </Pressable>
      </ScrollView>

      <LanguagePickerModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
      />
    </View>
  );
}
