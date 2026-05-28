import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN, LUA_LOGO } from "@/constants/mapAssets";

const PAGE_BG = "#ffffff";
const SLATE = "#64748b";
const SLATE_LIGHT = "#94a3b8";
const GREEN_50 = "#f0fdf4";
const GREEN_200 = "#bbf7d0";
const PALE_BLUE = "#e0f2fe";
const PALE_BLUE_BORDER = "#bae6fd";
const PALE_VIOLET = "#ede9fe";
const PALE_VIOLET_BORDER = "#ddd6fe";
const PALE_SLATE = "#f1f5f9";
const BORDER = "#e5e7eb";

type StepIcon = keyof typeof Ionicons.glyphMap;

const STEPS: {
  key: "plan" | "prove" | "consequences";
  icon: StepIcon;
  color: string;
  bg: string;
  border: string;
  numColor: string;
}[] = [
  {
    key: "plan",
    icon: "calendar-outline",
    color: "#0284c7",
    bg: PALE_BLUE,
    border: PALE_BLUE_BORDER,
    numColor: "#0369a1",
  },
  {
    key: "prove",
    icon: "navigate-outline",
    color: LUA_GREEN,
    bg: GREEN_50,
    border: GREEN_200,
    numColor: LUA_GREEN,
  },
  {
    key: "consequences",
    icon: "heart-outline",
    color: "#7c3aed",
    bg: PALE_VIOLET,
    border: PALE_VIOLET_BORDER,
    numColor: "#6d28d9",
  },
];

const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

function SectionLabel({ children }: { children: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View
        className="h-2 w-2 rounded-sm"
        style={{ backgroundColor: LUA_GREEN }}
      />
      <Text
        className="text-xs uppercase tracking-[0.2em]"
        style={{ fontFamily: Pixelify.semibold, color: SLATE }}
      >
        {children}
      </Text>
    </View>
  );
}

function HeroLogo() {
  const tilt = useSharedValue(0);

  useEffect(() => {
    tilt.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [tilt]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <View
        className="h-20 w-20 items-center justify-center rounded-2xl border-2 bg-white"
        style={{ borderColor: LUA_GREEN, ...cardShadow }}
      >
        <Image source={LUA_LOGO} style={{ width: 52, height: 52 }} contentFit="contain" />
      </View>
    </Animated.View>
  );
}

function StepCard({
  index,
  icon,
  color,
  bg,
  border,
  numColor,
  title,
  body,
}: {
  index: number;
  icon: StepIcon;
  color: string;
  bg: string;
  border: string;
  numColor: string;
  title: string;
  body: string;
}) {
  const num = String(index + 1).padStart(2, "0");

  return (
    <Animated.View
      entering={FadeInRight.delay(200 + index * 120).duration(480).springify()}
      className="mb-3 overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: BORDER, ...cardShadow }}
    >
      <View className="flex-row">
        <View
          className="items-center justify-center px-4 py-5"
          style={{ backgroundColor: bg, minWidth: 72 }}
        >
          <Text
            className="text-3xl"
            style={{ fontFamily: Pixelify.bold, color: numColor }}
          >
            {num}
          </Text>
        </View>
        <View className="min-w-0 flex-1 px-4 py-4">
          <View className="mb-2 flex-row items-center justify-between gap-2">
            <Text
              className="flex-1 text-lg text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              {title}
            </Text>
            <View
              className="h-9 w-9 items-center justify-center rounded-xl border"
              style={{ backgroundColor: bg, borderColor: border }}
            >
              <Ionicons name={icon} size={18} color={color} />
            </View>
          </View>
          <Text
            className="text-sm leading-5 text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
          >
            {body}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function TagPill({ label, delay }: { label: string; delay: number }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(400)}>
      <View
        className="rounded-lg border px-3 py-1.5"
        style={{ borderColor: GREEN_200, backgroundColor: GREEN_50 }}
      >
        <Text
          className="text-xs"
          style={{ fontFamily: Pixelify.semibold, color: SLATE }}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

export function AboutUsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: PAGE_BG }}>
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <Animated.View entering={FadeIn.duration(300)}>
            <Pressable
              onPress={() => router.back()}
              className="mb-6 flex-row items-center gap-1 active:opacity-70"
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={SLATE} />
              <Text
                className="text-base"
                style={{ fontFamily: Pixelify.medium, color: SLATE_LIGHT }}
              >
                {t("common.back")}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(450).springify()}
            className="mb-8 flex-row items-end justify-between gap-4"
          >
            <View className="min-w-0 flex-1">
              <Text
                className="text-4xl leading-tight text-neutral-900"
                style={{ fontFamily: Pixelify.bold }}
              >
                {t("common.appName")}
              </Text>
              <Text
                className="mt-2 text-base leading-6"
                style={{ fontFamily: Pixelify.regular, color: SLATE }}
              >
                {t("aboutUs.heroTagline")}
              </Text>
            </View>
            <HeroLogo />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(500).springify()}>
            <SectionLabel>{t("aboutUs.origin.title")}</SectionLabel>
            <View
              className="mb-8 overflow-hidden rounded-3xl border bg-white"
              style={{ borderColor: GREEN_200, ...cardShadow }}
            >
              <LinearGradient
                colors={[GREEN_50, PAGE_BG]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 20 }}
              >
                <View className="mb-4 flex-row flex-wrap gap-2">
                  <TagPill label={t("aboutUs.origin.chipHackathon")} delay={200} />
                  <TagPill label={t("aboutUs.origin.chipCampusFlow")} delay={280} />
                </View>

                <Text
                  className="mb-4 text-base leading-6 text-neutral-800"
                  style={{ fontFamily: Pixelify.regular }}
                >
                  {t("aboutUs.origin.paragraph1")}
                </Text>

                <Text
                  className="text-base leading-6 text-neutral-500"
                  style={{ fontFamily: Pixelify.regular }}
                >
                  {t("aboutUs.origin.paragraph2")}
                </Text>
              </LinearGradient>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500).springify()}>
            <SectionLabel>{t("aboutUs.howItWorks.title")}</SectionLabel>
            <View
              className="mb-4 rounded-2xl border bg-white p-4"
              style={{ borderColor: BORDER, ...cardShadow }}
            >
              <View className="mb-3 flex-row items-start gap-3">
                <View
                  className="mt-0.5 h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: PALE_SLATE }}
                >
                  <Ionicons name="footsteps" size={20} color={SLATE} />
                </View>
                <Text
                  className="flex-1 text-base leading-6 text-neutral-500"
                  style={{ fontFamily: Pixelify.regular }}
                >
                  {t("aboutUs.howItWorks.intro")}
                </Text>
              </View>
              <View
                className="h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: PALE_SLATE }}
              >
                <LinearGradient
                  colors={[PALE_BLUE_BORDER, LUA_GREEN, PALE_VIOLET_BORDER]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ height: "100%", width: "100%" }}
                />
              </View>
            </View>

            {STEPS.map((step, index) => (
              <StepCard
                key={step.key}
                index={index}
                icon={step.icon}
                color={step.color}
                bg={step.bg}
                border={step.border}
                numColor={step.numColor}
                title={t(`aboutUs.howItWorks.steps.${step.key}.title`)}
                body={t(`aboutUs.howItWorks.steps.${step.key}.body`)}
              />
            ))}
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(500).duration(400)}
            className="mt-2 text-center text-xs text-neutral-400"
            style={{ fontFamily: Pixelify.regular }}
          >
            {t("profile.rows.appVersionValue")}
          </Animated.Text>
        </View>
      </ScrollView>
    </View>
  );
}
