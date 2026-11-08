import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export type ScheduleIconName = ComponentProps<typeof Ionicons>["name"];

export type ScheduleThemeKey = "academic" | "meal" | "social";

export type ScheduleItemData = {
  id: string;
  themeKey: ScheduleThemeKey;
  /** Display time, e.g. "3:39 PM", or an em dash when none was chosen. */
  time: string;
  /** Minutes after midnight for `time`; missing on goals saved before it existed. */
  minutes?: number | null;
  title: string;
  /** Optional detail, shown under the card's header. */
  note?: string;
  /** Display label for the place, shown on the gradient header. */
  location: string;
  /** Coordinates used for the map marker and arrival detection. */
  latitude: number;
  longitude: number;
  /** Nominatim osm_id or any provider id, used to de-dupe and recover place data. */
  placeId?: string;
  icon: ScheduleIconName;
  gradientColors: [string, string];
  glowColor: string;
  /** The repeating plan (in `goalPlans`) this goal is one day of. */
  seriesId?: string;
};

/** Everything a goal holds apart from where it lives: what the New goal sheet fills in. */
export type GoalFields = Omit<ScheduleItemData, "id" | "seriesId">;

export const SCHEDULE_THEME_PRESETS: Record<
  ScheduleThemeKey,
  Pick<ScheduleItemData, "gradientColors" | "glowColor"> & {
    icon: ScheduleIconName;
  }
> = {
  academic: {
    icon: "briefcase-outline",
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
