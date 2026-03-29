import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { MAP_SCALE, MAP_SRC_H, MAP_SRC_W } from "@/constants/mapAssets";
import { MAP_STOPS } from "@/constants/mapStops";
import { getContainedImageRect } from "@/lib/mapPanBounds";
import { useCompletedLocations, useScheduledLocations } from "@/lib/scheduleStore";

type MapStopsProps = {
  /** Must match `MAP_SCALE * zoom` from `useMapPan` (same as `ImageBackground` box). */
  mapScale?: number;
};

/**
 * Map markers + labels (matches `.MapStop` / `.MapPoint` / `.MapStop-label` from the HTML demo).
 */
export function MapStops({ mapScale = MAP_SCALE }: MapStopsProps) {
  const { width: vw, height: vh } = useWindowDimensions();
  const scheduledLocations = useScheduledLocations();
  const completedLocations = useCompletedLocations();

  const layout = useMemo(() => {
    if (vw <= 0 || vh <= 0) return null;
    return getContainedImageRect(vw, vh, mapScale, MAP_SRC_W, MAP_SRC_H);
  }, [vw, vh, mapScale]);

  const labelMaxWidth = vw > 0 ? Math.min(vw * 0.38, vw) : undefined;

  if (!layout) return null;

  return (
    <>
      {MAP_STOPS.map((s) => {
        const left = layout.ox + s.x * layout.rw;
        const top = layout.oy + s.y * layout.rh;
        const isCompleted = completedLocations.has(s.label);
        const isScheduled = !isCompleted && scheduledLocations.has(s.label);

        const dotSize    = isCompleted || isScheduled ? 16 : 14;
        const dotColor   = isCompleted ? "#22c55e" : isScheduled ? "#facc15" : "rgba(153,162,165,0.95)";
        const dotBorder  = isCompleted ? "#15803d" : isScheduled ? "#a16207" : "#fff";
        const glowColor  = isCompleted ? "#22c55e" : isScheduled ? "#facc15" : "#000";
        const labelColor = isCompleted ? "#15803d" : isScheduled ? "#854d0e" : "#494b4a";

        return (
          <View
            key={s.id}
            pointerEvents="none"
            className="absolute z-[2] items-center"
            style={{
              left,
              top,
              maxWidth: labelMaxWidth,
              transform: [{ translateX: "-50%" }, { translateY: "-50%" }],
            }}
          >
            <View
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: dotColor,
                borderWidth: 2,
                borderColor: dotBorder,
                shadowColor: glowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: isCompleted || isScheduled ? 0.75 : 0.25,
                shadowRadius: isCompleted || isScheduled ? 5 : 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={10} color="#fff" />
              )}
            </View>
            <Text
              className="mt-1.5 text-center leading-tight"
              style={{
                fontFamily: Pixelify.semibold,
                fontSize: 11,
                color: labelColor,
                textShadowColor: "#fff",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              }}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </>
  );
}
