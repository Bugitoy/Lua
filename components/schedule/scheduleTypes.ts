import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export type ScheduleIconName = ComponentProps<typeof Ionicons>["name"];

export type ScheduleThemeKey = "academic" | "meal" | "social";

export type ScheduleItemData = {
  id: string;
  time: string;
  category: string;
  title: string;
  /** Shown on the right side of the gradient header. */
  location: string;
  icon: ScheduleIconName;
  gradientColors: [string, string];
  glowColor: string;
};

export const SCHEDULE_THEME_PRESETS: Record<
  ScheduleThemeKey,
  Pick<ScheduleItemData, "gradientColors" | "glowColor"> & {
    icon: ScheduleIconName;
  }
> = {
  academic: {
    icon: "school-outline",
    gradientColors: ["#bbf7d0", "#4ade80"],
    glowColor: "#22c55e",
  },
  meal: {
    icon: "restaurant-outline",
    gradientColors: ["#fed7aa", "#fb923c"],
    glowColor: "#ea580c",
  },
  social: {
    icon: "people-outline",
    gradientColors: ["#bfdbfe", "#60a5fa"],
    glowColor: "#2563eb",
  },
};
