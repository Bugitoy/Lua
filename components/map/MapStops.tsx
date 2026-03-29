import { useMemo } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { MAP_STOPS } from "@/constants/mapStops";
import { MAP_SCALE, MAP_SRC_H, MAP_SRC_W } from "@/constants/mapAssets";
import { getContainedImageRect } from "@/lib/mapPanBounds";

type MapStopsProps = {
  /** Must match `MAP_SCALE * zoom` from `useMapPan` (same as `ImageBackground` box). */
  mapScale?: number;
};

/**
 * Map markers + labels (matches `.MapStop` / `.MapPoint` / `.MapStop-label` from the HTML demo).
 */
export function MapStops({ mapScale = MAP_SCALE }: MapStopsProps) {
  const { width: vw, height: vh } = useWindowDimensions();

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
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "rgba(153, 162, 165, 0.95)",
                borderWidth: 2,
                borderColor: "#fff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.25,
                shadowRadius: 1,
              }}
            />
            <Text
              className="mt-1.5 text-center leading-tight"
              style={{
                fontFamily: Pixelify.semibold,
                fontSize: 11,
                color: "#494b4a",
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
