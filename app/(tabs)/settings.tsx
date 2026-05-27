import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";

export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-neutral-100">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="mb-4 text-2xl text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          {t("settings.title")}
        </Text>

        <View className="mb-4 rounded-2xl bg-white p-4">
          <Text
            className="mb-2 text-base text-neutral-900"
            style={{ fontFamily: Pixelify.semibold }}
          >
            {t("settings.systemSettingsTitle")}
          </Text>
          <Text
            className="mb-3 text-sm text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
          >
            {t("settings.systemSettingsDescription")}
          </Text>
          <Pressable
            onPress={() => Linking.openSettings()}
            className="items-center rounded-xl bg-neutral-900 px-4 py-2 active:opacity-80"
          >
            <Text
              className="text-sm text-white"
              style={{ fontFamily: Pixelify.semibold }}
            >
              {t("settings.openSystemSettings")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}