import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, Pressable, Text, View } from "react-native";

import { StudyProgressRingSkia } from "@/components/map/StudyProgressRingSkia";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

type MapHealthBarCardProps = {
  healthRatio: number;
  studyEligible: boolean;
  isStudying: boolean;
  studyElapsedMs: number;
  studyStartedAtMs?: number | null;
  studyGoalLabel?: string;
  onBeginStudy?: () => void;
  onStopStudy?: () => void;
};

function formatStudyElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function MapHealthBarCard({
  healthRatio,
  studyEligible,
  isStudying,
  studyElapsedMs,
  studyStartedAtMs = null,
  studyGoalLabel,
  onBeginStudy,
  onStopStudy,
}: MapHealthBarCardProps) {
  const { t } = useTranslation();
  const shouldShowStudyRow = studyEligible || isStudying;
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const elapsedLabel = formatStudyElapsed(studyElapsedMs);

  const onCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  return (
    <View className="mt-2 items-center px-4" pointerEvents="auto">
      <View
        className="relative w-full max-w-[340px]"
        style={{ overflow: "visible" }}
        onLayout={onCardLayout}
      >
        <StudyProgressRingSkia
          width={cardSize.width}
          height={cardSize.height}
          isStudying={isStudying}
          studyStartedAtMs={studyStartedAtMs}
          studyElapsedMs={studyElapsedMs}
        />

        <View
          className="rounded-2xl bg-white p-3"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Text
            className="text-left text-sm text-neutral-800"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("map.healthBar.title")}
          </Text>
          <View className="mt-1 h-4 overflow-hidden rounded-full bg-neutral-200">
            <LinearGradient
              colors={[LUA_GREEN, "#eab308"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                height: "100%",
                width: `${healthRatio * 100}%`,
                borderRadius: 999,
              }}
            />
          </View>

          {shouldShowStudyRow ? (
            <View className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <Text
                numberOfLines={1}
                className="text-xs text-neutral-700"
                style={{ fontFamily: Pixelify.semibold }}
              >
                {studyGoalLabel ?? t("map.study.eligibleHint")}
              </Text>
              <Text
                className="mt-0.5 text-xs"
                style={{ fontFamily: Pixelify.medium, color: LUA_GREEN }}
              >
                {t("map.study.timer")}: {elapsedLabel}
              </Text>
              <Pressable
                onPress={isStudying ? onStopStudy : onBeginStudy}
                disabled={!isStudying && !studyEligible}
                className="mt-2 items-center rounded-lg py-2 active:opacity-80"
                style={{
                  backgroundColor: isStudying ? "#ef4444" : LUA_GREEN,
                  opacity: !isStudying && !studyEligible ? 0.5 : 1,
                }}
              >
                <Text
                  className="text-sm text-white"
                  style={{ fontFamily: Pixelify.bold }}
                >
                  {isStudying
                    ? t("map.study.stopStudying")
                    : t("map.study.beginStudying")}
                </Text>
              </Pressable>
              {isStudying ? (
                <Text
                  className="mt-1 text-[11px]"
                  style={{ fontFamily: Pixelify.medium, color: "#16a34a" }}
                >
                  {t("map.study.studying")}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
