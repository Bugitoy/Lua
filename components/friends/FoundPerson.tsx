import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { PersonRow } from "@/components/friends/PersonRow";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useAccount } from "@/lib/account";
import {
  findByFriendCode,
  respondToRequest,
  sendFriendRequest,
  useFriends,
  type FriendsError,
  type PublicProfile,
} from "@/lib/friends";

type Lookup =
  | { state: "loading" }
  | { state: "found"; person: PublicProfile }
  | { state: "missing" }
  | { state: "error"; error: FriendsError };

/**
 * The person behind a friend code, with a button to ask them to be friends.
 * Used after scanning a QR code and when a lua://friend/… link opens the app.
 */
export function FoundPerson({ code, onDone }: { code: string; onDone: () => void }) {
  const { t } = useTranslation();
  const account = useAccount();
  const { connections } = useFriends();
  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<FriendsError | null>(null);
  const signedIn = account.status === "signedIn";

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setLookup({ state: "loading" });
    void findByFriendCode(code).then((result) => {
      if (!active) return;
      if (!result.ok) setLookup({ state: "error", error: result.error });
      else setLookup(result.person ? { state: "found", person: result.person } : { state: "missing" });
    });
    return () => {
      active = false;
    };
  }, [code, signedIn]);

  const card = (children: React.ReactNode) => (
    <View
      className="rounded-2xl bg-white p-5"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {children}
    </View>
  );

  const message = (text: string) => (
    <Text className="text-center text-sm text-neutral-600" style={{ fontFamily: Pixelify.regular }}>
      {text}
    </Text>
  );

  const button = (label: string, onPress: () => void, primary = true, busy = false) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="mt-4 items-center rounded-xl py-3 active:opacity-80"
      style={{ backgroundColor: primary ? LUA_GREEN : "#f5f5f5", opacity: busy ? 0.7 : 1 }}
    >
      {busy ? (
        <ActivityIndicator color={primary ? "#fff" : "#525252"} />
      ) : (
        <Text style={{ fontFamily: Pixelify.bold, fontSize: 15, color: primary ? "#fff" : "#404040" }}>
          {label}
        </Text>
      )}
    </Pressable>
  );

  if (!signedIn) {
    return card(
      <>
        {message(t("friends.signInToAdd"))}
        {button(t("profile.rows.signIn"), () => router.push("/sign-in"))}
      </>,
    );
  }

  if (lookup.state === "loading") {
    return card(<ActivityIndicator color={LUA_GREEN} />);
  }
  if (lookup.state === "missing" || lookup.state === "error") {
    return card(
      <>
        {message(
          lookup.state === "missing"
            ? t("friends.codeNotFound", { code })
            : t(lookup.error === "network" ? "account.errors.network" : "account.errors.unknown"),
        )}
        {button(t("common.ok"), onDone, false)}
      </>,
    );
  }

  const { person } = lookup;
  const isMe = person.id === account.userId;
  const relation = connections.find((c) => c.id === person.id)?.relation;

  /**
   * Sends a request, or accepts theirs if they asked first. Only accepting an
   * incoming request makes a friendship; sending one never does, even when
   * they'd already asked (the list then refreshes and shows Accept request).
   */
  const onPress = async () => {
    setSending(true);
    setSendError(null);
    const result =
      relation === "incoming" ? await respondToRequest(person.id, true) : await sendFriendRequest(person.id);
    setSending(false);
    if (!result.ok) setSendError(result.error);
  };

  let footer: React.ReactNode;
  if (isMe) footer = message(t("friends.thatsYou"));
  else if (relation === "friend") footer = message(t("friends.alreadyFriends", { name: person.displayName }));
  else if (relation === "outgoing") footer = message(t("friends.requestSent", { name: person.displayName }));
  else if (relation === "incoming")
    footer = (
      <>
        {message(t("friends.theyAsked", { name: person.displayName }))}
        {button(t("friends.acceptRequest"), () => void onPress(), true, sending)}
      </>
    );
  else footer = button(t("friends.addFriend"), () => void onPress(), true, sending);

  return card(
    <>
      <View className="-mx-4 -mt-2">
        <PersonRow person={person} />
      </View>
      <View className="mt-2">{footer}</View>
      {sendError ? (
        <Text className="mt-2 text-center text-xs text-red-500" style={{ fontFamily: Pixelify.regular }}>
          {t(sendError === "network" ? "account.errors.network" : "account.errors.unknown")}
        </Text>
      ) : null}
      {relation === "incoming"
        ? button(t("common.notNow"), onDone, false)
        : relation === "friend" || relation === "outgoing" || isMe
          ? button(t("common.done"), onDone, false)
          : null}
    </>,
  );
}
