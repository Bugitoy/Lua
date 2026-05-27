import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GeoMapView } from "@/components/map/GeoMapView";
import { MapHealthBarCard } from "@/components/map/MapHealthBarCard";
import { MapStatsCard } from "@/components/map/MapStatsCard";
import { MapTopBar } from "@/components/map/MapTopBar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import {
  formatWalkingEta,
  useDestinationTracking,
} from "@/hooks/useDestinationTracking";
import { useFusedLocation } from "@/hooks/useFusedLocation";
import { useGameStats } from "@/lib/gameStats";
import { haversineMeters } from "@/lib/geo";
import {
  noopNearbyPlacesProvider,
  type NearbyPlace,
} from "@/lib/nearbyPlacesProvider";
import { markGoalCompleted, useScheduledItems } from "@/lib/scheduleStore";

const DISTANCE_ACC_MIN_DELTA_METERS = 3;
/** Smoothed-speed floor low enough that light walking registers after stationary unlock. */
const DISTANCE_ACC_MIN_SPEED_MPS = 0.52;
/** Discard segment if implied Δ/Δt doesn’t look like a walk (reject teleports + creeping drift). */
const DISTANCE_IMPLIED_SPEED_MIN_MPS = 0.45;
const DISTANCE_IMPLIED_SPEED_MAX_MPS = 3.1;
const M_PER_DEG_LAT = 111_000;
const GOAL_ARRIVAL_RADIUS_METERS = 25;

/** Mirrors [MapStatsCard](components/map/MapStatsCard.tsx) layout so overlays don't collide. */
const MAP_STATS_MAX_WIDTH = 180;
const MAP_STATS_WIDTH_RATIO = 0.58;
const LIVE_TRACKING_MAX_WIDTH = 320;
const LIVE_TRACKING_GUTTER = 10;

