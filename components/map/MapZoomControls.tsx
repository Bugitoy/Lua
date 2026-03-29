import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";

type MapZoomControlsProps = {
  bottomInset: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapZoomControls({
  bottomInset,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}: MapZoomControlsProps) {
  return (
    <View
      className="absolute z-[11] flex-row items-center gap-0.5 rounded-xl border border-black/10 bg-white/95 shadow-md"
      style={{
        left: 16,
        bottom: bottomInset + 30,
        paddingHorizontal: 6,
        paddingVertical: 5,
      }}
      pointerEvents="auto"
    >
      <Pressable
        accessibilityLabel="Zoom out map"
        hitSlop={8}
        disabled={!canZoomOut}
        onPress={onZoomOut}
        className="h-10 w-10 items-center justify-center rounded-lg active:bg-neutral-100"
        style={{ opacity: canZoomOut ? 1 : 0.35 }}
      >
        <Ionicons name="remove" size={22} color="#171717" />
      </Pressable>
      <Text
        className="mx-1 text-xs text-neutral-500"
        style={{ fontFamily: Pixelify.semibold }}
      >
        Zoom
      </Text>
      <Pressable
        accessibilityLabel="Zoom in map"
        hitSlop={8}
        disabled={!canZoomIn}
        onPress={onZoomIn}
        className="h-10 w-10 items-center justify-center rounded-lg active:bg-neutral-100"
        style={{ opacity: canZoomIn ? 1 : 0.35 }}
      >
        <Ionicons name="add" size={22} color="#171717" />
      </Pressable>
    </View>
  );
}
