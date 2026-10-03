import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MySpriteAvatar } from "@/components/profile/SpriteAvatar";
import { Pixelify } from "@/constants/fonts";

type MapTopBarProps = {
  topInset: number;
};

export function MapTopBar({ topInset }: MapTopBarProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-white" style={{ paddingTop: topInset }} pointerEvents="auto">
      <View className="flex-row items-center justify-between px-6 pb-1 pt-2">
        <Text
          className="pl-5"
          style={{ fontFamily: Pixelify.bold, fontSize: 24, lineHeight: 28, color: "#14532d" }}
          accessibilityRole="header"
        >
          {t("common.appName")}
        </Text>
        <View className="flex-row items-center gap-3 pr-5">
          <Link href="/(tabs)/profile" asChild>
            <Pressable accessibilityLabel={t("a11y.profile")}>
              <MySpriteAvatar size={40} ringWidth={1} ringColor="rgba(0,0,0,0.08)" />
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
