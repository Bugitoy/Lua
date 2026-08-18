/**
 * <ShopButton onPress={openShop} showNew fontFamily="YourPixelFont" />
 * Gold "SHOP" pill from the prototype: dark pixel outline, hard 3 px drop shadow that the button
 * presses into, a white shine that sweeps across every 4.5 s, and a bobbing red NEW tag.
 *
 * Needs: expo-linear-gradient, react-native-svg, react-native-reanimated.
 * Hide the NEW tag (showNew={false}) once the player has opened the shop.
 */
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export const SHOP_BUTTON = {
  outline: "#4d485c",          // border + hard shadow (sprite outline colour)
  gradient: ["#ffe27a", "#f7c234", "#e9a514"] as const,
  gradientStops: [0, 0.55, 1] as const,
  highlight: "rgba(255,255,255,0.55)", // 2 px line inside the top edge
  text: "#3a2a06",
  newBg: "#e0524a",
  height: 38,
  radius: 10,
  border: 2,
  shadowDrop: 3,
  shineEveryMs: 4500,
};

type Props = {
  onPress: () => void;
  showNew?: boolean;
  fontFamily?: string;     // your project's pixel font
  label?: string;
};

export function ShopButton({ onPress, showNew = true, fontFamily, label = "Shop" }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [width, setWidth] = useState(0);
  const pressed = useSharedValue(0);
  const shine = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      shine.value = 0;
      bob.value = 0;
      return;
    }
    // idle for 70% of the cycle, then sweep across in the next 15% (matches the prototype's keyframes)
    const idle = SHOP_BUTTON.shineEveryMs * 0.7;
    const sweep = SHOP_BUTTON.shineEveryMs * 0.15;
    const rest = SHOP_BUTTON.shineEveryMs - idle - sweep;
    shine.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(idle, withTiming(1, { duration: sweep, easing: Easing.inOut(Easing.ease) })),
        withDelay(rest, withTiming(1, { duration: 0 })),
      ),
      -1,
    );
    bob.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduceMotion, shine, bob]);

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * SHOP_BUTTON.shadowDrop }] }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -24 + shine.value * (width + 48) }, { skewX: "-20deg" }],
  }));
  const newStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * bob.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 80 }))}
      accessibilityRole="button"
      accessibilityLabel={showNew ? "Open shop, new items available" : "Open shop"}
      hitSlop={6}
    >
      <View style={{ paddingBottom: SHOP_BUTTON.shadowDrop }}>
        {/* hard pixel shadow the face presses down into */}
        <View style={[styles.shadow, { top: SHOP_BUTTON.shadowDrop }]} />
        <Animated.View style={[styles.face, faceStyle]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <LinearGradient
            colors={SHOP_BUTTON.gradient}
            locations={SHOP_BUTTON.gradientStops}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.highlight} />
          <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={SHOP_BUTTON.text} strokeWidth={2.2} strokeLinecap="square" strokeLinejoin="miter">
            <Path d="M4 8h16l-1.5 12h-13z" fill="#ffffff" />
            <Path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
          </Svg>
          <Text style={[styles.label, fontFamily ? { fontFamily } : null]}>{label.toUpperCase()}</Text>
        </Animated.View>
        {showNew ? (
          <Animated.View style={[styles.newTag, newStyle]} pointerEvents="none">
            <Text style={[styles.newText, fontFamily ? { fontFamily } : null]}>NEW</Text>
          </Animated.View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute", left: 0, right: 0, height: SHOP_BUTTON.height,
    borderRadius: SHOP_BUTTON.radius, backgroundColor: SHOP_BUTTON.outline,
  },
  face: {
    height: SHOP_BUTTON.height, borderRadius: SHOP_BUTTON.radius, borderWidth: SHOP_BUTTON.border,
    borderColor: SHOP_BUTTON.outline, overflow: "hidden", flexDirection: "row", alignItems: "center",
    gap: 6, paddingLeft: 10, paddingRight: 12,
  },
  highlight: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: SHOP_BUTTON.highlight },
  shine: { position: "absolute", top: -8, bottom: -8, left: 0, width: 14, backgroundColor: "rgba(255,255,255,0.75)" },
  label: { color: SHOP_BUTTON.text, fontSize: 13, fontWeight: "700", letterSpacing: 0.8 },
  newTag: {
    position: "absolute", top: -9, right: -10, backgroundColor: SHOP_BUTTON.newBg, borderColor: SHOP_BUTTON.outline,
    borderWidth: 2, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1,
  },
  newText: { color: "#ffffff", fontSize: 9, letterSpacing: 0.6, fontWeight: "700" },
});
