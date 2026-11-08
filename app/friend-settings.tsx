import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PersonRow, SmallButton } from "@/components/friends/PersonRow";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { showAppNotice } from "@/lib/appAlert";
import {
  REQUESTS_FROM,
  friendErrorKey,
  getRequestsFrom,
  listBlocked,
  setRequestsFrom,
  unblockUser,
  type FriendsError,
  type PublicProfile,
  type RequestsFrom,
} from "@/lib/friends";

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

/** Friends privacy: who can send requests from search, and the people the user has blocked. */
export default function FriendSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [requestsFrom, setChoice] = useState<RequestsFrom | null>(null);
  const [saving, setSaving] = useState<RequestsFrom | null>(null);
  const [blocked, setBlocked] = useState<PublicProfile[] | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const failed = useCallback(
    (error: FriendsError) =>
      showAppNotice(
        { icon: "alert-circle-outline", tone: "danger", title: t("account.errors.genericTitle"), message: t(friendErrorKey(error)) },
        t("common.ok"),
      ),
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getRequestsFrom().then((result) => {
        if (active && result.ok) setChoice(result.data);
      });
      void listBlocked().then((result) => {
        if (active) setBlocked(result.ok ? result.data : []);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const choose = useCallback(
    async (value: RequestsFrom) => {
      if (value === requestsFrom || saving) return;
      setSaving(value);
      const result = await setRequestsFrom(value);
      setSaving(null);
      if (result.ok) setChoice(value);
      else failed(result.error);
    },
    [failed, requestsFrom, saving],
  );

  const unblock = useCallback(
    async (person: PublicProfile) => {
      setUnblocking(person.id);
      const result = await unblockUser(person.id);
      setUnblocking(null);
      if (result.ok) setBlocked((list) => (list ?? []).filter((p) => p.id !== person.id));
      else failed(result.error);
    },
    [failed],
  );

  return (
    <View className="flex-1 bg-neutral-100">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          className="mb-4 flex-row items-center gap-1 self-start active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#525252" />
          <Text className="text-base text-neutral-600" style={{ fontFamily: Pixelify.medium }}>
            {t("common.back")}
          </Text>
        </Pressable>
        <Text className="mb-5 text-3xl text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
          {t("friends.settingsTitle")}
        </Text>

        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {t("friends.requestsFromTitle")}
        </Text>
        <View className="mb-1 overflow-hidden rounded-2xl bg-white" style={CARD_SHADOW}>
          {requestsFrom === null ? (
            <ActivityIndicator className="my-6" color={LUA_GREEN} />
          ) : (
            REQUESTS_FROM.map((value, i) => {
              const selected = value === requestsFrom;
              return (
                <View key={value}>
                  {i > 0 ? <View className="mx-4 h-px bg-neutral-100" /> : null}
                  <Pressable
                    onPress={() => void choose(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className="flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-50"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm text-neutral-900" style={{ fontFamily: Pixelify.semibold }}>
                        {t(`friends.requestsFrom.${value}`)}
                      </Text>
                      <Text className="text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
                        {t(`friends.requestsFrom.${value}Hint`)}
                      </Text>
                    </View>
                    {saving === value ? (
                      <ActivityIndicator color={LUA_GREEN} />
                    ) : (
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color={selected ? LUA_GREEN : "#d4d4d4"}
                      />
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
        <Text className="mb-5 ml-1 text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
          {t("friends.requestsFromNote")}
        </Text>

        <Text
          className="mb-2 ml-1 text-xs uppercase tracking-widest text-neutral-400"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {t("friends.blockedListTitle")}
        </Text>
        <View className="overflow-hidden rounded-2xl bg-white" style={CARD_SHADOW}>
          {blocked === null ? (
            <ActivityIndicator className="my-6" color={LUA_GREEN} />
          ) : blocked.length === 0 ? (
            <Text className="px-4 py-5 text-center text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
              {t("friends.noneBlocked")}
            </Text>
          ) : (
            blocked.map((person, i) => (
              <View key={person.id}>
                {i > 0 ? <View className="mx-4 h-px bg-neutral-100" /> : null}
                <PersonRow
                  person={person}
                  right={
                    <SmallButton
                      label={t("friends.unblock")}
                      tone="plain"
                      disabled={unblocking === person.id}
                      onPress={() => void unblock(person)}
                    />
                  }
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