export default function MapScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const statsCardVisualWidth = Math.min(
    MAP_STATS_MAX_WIDTH,
    windowWidth * MAP_STATS_WIDTH_RATIO,
  );
  /** Space reserved on the right for `MapStatsCard` (same as its `right` + width + gutter). */
  const statsBandFromRight =
    12 + statsCardVisualWidth + LIVE_TRACKING_GUTTER;
  const liveTrackingAvailable = windowWidth - 12 - statsBandFromRight;
  const liveTrackingWidth = Math.min(
    LIVE_TRACKING_MAX_WIDTH,
    Math.max(96, liveTrackingAvailable),
  );
  const { stats, updateStats } = useGameStats();
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const scheduledItems = useScheduledItems();

  // Two-pass initialization: first render boots the GPS subscription in High mode;
  // once the user drops a destination we switch the same subscription to BestForNavigation.
  const [hasDestination, setHasDestination] = useState(false);
  const { location, errorMsg } = useFusedLocation({
    highFidelity: hasDestination,
  });

  const {
    destination,
    distanceMeters,
    bearingDeg,
    etaMinutes,
    hasArrived,
    setDestination,
    clearDestination,
  } = useDestinationTracking(location);

  useEffect(() => {
    setHasDestination(destination != null);
  }, [destination]);

  const lastDistanceSampleRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const lastDistanceAtMsRef = useRef<number | null>(null);
  const totalDistanceMetersRef = useRef(0);

  const distanceMilesToDestination = useMemo(
    () =>
      distanceMeters != null
        ? Math.round(distanceMeters * 0.000621371 * 100) / 100
        : null,
    [distanceMeters],
  );

  useEffect(() => {
    if (!location) return;
    const now = Date.now();

    // Don't accumulate distance while the stationary lock is engaged or speed is
    // below "actually moving" — this stops GPS jitter from inflating mileage.
    if (location.isStationary) {
      lastDistanceSampleRef.current = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      lastDistanceAtMsRef.current = now;
      return;
    }
    if ((location.speed ?? 0) < DISTANCE_ACC_MIN_SPEED_MPS) return;

    const prev = lastDistanceSampleRef.current;
    if (!prev) {
      lastDistanceSampleRef.current = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      lastDistanceAtMsRef.current = now;
      return;
    }

    const latMeters = (location.latitude - prev.latitude) * M_PER_DEG_LAT;
    const lngMeters =
      (location.longitude - prev.longitude) *
      (M_PER_DEG_LAT * Math.cos((location.latitude * Math.PI) / 180));
    const delta = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);

    if (delta >= DISTANCE_ACC_MIN_DELTA_METERS) {
      const prevAt = lastDistanceAtMsRef.current;
      // Need a sane Δt — first qualifying hop after bootstrap only primes the baseline.
      if (prevAt == null) {
        lastDistanceSampleRef.current = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        lastDistanceAtMsRef.current = now;
        return;
      }

      const dtSec = Math.max(0.2, (now - prevAt) / 1000);
      const impliedMps = delta / dtSec;
      if (
        impliedMps < DISTANCE_IMPLIED_SPEED_MIN_MPS ||
        impliedMps > DISTANCE_IMPLIED_SPEED_MAX_MPS
      ) {
        lastDistanceSampleRef.current = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        lastDistanceAtMsRef.current = now;
        return;
      }

      totalDistanceMetersRef.current += delta;
      lastDistanceSampleRef.current = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      lastDistanceAtMsRef.current = now;
      const miles =
        Math.round(totalDistanceMetersRef.current * 0.000621371 * 100) / 100;
      updateStats({ distanceMiles: miles });
    }
  }, [location, updateStats]);

  useEffect(() => {
    let active = true;
    if (!location) return;

    void noopNearbyPlacesProvider
      .getNearbyPlaces({
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: 1200,
      })
      .then((places) => {
        if (active) setNearbyPlaces(places);
      });

    return () => {
      active = false;
    };
  }, [location]);

  // Goal arrival detection: any incomplete scheduled item within range gets
  // flagged as completed. The schedule store de-dupes so this is safe to run
  // on every fix.
  useEffect(() => {
    if (!location) return;
    for (const item of scheduledItems) {
      if (item.completed) continue;
      const d = haversineMeters(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: item.latitude, longitude: item.longitude },
      );
      if (d <= GOAL_ARRIVAL_RADIUS_METERS) {
        markGoalCompleted(item.id);
      }
    }
  }, [location, scheduledItems]);

  return (
    <View className="flex-1 bg-neutral-900">
      <GeoMapView
        currentLocation={location}
        destination={destination}
        nearbyPlaces={nearbyPlaces}
        scheduledItems={scheduledItems}
        onSetDestination={setDestination}
      />

      <View className="absolute inset-0 z-10" pointerEvents="box-none">
        <MapTopBar topInset={insets.top} />
        <MapHealthBarCard healthRatio={stats.healthRatio} />
        <MapStatsCard
          goalsDone={stats.goalsDone}
          goalsTotal={stats.goalsTotal}
          goalDayPercent={stats.goalDayPercent}
          distanceMiles={stats.distanceMiles}
          bottomInset={insets.bottom}
        />
        <View
          pointerEvents="auto"
          style={{
            position: "absolute",
            left: 12,
            bottom: insets.bottom + 24,
            width: liveTrackingWidth,
            backgroundColor: "rgba(0,0,0,0.75)",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: Pixelify.bold,
                fontSize: 11,
                color: "#e5e5e5",
                letterSpacing: 0.6,
              }}
            >
              {t("map.liveTracking.title")}
            </Text>
            {destination ? (
              <Pressable onPress={clearDestination} hitSlop={8}>
                <Text
                  style={{
                    fontFamily: Pixelify.bold,
                    fontSize: 10,
                    color: LUA_GREEN,
                  }}
                >
                  {t("map.liveTracking.clearPin")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text
            style={{
              fontFamily: Pixelify.regular,
              fontSize: 10,
              color: "#d4d4d4",
            }}
          >
            {destination
              ? t("map.liveTracking.destinationAway", {
                  distance: distanceMilesToDestination ?? 0,
                })
              : t("map.liveTracking.longPressHint")}
          </Text>
          {destination ? (
            <Text
              style={{
                fontFamily: Pixelify.regular,
                fontSize: 10,
                color: hasArrived ? "#86efac" : "#a3a3a3",
              }}
            >
              {hasArrived
                ? t("map.liveTracking.arrived")
                : t("map.liveTracking.bearingEta", {
                    bearing:
                      bearingDeg != null ? Math.round(bearingDeg) : "?",
                    eta:
                      etaMinutes != null
                        ? formatWalkingEta(etaMinutes)
                        : t("common.notAvailable"),
                  })}
            </Text>
          ) : null}
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 12,
            bottom: insets.bottom + 100,
            width: liveTrackingWidth,
            backgroundColor: "rgba(0,0,0,0.72)",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 3,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginBottom: 2,
            }}
          >
            <Ionicons
              name={
                location
                  ? "locate"
                  : errorMsg
                    ? "warning-outline"
                    : "hourglass-outline"
              }
              size={12}
              color={location ? "#4ade80" : errorMsg ? "#f87171" : "#facc15"}
            />
            <Text
              style={{
                fontFamily: Pixelify.bold,
                fontSize: 10,
                color: "#e5e5e5",
                letterSpacing: 1,
              }}
            >
              {t("map.gpsDebug.title")}
            </Text>
          </View>
          {errorMsg ? (
            <Text
              style={{
                fontFamily: Pixelify.regular,
                fontSize: 10,
                color: "#f87171",
              }}
            >
              {errorMsg}
            </Text>
          ) : location ? (
            <>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#d4d4d4",
                }}
              >
                {t("map.gpsDebug.lat", {
                  value: location.latitude.toFixed(5),
                })}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#d4d4d4",
                }}
              >
                {t("map.gpsDebug.lng", {
                  value: location.longitude.toFixed(5),
                })}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#a3a3a3",
                }}
              >
                {t("map.gpsDebug.accuracy", {
                  value:
                    location.accuracy != null
                      ? location.accuracy.toFixed(1)
                      : "?",
                })}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#a3a3a3",
                }}
              >
                {t("map.gpsDebug.speed", {
                  speed:
                    location.speed != null
                      ? location.speed.toFixed(2)
                      : t("common.notAvailable"),
                  rawSpeed:
                    location.rawDeviceSpeed != null
                      ? location.rawDeviceSpeed.toFixed(2)
                      : t("common.notAvailable"),
                })}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: location.isStationary ? "#a3a3a3" : "#86efac",
                }}
              >
                {location.isStationary
                  ? t("map.gpsDebug.stateStationary")
                  : location.compassHeading != null
                    ? t("map.gpsDebug.stateMovingWithHeading", {
                        heading: Math.round(location.compassHeading),
                      })
                    : t("map.gpsDebug.stateMoving")}
              </Text>
              {destination ? (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "rgba(255,255,255,0.12)",
                      marginVertical: 2,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: Pixelify.regular,
                      fontSize: 10,
                      color: "#86efac",
                    }}
                  >
                    {t("map.liveTracking.remaining", {
                      distance: distanceMilesToDestination ?? 0,
                    })}
                  </Text>
                </>
              ) : null}
            </>
          ) : (
            <Text
              style={{
                fontFamily: Pixelify.regular,
                fontSize: 10,
                color: "#facc15",
              }}
            >
              {t("map.gpsDebug.requestingPermission")}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
