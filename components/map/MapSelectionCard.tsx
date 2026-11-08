import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Animated, BackHandler, Pressable, Text, View } from "react-native";

import { formatXp } from "@/components/achievements/theme";
import type { MapSelection } from "@/components/map/GeoMapView";
import { MySpriteAvatar } from "@/components/profile/SpriteAvatar";
import { SCHEDULE_THEME_PRESETS } from "@/components/schedule/scheduleTypes";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import type { LocationCoords } from "@/hooks/useLocation";
import { useGameStats } from "@/lib/gameStats";
import type { LatLngPoint } from "@/lib/geo";
import { tickOffGoal } from "@/lib/goalCheckIn";
import { getAppLocale } from "@/lib/i18n/formatLocale";
import { distanceFromSpriteMeters, formatWalkingEta, walkingEtaMinutes } from "@/lib/mapMarker";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";
import { useProfile } from "@/lib/profileStore";
import type { ScheduledItem } from "@/lib/scheduleStore";
import { useWalkingRoute } from "@/lib/walkingRoute";

const INK = "#171717";
const MUTED = "#737373";
const TICK_GREEN = "#15803d";
const METERS_PER_MILE = 1609.344;

type MapSelectionCardProps = {
  selection: MapSelection;
  scheduledItems: ScheduledItem[];
  nearbyPlaces: NearbyPlace[];
  location: LocationCoords | null;
  destination: LatLngPoint | null;
  bottomInset: number;
  onClose: () => void;
  /** Sets the walking route to a point. */
  onWalkTo: (point: LatLngPoint) => void;
  onClearDestination: () => void;
};

/**
 * The card that slides up over the bottom of the map when a pin or the
 * sprite is tapped, in place of the map's own pop-up. Closes with ✕, a tap
 * on empty map, or Android's back button.
 */
export function MapSelectionCard(props: MapSelectionCardProps) {
  const { selection, scheduledItems, nearbyPlaces, destination, bottomInset, onClose } = props;
  const { t } = useTranslation();
  const slide = useRef(new Animated.Value(0)).current;
  const key = selection.kind === "goal" || selection.kind === "place" ? `${selection.kind}:${selection.id}` : selection.kind;

  // Slide in afresh for each new selection.
  useEffect(() => {
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
  }, [key, slide]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const goal = selection.kind === "goal" ? scheduledItems.find((item) => item.id === selection.id) : undefined;
  const place = selection.kind === "place" ? nearbyPlaces.find((p) => p.id === selection.id) : undefined;
  const gone =
    (selection.kind === "goal" && !goal) ||
    (selection.kind === "place" && !place) ||
    (selection.kind === "destination" && !destination);

  // The pin went away (goal removed, route cleared): nothing left to show.
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  if (gone) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: bottomInset + 12,
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }}
    >
      <View
        className="rounded-3xl bg-white px-4 pb-4 pt-4"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("map.card.close")}
          className="absolute right-3 top-3 z-10 size-8 items-center justify-center rounded-full bg-neutral-100 active:opacity-70"
        >
          <Ionicons name="close" size={16} color="#404040" />
        </Pressable>

        {goal ? <GoalBody goal={goal} {...props} /> : null}
        {selection.kind === "you" ? <YouBody location={props.location} /> : null}
        {selection.kind === "destination" && destination ? <DestinationBody {...props} destination={destination} /> : null}
        {place ? <PlaceBody place={place} {...props} /> : null}
      </View>
    </Animated.View>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function IconBubble({ children }: { children: ReactNode }) {
  return (
    <View className="size-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${LUA_GREEN}1a` }}>
      {children}
    </View>
  );
}

function Header({ icon, eyebrow, title, subtitle }: { icon: ReactNode; eyebrow?: ReactNode; title: string; subtitle?: string }) {
  return (
    <View className="flex-row items-center gap-3 pr-9">
      {icon}
      <View className="min-w-0 flex-1">
        {eyebrow}
        <Text numberOfLines={2} style={{ fontFamily: Pixelify.bold, fontSize: 17, lineHeight: 21, color: INK }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontFamily: Pixelify.medium, fontSize: 12, color: MUTED }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function CardButton({
  label,
  icon,
  primary,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-3 active:opacity-85"
      style={primary ? { backgroundColor: LUA_GREEN, borderColor: LUA_GREEN } : { backgroundColor: "#fff", borderColor: "#e5e5e5" }}
    >
      <Ionicons name={icon} size={16} color={primary ? "#fff" : INK} />
      <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, color: primary ? "#fff" : INK }}>{label}</Text>
    </Pressable>
  );
}

/**
 * "0.15 mi · 4 min walk" to a point along the real walking route, or
 * "~0.15 mi · …" from the straight-line estimate until a route is in.
 */
function useAwayText(location: LocationCoords | null, point: LatLngPoint | null): string | undefined {
  const { t } = useTranslation();
  const route = useWalkingRoute(location, point);
  if (!location || !point) return undefined;
  const meters = route ? route.remainingMeters : distanceFromSpriteMeters(location, point);
  const minutes = route ? route.remainingSeconds / 60 : walkingEtaMinutes(location, point);
  const miles = meters / METERS_PER_MILE;
  const distance = miles < 10 ? miles.toFixed(2) : String(Math.round(miles));
  return t("map.card.away", {
    distance: route ? distance : `~${distance}`,
    eta: formatWalkingEta(minutes),
  });
}

// ─── Bodies ───────────────────────────────────────────────────────────────────

