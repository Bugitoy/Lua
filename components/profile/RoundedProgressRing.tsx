import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type RoundedProgressRingProps = {
  size: number;
  thickness: number;
  /** 0 to 1; anything above 1 shows a full ring. */
  progress: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
};

/** A ring that fills clockwise from the top, with soft round ends on the filled arc. */
export function RoundedProgressRing({
  size,
  thickness,
  progress,
  color,
  trackColor,
  children,
}: RoundedProgressRingProps) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const center = size / 2;
  const radius = (size - thickness) / 2;

  const arc = useMemo(() => {
    const path = Skia.Path.Make();
    const bounds = Skia.XYWHRect(thickness / 2, thickness / 2, size - thickness, size - thickness);
    if (p >= 1) path.addOval(bounds);
    else path.addArc(bounds, -90, p * 360);
    return path;
  }, [p, size, thickness]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={center} cy={center} r={radius} color={trackColor} style="stroke" strokeWidth={thickness} />
        {p > 0 && <Path path={arc} color={color} style="stroke" strokeWidth={thickness} strokeCap="round" />}
      </Canvas>
      {children}
    </View>
  );
}
