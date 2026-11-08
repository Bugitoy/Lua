import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FoundPerson } from "@/components/friends/FoundPerson";
import { Pixelify } from "@/constants/fonts";
import { friendCodeIn } from "@/lib/friends";

/**
 * Opened by a lua://friend/LUA-7KX2QD link, e.g. when a phone's own camera
 * app scans a Lua QR code: shows who the code belongs to, with an Add button.
 */
export default function FriendLinkScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const friendCode = friendCodeIn(String(code ?? ""));

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/friends"));

  return (
    <View className="flex-1 bg-neutral-100 px-5" style={{ paddingTop: insets.top + 12 }}>
      <StatusBar style="dark" />
      <Pressable onPress={leave} className="mb-6 flex-row items-center gap-1 self-start active:opacity-70" hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#525252" />
        <Text className="text-base text-neutral-600" style={{ fontFamily: Pixelify.medium }}>
          {t("common.back")}
        </Text>
      </Pressable>
      <Text className="mb-4 text-3xl text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
        {t("friends.addFriend")}
      </Text>
      {friendCode ? (
        <FoundPerson code={friendCode} onDone={leave} />
      ) : (
        <Text className="text-sm text-neutral-600" style={{ fontFamily: Pixelify.regular }}>
          {t("friends.codeNotFound", { code: String(code ?? "") })}
        </Text>
      )}
    </View>
  );
}