function GoalBody({ goal, location, onWalkTo, onClose }: MapSelectionCardProps & { goal: ScheduledItem }) {
  const { t } = useTranslation();
  // A finished goal shows no distance, so it needs no route.
  const away = useAwayText(location, goal.completed ? null : goal);
  const preset = SCHEDULE_THEME_PRESETS[goal.themeKey] ?? SCHEDULE_THEME_PRESETS.academic;
  const reached = goal.reachedAtMs != null;
  const status = goal.completed
    ? { label: t("schedule.card.complete"), icon: "checkmark-circle" as const, color: TICK_GREEN, bg: "#dcfce7" }
    : reached
      ? { label: t("map.card.readyToTick"), icon: "flag" as const, color: TICK_GREEN, bg: "#f0fdf4" }
      : { label: t("schedule.card.notReached"), icon: "navigate-outline" as const, color: "#404040", bg: "#f5f5f5" };

  return (
    <>
      <Header
        icon={
          <IconBubble>
            <Ionicons name={preset.icon} size={22} color={LUA_GREEN} />
          </IconBubble>
        }
        eyebrow={
          <View className="flex-row items-center gap-1.5">
            <Text style={{ fontFamily: Pixelify.bold, fontSize: 12, color: LUA_GREEN }}>{goal.time}</Text>
            {goal.seriesId ? <Ionicons name="repeat" size={12} color={LUA_GREEN} /> : null}
          </View>
        }
        title={goal.title}
        subtitle={goal.location}
      />

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: status.bg }}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={{ fontFamily: Pixelify.bold, fontSize: 11, color: status.color }}>{status.label}</Text>
        </View>
        {away && !goal.completed ? (
          <Text style={{ fontFamily: Pixelify.medium, fontSize: 12, color: MUTED }}>{away}</Text>
        ) : null}
      </View>

      {goal.note ? (
        <Text numberOfLines={3} className="mt-3" style={{ fontFamily: Pixelify.regular, fontSize: 12, lineHeight: 17, color: "#404040" }}>
          {goal.note}
        </Text>
      ) : null}

      {!goal.completed ? (
        <View className="mt-4 flex-row gap-2">
          {reached ? (
            <CardButton label={t("schedule.card.tickOff")} icon="checkmark-circle-outline" primary onPress={() => tickOffGoal(goal.id)} />
          ) : (
            <CardButton
              label={t("map.card.walkHere")}
              icon="walk-outline"
              primary
              onPress={() => {
                onWalkTo(goal);
                onClose();
              }}
            />
          )}
        </View>
      ) : null}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-neutral-50 px-2 py-2.5">
      <Text style={{ fontFamily: Pixelify.bold, fontSize: 16, color: INK }}>{value}</Text>
      <Text style={{ fontFamily: Pixelify.medium, fontSize: 11, color: MUTED }}>{label}</Text>
    </View>
  );
}

function YouBody({ location }: { location: LocationCoords | null }) {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { stats } = useGameStats();
  const moving = location != null && !location.isStationary;

  return (
    <>
      <Header
        icon={<MySpriteAvatar size={44} />}
        eyebrow={
          <Text style={{ fontFamily: Pixelify.bold, fontSize: 12, color: LUA_GREEN }}>{t("map.markers.you")}</Text>
        }
        title={profile.displayName}
        subtitle={t(moving ? "map.card.walking" : "map.card.standingStill")}
      />
      <View className="mt-4 flex-row gap-2">
        <Stat value={formatXp(stats.stepsToday, getAppLocale())} label={t("map.card.steps")} />
        <Stat value={String(stats.distanceMiles)} label={t("map.card.miles")} />
        <Stat
          value={t("map.statsCard.goalsRatio", { done: stats.goalsDone, total: stats.goalsTotal })}
          label={t("map.card.goals")}
        />
      </View>
    </>
  );
}

function DestinationBody({
  destination,
  location,
  onClearDestination,
  onClose,
}: MapSelectionCardProps & { destination: LatLngPoint }) {
  const { t } = useTranslation();
  const away = useAwayText(location, destination);
  return (
    <>
      <Header
        icon={
          <IconBubble>
            <Ionicons name="flag-outline" size={22} color={LUA_GREEN} />
          </IconBubble>
        }
        title={t("map.markers.destination")}
        subtitle={away}
      />
      <Text className="mt-3" style={{ fontFamily: Pixelify.regular, fontSize: 12, lineHeight: 17, color: "#404040" }}>
        {t("map.markers.destinationDescription")}
      </Text>
      <View className="mt-4 flex-row gap-2">
        <CardButton
          label={t("map.liveTracking.clearPin")}
          icon="trash-outline"
          onPress={() => {
            onClearDestination();
            onClose();
          }}
        />
      </View>
    </>
  );
}

function PlaceBody({ place, location, onWalkTo, onClose }: MapSelectionCardProps & { place: NearbyPlace }) {
  const { t } = useTranslation();
  const away = useAwayText(location, place);
  return (
    <>
      <Header
        icon={
          <IconBubble>
            <Ionicons name="location-outline" size={22} color={LUA_GREEN} />
          </IconBubble>
        }
        title={place.title}
        subtitle={place.subtitle ?? away}
      />
      <View className="mt-4 flex-row gap-2">
        <CardButton
          label={t("map.card.walkHere")}
          icon="walk-outline"
          primary
          onPress={() => {
            onWalkTo(place);
            onClose();
          }}
        />
      </View>
    </>
  );
}
