import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

const SLATE = "#64748b";
const BORDER = "#e5e7eb";
const GREEN_50 = "#f0fdf4";

const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

type FaqItem = { q: string; a: string };
type HelpSection = { title: string; faqs: FaqItem[] };

const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  gameplay: "heart-outline",
  gps: "navigate-outline",
  account: "cloud-outline",
};

function FaqCard({ question, answer }: { question: string; answer: string }) {
  return (
    <View
      className="mb-3 rounded-2xl border bg-white p-4"
      style={{ borderColor: BORDER, ...cardShadow }}
    >
      <View className="mb-2 flex-row items-start gap-2">
        <Text
          className="text-base text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          Q:
        </Text>
        <Text
          className="flex-1 text-base leading-6 text-neutral-900"
          style={{ fontFamily: Pixelify.semibold }}
        >
          {question}
        </Text>
      </View>
      <View className="flex-row items-start gap-2">
        <Text
          className="text-base"
          style={{ fontFamily: Pixelify.bold, color: LUA_GREEN }}
        >
          A:
        </Text>
        <Text
          className="flex-1 text-sm leading-6 text-neutral-600"
          style={{ fontFamily: Pixelify.regular }}
        >
          {answer}
        </Text>
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="mb-3 mt-2 flex-row items-center gap-2">
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: GREEN_50 }}
      >
        <Ionicons name={icon} size={18} color={LUA_GREEN} />
      </View>
      <Text
        className="flex-1 text-lg text-neutral-900"
        style={{ fontFamily: Pixelify.bold }}
      >
        {title}
      </Text>
    </View>
  );
}

type HelpCenterScreenProps = {
  title: string;
  welcome: string;
  sections: HelpSection[];
  sectionKeys: string[];
  supportTitle: string;
  supportBody: string;
  contactLabel: string;
  email: string;
};

export function HelpCenterScreen({
  title,
  welcome,
  sections,
  sectionKeys,
  supportTitle,
  supportBody,
  contactLabel,
  email,
}: HelpCenterScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const openEmail = () => {
    void Linking.openURL(`mailto:${email}`);
  };

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
          className="mb-3 text-3xl leading-tight text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          {title}
        </Text>
        <Text
          className="mb-6 text-base leading-6 text-neutral-500"
          style={{ fontFamily: Pixelify.regular }}
        >
          {welcome}
        </Text>

        {sections.map((section, index) => {
          const iconKey = sectionKeys[index] ?? "gameplay";
          const icon = SECTION_ICONS[iconKey] ?? "help-circle-outline";
          return (
            <View key={section.title} className="mb-4">
              <SectionHeader title={section.title} icon={icon} />
              {section.faqs.map((faq) => (
                <FaqCard key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </View>
          );
        })}

        <View
          className="mt-2 rounded-2xl border p-5"
          style={{ borderColor: GREEN_50, backgroundColor: GREEN_50, ...cardShadow }}
        >
          <Text
            className="mb-2 text-lg text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            {supportTitle}
          </Text>
          <Text
            className="mb-4 text-sm leading-6 text-neutral-600"
            style={{ fontFamily: Pixelify.regular }}
          >
            {supportBody}
          </Text>
          <Text
            className="mb-1 text-sm text-neutral-700"
            style={{ fontFamily: Pixelify.semibold }}
          >
            {contactLabel}
          </Text>
          <Pressable onPress={openEmail} className="active:opacity-70">
            <Text
              className="text-base"
              style={{ fontFamily: Pixelify.medium, color: LUA_GREEN }}
            >
              {email}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
