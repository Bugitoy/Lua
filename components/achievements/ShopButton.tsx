import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ACH } from "@/components/achievements/theme";
import { Pixelify } from "@/constants/fonts";

const FACE_HEIGHT = 30;
const BORDER = 2;
const DROP = 3;
const RADIUS = 10;
const BUTTON_HEIGHT = FACE_HEIGHT + BORDER * 2;
const HEIGHT = BUTTON_HEIGHT + DROP;
const SHINE_WIDTH = 14;
const SHINE_CYCLE_MS = 4500;
const SHINE_IDLE_MS = SHINE_CYCLE_MS * 0.7;
const SHINE_SWEEP_MS = SHINE_CYCLE_MS * 0.15;
const SHINE_REST_MS = SHINE_CYCLE_MS - SHINE_IDLE_MS - SHINE_SWEEP_MS;
const NEW_BOB_MS = 800;
const PRESS_MS = 80;

type ShopButtonProps = {
  showNew: boolean;
  reduceMotion: boolean;
  onPress: () => void;
  label: string;
  newLabel: string;
  accessibilityLabel: string;
  accessibilityHint: string;
};

export function ShopButton({
  showNew,
  reduceMotion,
  onPress,
  label,
  newLabel,
  accessibilityLabel,
  accessibilityHint,
}: ShopButtonProps) {
  const shine = useSharedValue(0);
  const bob = useSharedValue(0);
  const pressed = useSharedValue(0);
  const faceWidth = useSharedValue(80);

  useEffect(() => {
    if (reduceMotion) {
      shine.value = 0;
      bob.value = 0;
      return;
    }
    shine.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(
          SHINE_IDLE_MS,
          withTiming(1, { duration: SHINE_SWEEP_MS, easing: Easing.inOut(Easing.ease) }),
        ),
        withDelay(SHINE_REST_MS, withTiming(1, { duration: 0 })),
      ),
      -1,
    );
    bob.value = withRepeat(
      withTiming(1, { duration: NEW_BOB_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduceMotion, shine, bob]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * DROP }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHINE_WIDTH * 2 + shine.value * (faceWidth.value + SHINE_WIDTH * 4) },
      { skewX: "-20deg" },
    ],
  }));
  const newStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduceMotion ? 0 : -2 * bob.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: PRESS_MS });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: PRESS_MS });
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={{ height: HEIGHT }}
    >
      <View style={{ height: HEIGHT, paddingBottom: DROP }}>
        <View
          style={{
            position: "absolute",
            top: DROP,
            left: 0,
            right: 0,
            height: BUTTON_HEIGHT,
            borderRadius: RADIUS,
            backgroundColor: ACH.outline,
          }}
        />
        <Animated.View
          onLayout={(e) => {
            faceWidth.value = e.nativeEvent.layout.width;
          }}
          style={[
            {
              height: BUTTON_HEIGHT,
              borderRadius: RADIUS,
              borderWidth: BORDER,
              borderColor: ACH.outline,
              overflow: "hidden",
            },
            faceStyle,
          ]}
        >
          <LinearGradient
            colors={ACH.shopGold}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 10,
              paddingRight: 12,
            }}
          >
            <BagIcon />
            <Text
              className="text-[12px] uppercase"
              style={{ fontFamily: Pixelify.bold, color: ACH.shopText, letterSpacing: 1.2 }}
            >
              {label}
            </Text>
          </LinearGradient>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: "rgba(255,255,255,0.55)",
            }}
          />
          {reduceMotion ? null : (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: -8,
                  bottom: -8,
                  left: 0,
                  width: SHINE_WIDTH,
                  backgroundColor: "rgba(255,255,255,0.75)",
                },
                shineStyle,
              ]}
            />
          )}
        </Animated.View>
      </View>
      {showNew ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              right: -7,
              top: -9,
              borderRadius: 6,
              borderWidth: BORDER,
              borderColor: ACH.outline,
              backgroundColor: ACH.shopNew,
              paddingHorizontal: 4,
              paddingVertical: 1,
            },
            newStyle,
          ]}
        >
          <Text className="text-[8px] uppercase text-white" style={{ fontFamily: Pixelify.bold, letterSpacing: 0.6 }}>
            {newLabel}
          </Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

/** Pixel shopping bag: an open handle sitting on a white, outlined body. */
function BagIcon() {
  return (
    <View style={{ width: 14, height: 16, alignItems: "center" }}>
      <View
        style={{
          width: 8,
          height: 6,
          borderWidth: BORDER,
          borderBottomWidth: 0,
          borderColor: ACH.shopText,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      />
      <View
        style={{
          width: 14,
          height: 10,
          borderWidth: BORDER,
          borderColor: ACH.shopText,
          borderRadius: 1,
          backgroundColor: "#ffffff",
        }}
      />
    </View>
  );
}
