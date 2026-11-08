import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GeoMapView, type MapSelection } from "@/components/map/GeoMapView";
import { MapHealthBarCard } from "@/components/map/MapHealthBarCard";
import { MapSelectionCard } from "@/components/map/MapSelectionCard";
import { MapStatsCard } from "@/components/map/MapStatsCard";
import { MapTopBar } from "@/components/map/MapTopBar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import {
  formatWalkingEta,
  useDestinationTracking,
} from "@/hooks/useDestinationTracking";
import { useDistanceOdometer } from "@/hooks/useDistanceOdometer";
import { useFusedLocation } from "@/hooks/useFusedLocation";
import { useGameStats } from "@/lib/gameStats";
import { haversineMeters } from "@/lib/geo";
import {
  checkInAtGoals,
  GOAL_ARRIVAL_RADIUS_METERS,
  STUDY_EXIT_RADIUS_METERS,
} from "@/lib/goalCheckIn";
import {
  noopNearbyPlacesProvider,
  type NearbyPlace,
} from "@/lib/nearbyPlacesProvider";
import { useScheduledItems } from "@/lib/scheduleStore";
import { useWalkingRoute } from "@/lib/walkingRoute";
import {
  startStudySession,
  stopStudySession,
  useStudySession,
} from "@/lib/studySession";

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
  const { stats } = useGameStats();
  const studySession = useStudySession();
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const scheduledItems = useScheduledItems();
  const [studyCalloutGoalId, setStudyCalloutGoalId] = useState<string | null>(
    null,
  );
  /** The pin or sprite whose card is open. */
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const closeSelection = useCallback(() => setSelection(null), []);

  // Two-pass initialization: first render boots the GPS subscription in High mode;
  // once the user drops a destination we switch the same subscription to BestForNavigation.
  const [hasDestination, setHasDestination] = useState(false);
  const { location, gpsLocation, errorMsg } = useFusedLocation({
    highFidelity: hasDestination,
  });

  const {
    destination,
    distanceMeters: straightMeters,
    bearingDeg,
    etaMinutes: straightEtaMinutes,
    hasArrived,
    setDestination,
    clearDestination,
  } = useDestinationTracking(gpsLocation);

  // The real walk along streets. While it loads there's no line and no distance,
  // so a straight-line guess doesn't flash up first; only if it fails (or the pin
  // is a few steps away) does the straight line stand in.
  const { progress: destinationRoute, status: routeStatus } = useWalkingRoute(gpsLocation, destination);
  const findingRoute = routeStatus === "loading";
  const distanceMeters = destinationRoute?.remainingMeters ?? straightMeters;
  const etaMinutes =
    destinationRoute != null ? destinationRoute.remainingSeconds / 60 : straightEtaMinutes;
  const routeLine =
    routeStatus === "ready"
      ? "route"
      : routeStatus === "failed" || routeStatus === "near"
        ? "straight"
        : "none";

  useEffect(() => {
    setHasDestination(destination != null);
  }, [destination]);

  useDistanceOdometer(gpsLocation);

  /** Miles to the pin; "~" marks the straight-line estimate after a failed route. */
  const distanceMilesToDestination = useMemo(() => {
    if (distanceMeters == null) return null;
    const miles = (Math.round(distanceMeters * 0.000621371 * 100) / 100).toFixed(2);
    return routeStatus === "failed" ? `~${miles}` : miles;
  }, [routeStatus, distanceMeters]);

  useEffect(() => {
    let active = true;
    if (!gpsLocation) return;

    void noopNearbyPlacesProvider
      .getNearbyPlaces({
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        radiusMeters: 1200,
      })
      .then((places) => {
        if (!active) return;
        // A fresh empty array would re-render the whole map on every fix.
        setNearbyPlaces((prev) =>
          prev.length === 0 && places.length === 0 ? prev : places,
        );
      });

    return () => {
      active = false;
    };
  }, [gpsLocation]);

  // Goal arrival detection + academic study prompt routing.
  useEffect(() => {
    if (!gpsLocation) return;

    checkInAtGoals(gpsLocation);

    let nearestAcademic: (typeof scheduledItems)[number] | null = null;
    let nearestAcademicDist = Number.POSITIVE_INFINITY;

    for (const item of scheduledItems) {
      const d = haversineMeters(
        { latitude: gpsLocation.latitude, longitude: gpsLocation.longitude },
        { latitude: item.latitude, longitude: item.longitude },
      );

      const isAcademicGoal = item.themeKey === "academic";
      if (isAcademicGoal && d <= GOAL_ARRIVAL_RADIUS_METERS && d < nearestAcademicDist) {
        nearestAcademic = item;
        nearestAcademicDist = d;
      }
    }

    if (nearestAcademic) {
      setStudyCalloutGoalId(nearestAcademic.id);
      return;
    }

    if (!studyCalloutGoalId) return;
    const calloutGoal = scheduledItems.find((item) => item.id === studyCalloutGoalId);
    if (!calloutGoal) {
      setStudyCalloutGoalId(null);
      return;
    }

    const d = haversineMeters(
      { latitude: gpsLocation.latitude, longitude: gpsLocation.longitude },
      { latitude: calloutGoal.latitude, longitude: calloutGoal.longitude },
    );
    if (d > STUDY_EXIT_RADIUS_METERS) {
      setStudyCalloutGoalId(null);
    }
  }, [gpsLocation, scheduledItems, studyCalloutGoalId, studySession.activeGoalId]);

  const studyCalloutGoal = useMemo(
    () =>
      studyCalloutGoalId
        ? scheduledItems.find((item) => item.id === studyCalloutGoalId) ?? null
        : null,
    [scheduledItems, studyCalloutGoalId],
  );

  const isStudyingAtCalloutGoal =
    !!studyCalloutGoal &&
    studySession.activeGoalId === studyCalloutGoal.id &&
    studySession.startedAtMs != null;

  return (
    <View className="flex-1 bg-neutral-900">
      <GeoMapView
        currentLocation={location}
        destination={destination}
        routePath={routeLine === "route" ? (destinationRoute?.remainingPath ?? null) : null}
        showStraightLine={routeLine === "straight"}
        nearbyPlaces={nearbyPlaces}
        scheduledItems={scheduledItems}
        onSetDestination={setDestination}
        onSelect={setSelection}
      />

      <View className="absolute inset-0 z-10" pointerEvents="box-none">
        <MapTopBar topInset={insets.top} />
        <MapHealthBarCard
          healthRatio={stats.healthRatio}
          studyEligible={!!studyCalloutGoal}
          isStudying={isStudyingAtCalloutGoal}
          studyElapsedMs={isStudyingAtCalloutGoal ? studySession.elapsedMs : 0}
          studyStartedAtMs={
            isStudyingAtCalloutGoal ? studySession.startedAtMs : null
          }
          studyGoalLabel={studyCalloutGoal?.label}
          onBeginStudy={
            studyCalloutGoal
              ? () => startStudySession(studyCalloutGoal.id, stats.hoursStudied)
              : undefined
          }
          onStopStudy={() => {
            stopStudySession();
          }}
        />
        {selection ? (
          <MapSelectionCard
            selection={selection}
            scheduledItems={scheduledItems}
            nearbyPlaces={nearbyPlaces}
            location={gpsLocation}
            destination={destination}
            bottomInset={insets.bottom}
            onClose={closeSelection}
            onWalkTo={setDestination}
            onClearDestination={clearDestination}
          />
        ) : null}
        {/* The selection card takes the bottom of the map while it's open. */}
        <View className="absolute inset-0" pointerEvents="box-none" style={{ display: selection ? "none" : "flex" }}>
          <MapStatsCard
            goalsDone={stats.goalsDone}
            goalsTotal={stats.goalsTotal}
            distanceMiles={stats.distanceMiles}
            stepsToday={stats.stepsToday}
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
              {!destination
                ? t("map.liveTracking.longPressHint")
                : findingRoute
                  ? t("map.liveTracking.findingRoute")
                  : t("map.liveTracking.destinationAway", {
                      distance: distanceMilesToDestination ?? 0,
                    })}
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
                      eta: findingRoute
                        ? "…"
                        : etaMinutes != null
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
                {/* Lat and Lng share a row; a narrow box wraps them back onto two. */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10 }}>
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
                </View>
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
                        distance: findingRoute ? "…" : (distanceMilesToDestination ?? 0),
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
    </View>
  );
}
