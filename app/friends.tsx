import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FriendQr } from "@/components/friends/FriendQr";
import { openPersonMenu } from "@/components/friends/personMenu";
import { PersonRow, SmallButton, StatusPill } from "@/components/friends/PersonRow";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useAccount } from "@/lib/account";
import { showAppNotice } from "@/lib/appAlert";
import { friendQrValue, inviteLink } from "@/lib/invite";
import {
  friendErrorKey,
  refreshFriends,
  removeFriend,
  respondToRequest,
  searchPeople,
  sendFriendRequest,
  sendFriendRequestByCode,
  useFriends,
  type FoundProfile,
  type FriendsError,
} from "@/lib/friends";

/** Wait this long after typing stops before searching. */
const SEARCH_DELAY_MS = 350;

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

type Search =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; people: FoundProfile[] }
  | { state: "error"; error: FriendsError };

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      className="mb-2 ml-1 mt-2 text-xs uppercase tracking-widest text-neutral-400"
      style={{ fontFamily: Pixelify.semibold }}
    >
      {children}
    </Text>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View className="mb-4 overflow-hidden rounded-2xl bg-white" style={CARD_SHADOW}>
      {children}
    </View>
  );
}

function Divider() {
  return <View className="mx-4 h-px bg-neutral-100" />;
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const account = useAccount();
  const { status, connections } = useFriends();
  const signedIn = account.status === "signedIn";

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshFriends();
    }, []),
  );

  useEffect(() => {
    const text = query.trim();
    if (!signedIn || text.replace(/^@/, "").length < 2) {
      setSearch({ state: "idle" });
      return;
    }
    setSearch({ state: "loading" });
    let active = true;
    const timer = setTimeout(() => {
      void searchPeople(text).then((result) => {
        if (!active) return;
        setSearch(result.ok ? { state: "done", people: result.people } : { state: "error", error: result.error });
      });
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, signedIn]);

  const failed = useCallback(
    (error: FriendsError) =>
      showAppNotice(
        {
          icon: "alert-circle-outline",
          tone: "danger",
          title: t("account.errors.genericTitle"),
          message: t(friendErrorKey(error)),
        },
        t("common.ok"),
      ),
    [t],
  );

  /** Runs a friend action for one person, with that person's buttons disabled meanwhile. */
  const act = useCallback(
    async (personId: string, action: () => Promise<{ ok: boolean; error?: FriendsError }>) => {
      setBusy((prev) => new Set(prev).add(personId));
      const result = await action();
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
      if (!result.ok) failed(result.error ?? "unknown");
    },
    [failed],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFriends();
    setRefreshing(false);
  }, []);

  const onShareCode = useCallback(() => {
    if (!account.friendCode) return;
    const link = inviteLink(account.friendCode);
    const vars = { code: account.friendCode, username: account.username ?? "", link };
    void Share.share({
      message: t(link ? "account.shareLinkMessage" : "account.shareCodeMessage", vars),
    }).catch(() => {});
  }, [account.friendCode, account.username, t]);

  const relationOf = (id: string) => connections.find((c) => c.id === id)?.relation;
  const incoming = connections.filter((c) => c.relation === "incoming");
  const outgoing = connections.filter((c) => c.relation === "outgoing");
  const friends = connections.filter((c) => c.relation === "friend");

  /** The right side of a search result: what you can do with that person. */
  const resultAction = (person: FoundProfile) => {
    const relation = relationOf(person.id);
    const disabled = busy.has(person.id);
    if (relation === "friend") return <StatusPill label={t("friends.friendsLabel")} />;
    if (relation === "outgoing") return <StatusPill label={t("friends.requestedLabel")} />;
    if (relation === "incoming") {
      return (
        <SmallButton
          label={t("friends.accept")}
          disabled={disabled}
          onPress={() => void act(person.id, () => respondToRequest(person.id, true))}
        />
      );
    }
    return (
      <SmallButton
        label={t("friends.add")}
        icon="person-add"
        disabled={disabled}
        // Found by their code: ask by code, which their search setting doesn't limit.
        onPress={() =>
          void act(person.id, () =>
            person.viaCode ? sendFriendRequestByCode(person.viaCode) : sendFriendRequest(person.id),
          )
        }
      />
    );
  };

  const header = (
    <>
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
      <View className="mb-5 flex-row items-center justify-between">
        <Text className="text-3xl text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
          {t("friends.title")}
        </Text>
        {signedIn ? (
          <Pressable
            onPress={() => router.push("/friend-settings")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("friends.settingsTitle")}
            className="size-10 items-center justify-center rounded-full bg-white active:opacity-70"
            style={CARD_SHADOW}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#525252" />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  if (!signedIn) {
    return (
      <View className="flex-1 bg-neutral-100 px-5" style={{ paddingTop: insets.top + 12 }}>
        <StatusBar style="dark" />
        {header}
        <View className="items-center rounded-2xl bg-white p-6" style={CARD_SHADOW}>
          <Ionicons name="people-outline" size={40} color={LUA_GREEN} />
          <Text className="mt-3 text-center text-sm text-neutral-600" style={{ fontFamily: Pixelify.regular }}>
            {t("friends.signInToAdd")}
          </Text>
          <Pressable
            onPress={() => router.push("/sign-in")}
            className="mt-5 w-full items-center rounded-xl py-3 active:opacity-80"
            style={{ backgroundColor: LUA_GREEN }}
          >
            <Text className="text-base text-white" style={{ fontFamily: Pixelify.bold }}>
              {t("profile.rows.signIn")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const searching = query.trim().replace(/^@/, "").length >= 2;

  return (
    <View className="flex-1 bg-neutral-100">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LUA_GREEN} />}
      >
        {header}

        <Card>
          <View className="p-4">
            <View className="flex-row items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3">
              <Ionicons name="search" size={18} color="#a3a3a3" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("friends.searchPlaceholder")}
                placeholderTextColor="#a3a3a3"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                className="flex-1 py-3 text-base text-neutral-900"
                style={{ fontFamily: Pixelify.regular }}
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("friends.clearSearch")}
                >
                  <Ionicons name="close-circle" size={18} color="#a3a3a3" />
                </Pressable>
              ) : null}
            </View>

            {!searching ? (
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  onPress={() => setQrOpen(true)}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-2.5 active:opacity-80"
                  style={{ borderColor: LUA_GREEN, backgroundColor: "rgba(22,163,74,0.08)" }}
                >
                  <Ionicons name="qr-code-outline" size={18} color={LUA_GREEN} />
                  <Text style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: LUA_GREEN }}>
                    {t("friends.myQr")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/scan-friend")}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-2.5 active:opacity-80"
                  style={{ borderColor: LUA_GREEN, backgroundColor: "rgba(22,163,74,0.08)" }}
                >
                  <Ionicons name="scan-outline" size={18} color={LUA_GREEN} />
                  <Text style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: LUA_GREEN }}>
                    {t("friends.scanQr")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {searching ? (
            <>
              <Divider />
              {search.state === "loading" ? (
                <ActivityIndicator className="my-5" color={LUA_GREEN} />
              ) : search.state === "error" ? (
                <Text className="px-4 py-4 text-center text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
                  {t(search.error === "network" ? "account.errors.network" : "account.errors.unknown")}
                </Text>
              ) : search.state === "done" && search.people.length === 0 ? (
                <Text className="px-4 py-4 text-center text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
                  {t("friends.noResults")}
                </Text>
              ) : search.state === "done" ? (
                search.people.map((person, i) => (
                  <View key={person.id}>
                    {i > 0 ? <Divider /> : null}
                    <PersonRow
                      person={person}
                      onPress={() => openPersonMenu(t, person)}
                      right={resultAction(person)}
                    />
                  </View>
                ))
              ) : null}
            </>
          ) : null}
        </Card>

        {incoming.length > 0 ? (
          <>
            <SectionTitle>{t("friends.requestsTitle", { count: incoming.length })}</SectionTitle>
            <Card>
              {incoming.map((person, i) => (
                <View key={person.id}>
                  {i > 0 ? <Divider /> : null}
                  <PersonRow
                    person={person}
                    onPress={() => openPersonMenu(t, person)}
                    right={
                      <View className="flex-row gap-1.5">
                        <SmallButton
                          label={t("friends.accept")}
                          disabled={busy.has(person.id)}
                          onPress={() => void act(person.id, () => respondToRequest(person.id, true))}
                        />
                        <SmallButton
                          label={t("friends.decline")}
                          tone="plain"
                          disabled={busy.has(person.id)}
                          onPress={() => void act(person.id, () => respondToRequest(person.id, false))}
                        />
                      </View>
                    }
                  />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle>{t("friends.friendsTitle", { count: friends.length })}</SectionTitle>
        <Card>
          {status === "loading" && connections.length === 0 ? (
            <ActivityIndicator className="my-6" color={LUA_GREEN} />
          ) : status === "error" ? (
            <Text className="px-4 py-5 text-center text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
              {t("friends.loadError")}
            </Text>
          ) : friends.length === 0 ? (
            <View className="items-center px-6 py-6">
              <Ionicons name="people-outline" size={32} color="#d4d4d4" />
              <Text className="mt-2 text-center text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
                {t("friends.empty")}
              </Text>
            </View>
          ) : (
            friends.map((person, i) => (
              <View key={person.id}>
                {i > 0 ? <Divider /> : null}
                <PersonRow
                  person={person}
                  onPress={() => openPersonMenu(t, person, { isFriend: true })}
                  right={<Ionicons name="ellipsis-horizontal" size={18} color="#a3a3a3" />}
                />
              </View>
            ))
          )}
        </Card>

        {outgoing.length > 0 ? (
          <>
            <SectionTitle>{t("friends.sentTitle", { count: outgoing.length })}</SectionTitle>
            <Card>
              {outgoing.map((person, i) => (
                <View key={person.id}>
                  {i > 0 ? <Divider /> : null}
                  <PersonRow
                    person={person}
                    right={
                      <SmallButton
                        label={t("friends.cancelRequest")}
                        tone="plain"
                        disabled={busy.has(person.id)}
                        onPress={() => void act(person.id, () => removeFriend(person.id))}
                      />
                    }
                  />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-8" onPress={() => setQrOpen(false)}>
          <Pressable className="w-full items-center rounded-3xl bg-white p-6" onPress={() => {}}>
            <Text className="text-lg text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
              {t("friends.myQr")}
            </Text>
            <Text className="mb-4 mt-1 text-center text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
              {t("friends.qrHint")}
            </Text>
            {account.friendCode ? (
              <FriendQr value={friendQrValue(account.friendCode)} size={220} />
            ) : (
              <View style={{ width: 220, height: 220 }} className="items-center justify-center">
                <ActivityIndicator color={LUA_GREEN} />
              </View>
            )}
            <Text
              selectable
              className="mt-4 text-xl tracking-widest text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              {account.friendCode ?? ""}
            </Text>
            <Text className="text-sm text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
              @{account.username ?? ""}
            </Text>
            <View className="mt-5 w-full flex-row gap-2">
              <Pressable
                onPress={onShareCode}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-80"
                style={{ backgroundColor: LUA_GREEN }}
              >
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text className="text-white" style={{ fontFamily: Pixelify.bold, fontSize: 14 }}>
                  {t("friends.shareCode")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setQrOpen(false)}
                className="flex-1 items-center justify-center rounded-xl bg-neutral-100 py-3 active:opacity-80"
              >
                <Text className="text-neutral-700" style={{ fontFamily: Pixelify.bold, fontSize: 14 }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
