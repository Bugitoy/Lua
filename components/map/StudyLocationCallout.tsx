import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

type StudyLocationCalloutProps = {
  goalLabel: string;
  isStudying: boolean;
  elapsedLabel: string;
  onBegin: () => void;
  onStop: () => void;
};

export function StudyLocationCallout({
  goalLabel,
  isStudying,
  elapsedLabel,
  onBegin,
  onStop,
}: StudyLocationCalloutProps) {
  const { t } = useTranslation();

  return (
    <View
      collapsable={false}
      style={{
        overflow: "visible",
        width: 220,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#d4d4d4",
        backgroundColor: "#ffffff",
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
        elevation: 4,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: Pixelify.bold,
          fontSize: 13,
          color: "#171717",
          marginBottom: 2,
        }}
      >
        {goalLabel}
      </Text>
      <Text
        style={{
          fontFamily: Pixelify.medium,
          fontSize: 12,
          color: "#525252",
          marginBottom: 6,
        }}
      >
        {t("map.study.promptTitle")}
      </Text>

      {isStudying ? (
        <Text
          style={{
            fontFamily: Pixelify.semibold,
            fontSize: 12,
            color: LUA_GREEN,
            marginBottom: 8,
          }}
        >
          {t("map.study.studying")}: {elapsedLabel}
        </Text>
      ) : null}

      <Pressable
        onPress={isStudying ? onStop : onBegin}
        style={{
          borderRadius: 10,
          backgroundColor: isStudying ? "#ef4444" : LUA_GREEN,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 36,
          paddingHorizontal: 10,
        }}
      >
        <Text
          style={{
            fontFamily: Pixelify.bold,
            fontSize: 13,
            color: "#ffffff",
          }}
        >
          {isStudying ? t("map.study.stopStudying") : t("map.study.beginStudying")}
        </Text>
      </Pressable>
    </View>
  );
}
