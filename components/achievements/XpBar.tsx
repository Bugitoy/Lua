import {
  PixelifySans_600SemiBold,
  PixelifySans_700Bold,
} from "@expo-google-fonts/pixelify-sans";
import { Canvas, Text as SkiaText, useFont } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

import { ACH, formatXpWorklet } from "@/components/achievements/theme";
import { nextStopXp, xpBarProgress } from "@/components/achievements/unlockRoute";

const BAR_HEIGHT = 30;
const TEXT_INSET = 14;
const FONT_SIZE = 13;

type XpBarProps = {
  width: number;
  /** Counting-up XP. */
  xp: SharedValue<number>;
  separator: string;
  /** Localised text around the number in the total, e.g. "" and " XP". */
  amountPrefix: string;
  amountSuffix: string;
  accessibilityLabel: string;
};

/** The numbers are drawn with Skia so they count up on the UI thread with the fill. */
export function XpBar({
  width,
  xp,
  separator,
  amountPrefix,
  amountSuffix,
  accessibilityLabel,
}: XpBarProps) {
  const totalFont = useFont(PixelifySans_700Bold, FONT_SIZE);
  const nextFont = useFont(PixelifySans_600SemiBold, FONT_SIZE);

  const fillStyle = useAnimatedStyle(() => ({ width: `${xpBarProgress(xp.value) * 100}%` }));
  const totalText = useDerivedValue(
    () => amountPrefix + formatXpWorklet(xp.value, separator) + amountSuffix,
  );
  const nextText = useDerivedValue(() => formatXpWorklet(nextStopXp(xp.value), separator));
  const nextX = useDerivedValue(() =>
    nextFont ? width - TEXT_INSET - nextFont.measureText(nextText.value).width : 0,
  );

  const metrics = totalFont?.getMetrics();
  const baseline = metrics ? BAR_HEIGHT / 2 - (metrics.ascent + metrics.descent) / 2 : 0;

  return (
    <View
      className="overflow-hidden rounded-full"
      style={{ width, height: BAR_HEIGHT, backgroundColor: ACH.xpTrack }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View className="absolute bottom-0 left-0 top-0 overflow-hidden rounded-full" style={fillStyle}>
        <LinearGradient
          colors={[ACH.green, ACH.xpEnd]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Canvas style={{ position: "absolute", width, height: BAR_HEIGHT }} pointerEvents="none">
        {totalFont ? (
          <SkiaText x={TEXT_INSET} y={baseline} text={totalText} font={totalFont} color={ACH.text} />
        ) : null}
        {nextFont ? (
          <SkiaText x={nextX} y={baseline} text={nextText} font={nextFont} color={ACH.textSecondary} />
        ) : null}
      </Canvas>
    </View>
  );
}
