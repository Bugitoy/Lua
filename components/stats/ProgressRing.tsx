import type { ReactNode } from "react";
import { View } from "react-native";

type ProgressRingProps = {
  size: number;
  thickness: number;
  /** 0 to 1; anything above 1 shows a full ring. */
  progress: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
};

/**
 * A ring that fills clockwise from the top, drawn with plain views.
 *
 * Each half of the ring is clipped to its side. A circle with only its top and
 * right borders coloured is a half ring; turned 45° it covers the right side,
 * and turned further it slides round to show any part of a half.
 */
export function ProgressRing({ size, thickness, progress, color, trackColor, children }: ProgressRingProps) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const half = size / 2;

  const arc = (degrees: number) => (
    <View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: half,
        borderWidth: thickness,
        borderTopColor: color,
        borderRightColor: color,
        borderBottomColor: "transparent",
        borderLeftColor: "transparent",
        transform: [{ rotate: `${degrees}deg` }],
      }}
    />
  );

  const clip = (side: "left" | "right", degrees: number) => (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: side === "left" ? 0 : half,
        width: half,
        height: size,
        overflow: "hidden",
      }}
    >
      <View style={{ position: "absolute", top: 0, left: side === "left" ? 0 : -half, width: size, height: size }}>
        {arc(degrees)}
      </View>
    </View>
  );

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: thickness,
          borderColor: trackColor,
        }}
      />
      {p >= 1 ? (
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: thickness,
            borderColor: color,
          }}
        />
      ) : p > 0 ? (
        <>
          {/* Right half: full once past halfway, otherwise the share up to `p`. */}
          {clip("right", p <= 0.5 ? 225 + p * 360 : 45)}
          {p > 0.5 && clip("left", 45 + (p - 0.5) * 360)}
        </>
      ) : null}
      {children}
    </View>
  );
}
