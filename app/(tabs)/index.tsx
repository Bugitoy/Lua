import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GeoMapView } from "@/components/map/GeoMapView";
import { MapHealthBarCard } from "@/components/map/MapHealthBarCard";
import { MapStatsCard } from "@/components/map/MapStatsCard";
import { MapTopBar } from "@/components/map/MapTopBar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useDestinationTracking } from "@/hooks/useDestinationTracking";
import { useFusedLocation } from "@/hooks/useFusedLocation";
import { useGameStats } from "@/lib/gameStats";
import {
  noopNearbyPlacesProvider,
  type NearbyPlace,
} from "@/lib/nearbyPlacesProvider";

const DISTANCE_ACC_MIN_DELTA_METERS = 3;
const DISTANCE_ACC_MIN_SPEED_MPS = 0.4;
const M_PER_DEG_LAT = 111_000;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { stats, updateStats } = useGameStats();
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);

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
    // Don't accumulate distance while the stationary lock is engaged or speed is
    // below "actually moving" — this stops GPS jitter from inflating mileage.
    if (location.isStationary) {
      lastDistanceSampleRef.current = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      return;
    }
    if ((location.speed ?? 0) < DISTANCE_ACC_MIN_SPEED_MPS) return;

    const prev = lastDistanceSampleRef.current;
    if (!prev) {
      lastDistanceSampleRef.current = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      return;
    }

    const latMeters = (location.latitude - prev.latitude) * M_PER_DEG_LAT;
    const lngMeters =
      (location.longitude - prev.longitude) *
      (M_PER_DEG_LAT * Math.cos((location.latitude * Math.PI) / 180));
    const delta = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);

    if (delta >= DISTANCE_ACC_MIN_DELTA_METERS) {
      totalDistanceMetersRef.current += delta;
      lastDistanceSampleRef.current = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
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

  return (
    <View className="flex-1 bg-neutral-900">
      <GeoMapView
        currentLocation={location}
        destination={destination}
        nearbyPlaces={nearbyPlaces}
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
            right: 12,
            bottom: insets.bottom + 24,
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
              LIVE TRACKING
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
                  CLEAR PIN
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
              ? `Destination: ${distanceMilesToDestination ?? 0} mi away`
              : "Long press on the map to place a destination marker"}
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
                ? "Arrived at destination"
                : `Bearing: ${bearingDeg != null ? Math.round(bearingDeg) : "?"}°   ETA: ${
                    etaMinutes != null
                      ? `${Math.max(1, Math.round(etaMinutes))} min`
                      : "n/a"
                  }`}
            </Text>
          ) : null}
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            bottom: insets.bottom + 150,
            backgroundColor: "rgba(0,0,0,0.72)",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            gap: 3,
            maxWidth: 240,
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
              GPS DEBUG
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
                Lat:  {location.latitude.toFixed(5)}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#d4d4d4",
                }}
              >
                Lng:  {location.longitude.toFixed(5)}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#a3a3a3",
                }}
              >
                Acc: ±
                {location.accuracy != null
                  ? location.accuracy.toFixed(1)
                  : "?"}{" "}
                m
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: "#a3a3a3",
                }}
              >
                Spd:{" "}
                {location.speed != null
                  ? `${location.speed.toFixed(2)}`
                  : "n/a"}
                {"  raw: "}
                {location.rawDeviceSpeed != null
                  ? `${location.rawDeviceSpeed.toFixed(2)}`
                  : "n/a"}
                {" m/s"}
              </Text>
              <Text
                style={{
                  fontFamily: Pixelify.regular,
                  fontSize: 10,
                  color: location.isStationary ? "#a3a3a3" : "#86efac",
                }}
              >
                State: {location.isStationary ? "stationary" : "moving"}
                {location.compassHeading != null
                  ? `  •  ${Math.round(location.compassHeading)}°`
                  : ""}
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
                    Remaining: {distanceMilesToDestination ?? 0} mi
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
              Requesting permission…
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
