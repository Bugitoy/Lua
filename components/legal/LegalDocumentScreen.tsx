import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

type LegalSection = {
  title: string;
  body: string;
};

type LegalDocumentScreenProps = {
  title: string;
  lastUpdated: string;
  intro?: string[];
  sections: LegalSection[];
};

export function LegalDocumentScreen({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalDocumentScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
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
          className="mb-1 text-3xl text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          {title}
        </Text>
        <Text
          className="mb-4 text-sm text-neutral-400"
          style={{ fontFamily: Pixelify.regular }}
        >
          {lastUpdated}
        </Text>

        {intro?.map((paragraph, index) => (
          <Text
            key={`intro-${index}`}
            className="mb-4 text-sm leading-6 text-neutral-600"
            style={{ fontFamily: Pixelify.regular }}
          >
            {paragraph}
          </Text>
        ))}

        <View className="gap-4">
          {sections.map((section, index) => (
            <View
              key={`${section.title}-${index}`}
              className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <View className="mb-2 flex-row items-center gap-2">
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: LUA_GREEN }}
                />
                <Text
                  className="flex-1 text-base text-neutral-900"
                  style={{ fontFamily: Pixelify.bold }}
                >
                  {section.title}
                </Text>
              </View>
              <Text
                className="text-sm leading-6 text-neutral-600"
                style={{ fontFamily: Pixelify.regular }}
              >
                {section.body}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
