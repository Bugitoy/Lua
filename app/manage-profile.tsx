import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountCard } from "@/components/profile/AccountCard";
import { ManageProfileForm } from "@/components/profile/ManageProfileForm";
import { Pixelify } from "@/constants/fonts";
import { useAccount } from "@/lib/account";

export default function ManageProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const signedIn = useAccount().status === "signedIn";

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
      >
        <Pressable
          onPress={() => router.back()}
          className="mb-4 flex-row items-center gap-1 active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#525252" />
          <Text
            className="text-base text-neutral-600"
            style={{ fontFamily: Pixelify.medium }}
          >
            {t("common.back")}
          </Text>
        </Pressable>

        <Text
          className="mb-5 text-3xl text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          {t("manageProfile.title")}
        </Text>

        <ManageProfileForm />
        {signedIn ? <AccountCard /> : null}
      </ScrollView>
    </View>
  );
}
