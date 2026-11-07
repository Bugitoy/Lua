import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { METRIC_KEYS, METRICS, type MetricKey } from "@/components/stats/calendarMetrics";
import { Pixelify } from "@/constants/fonts";

type MetricButtonsProps = {
  value: MetricKey;
  onChange: (key: MetricKey) => void;
};

/** Steps / Distance / Goals / Work, sharing one row. */
export function MetricButtons({ value, onChange }: MetricButtonsProps) {
  const { t } = useTranslation();
  return (
    <View className="mb-3 flex-row gap-1">
      {METRIC_KEYS.map((key) => {
        const { icon, accent, labelKey } = METRICS[key];
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="min-w-0 flex-1 flex-row items-center justify-center gap-1 rounded-full px-1.5 py-1.5"
            style={{
              backgroundColor: active ? "#ffffff" : "transparent",
              borderWidth: 1.5,
              borderColor: active ? accent : "transparent",
            }}
          >
            <Ionicons name={icon} size={12} color={active ? accent : "#9ca3af"} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              className="shrink"
              style={{
                fontFamily: active ? Pixelify.bold : Pixelify.regular,
                fontSize: 11,
                color: active ? accent : "#9ca3af",
              }}
            >
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
