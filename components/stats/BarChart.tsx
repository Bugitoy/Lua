import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";

const CHART_H = 150;
const CURRENT = "#f59e0b";

export type ChartBar = {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  /** Drawn faintly behind the value (goals: the day's total). */
  total?: number;
  /** The value as text, shown above the chart when the bar is selected. */
  text: string;
  accessibilityLabel: string;
  /** Not reached yet: greyed out and not tappable. */
  future?: boolean;
  /** Today, or the hour it is now: amber label. */
  current?: boolean;
};

type BarChartProps = {
  bars: ChartBar[];
  accent: string;
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Shows the "Completed / Total" key for bars with a total. */
  showTotals?: boolean;
};

/** Tappable bars for the Stats calendar's Today and Week views. */
export function BarChart({ bars, accent, selectedKey, onSelect, showTotals }: BarChartProps) {
  const { t } = useTranslation();
  const peak = Math.max(1, ...bars.map((b) => Math.max(b.value, b.total ?? 0)));
  const selected = bars.find((b) => b.key === selectedKey);

  return (
    <View>
      <Text className="mb-2" style={{ fontFamily: Pixelify.bold, fontSize: 24, color: accent }}>
        {selected?.text ?? " "}
      </Text>

      {showTotals && (
        <View className="mb-2 flex-row gap-4">
          <LegendDot color={accent} label={t("stats.goalsLegend.completed")} />
          <LegendDot color={`${accent}33`} label={t("stats.goalsLegend.total")} />
        </View>
      )}

      <View style={{ height: CHART_H }}>
        {/* Grid lines */}
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: CHART_H }} pointerEvents="none">
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <View
              key={frac}
              style={{
                position: "absolute",
                top: (CHART_H - 1) * (1 - frac),
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: frac === 0 ? "#e5e7eb" : "#f3f4f6",
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_H }}>
          {bars.map((bar) => {
            const isSelected = bar.key === selectedKey;
            const valueH = Math.max((bar.value / peak) * CHART_H, bar.value > 0 ? 4 : 0);
            const totalH = Math.max(((bar.total ?? 0) / peak) * CHART_H, (bar.total ?? 0) > 0 ? 4 : 0);
            return (
              <Pressable
                key={bar.key}
                onPress={() => onSelect(bar.key)}
                disabled={bar.future}
                accessibilityLabel={bar.accessibilityLabel}
                accessibilityState={{ selected: isSelected }}
                style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: CHART_H }}
              >
                <View
                  style={{
                    width: "72%",
                    maxWidth: 40,
                    height: Math.max(valueH, totalH),
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  {totalH > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: totalH,
                        backgroundColor: `${accent}22`,
                      }}
                    />
                  )}
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: valueH,
                      backgroundColor: isSelected ? accent : `${accent}59`,
                    }}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Labels */}
      <View style={{ flexDirection: "row", marginTop: 8 }}>
        {bars.map((bar) => {
          const isSelected = bar.key === selectedKey;
          const color = isSelected ? accent : bar.current ? CURRENT : bar.future ? "#d4d4d4" : "#9ca3af";
          const bold = isSelected || bar.current;
          return (
            <View key={bar.key} style={{ flex: 1, alignItems: "center" }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: bold ? Pixelify.bold : Pixelify.regular, fontSize: 11, color }}
              >
                {bar.label}
              </Text>
              {bar.sublabel != null && (
                <Text style={{ fontFamily: bold ? Pixelify.bold : Pixelify.regular, fontSize: 11, color }}>
                  {bar.sublabel}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text className="text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
        {label}
      </Text>
    </View>
  );
}
