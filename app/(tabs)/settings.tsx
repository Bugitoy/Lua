import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";

export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={{ fontFamily: Pixelify.regular }}>{t("settings.title")}</Text>
    </View>
  );
}