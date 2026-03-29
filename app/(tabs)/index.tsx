import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapCharacter } from "@/components/map/MapCharacter";
import { MapHealthBarCard } from "@/components/map/MapHealthBarCard";
import { MapStatsCard } from "@/components/map/MapStatsCard";
import { MapStops } from "@/components/map/MapStops";
import { MapTopBar } from "@/components/map/MapTopBar";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { Pixelify } from "@/constants/fonts";
import { CAMPUS_MAP } from "@/constants/mapAssets";
import { useEffect, useRef } from "react";
import { useGpsSprite } from "@/hooks/useGpsSprite";
import { useLocation } from "@/hooks/useLocation";
import { useMapPan } from "@/hooks/useMapPan";
import { MAP_STOPS } from "@/constants/mapStops";
import { useGameStats } from "@/lib/gameStats";
import { getLocationCategory, markLocationCompleted, useScheduledLocations } from "@/lib/scheduleStore";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { stats, updateStats } = useGameStats();
  const { location, errorMsg } = useLocation();
  const { normX, normY, direction, isMoving, distanceMeters } = useGpsSprite();
  const scheduledLocations = useScheduledLocations();

  // Prevents the streak from being incremented more than once per session
  const streakIncrementedRef = useRef(false);

  /**
   * Tracks the current Academic stop session.
   * hoursAtEntry = hoursStudied value when the sprite first entered — used as
   * the baseline so we just add elapsed hours on top without compounding.
   */
  const academicSessionRef = useRef<{
    label: string;
    enteredAt: number;
    hoursAtEntry: number;
  } | null>(null);

  // Proximity threshold in normalised units (~10 m real-world at NORM_PER_METER=0.005)
  const ARRIVAL_THRESHOLD = 0.05;

  useEffect(() => {
    MAP_STOPS.forEach((stop) => {
      if (!scheduledLocations.has(stop.label)) return;
      const dx = normX - stop.x;
      const dy = normY - stop.y;
      if (Math.sqrt(dx * dx + dy * dy) < ARRIVAL_THRESHOLD) {
        const isNew = markLocationCompleted(stop.label);
        if (isNew) {
          const newDone = stats.goalsDone + 1;
          const total = stats.goalsTotal;
          const newPercent = total > 0 ? Math.round((newDone / total) * 100) : 0;

          // All goals completed for the day — increment streak once
          const allDone = total > 0 && newDone >= total;
          const streakDelta =
            allDone && !streakIncrementedRef.current ? 1 : 0;
          if (allDone && !streakIncrementedRef.current) {
            streakIncrementedRef.current = true;
          }

          updateStats({
            goalsDone: newDone,
            goalDayPercent: newPercent,
            ...(streakDelta > 0 && { goalStreak: stats.goalStreak + 1 }),
          });
        }
      }
    });
  }, [normX, normY, scheduledLocations, stats.goalsDone, stats.goalsTotal, stats.goalStreak, updateStats]);

  // Detect entry into / exit from Academic stops and start/stop a study session
  useEffect(() => {
    let insideAcademic: string | null = null;

    MAP_STOPS.forEach((stop) => {
      if (!scheduledLocations.has(stop.label)) return;
      if (getLocationCategory(stop.label)?.toLowerCase() !== "academic") return;
      const dx = normX - stop.x;
      const dy = normY - stop.y;
      if (Math.sqrt(dx * dx + dy * dy) < ARRIVAL_THRESHOLD) {
        insideAcademic = stop.label;
      }
    });

    if (insideAcademic) {
      // Start session only on first entry (or if moved to a different academic stop)
      const session = academicSessionRef.current;
      if (!session || session.label !== insideAcademic) {
        academicSessionRef.current = {
          label: insideAcademic,
          enteredAt: Date.now(),
          hoursAtEntry: stats.hoursStudied,
        };
      }
    } else if (academicSessionRef.current) {
      // Left the location — write final elapsed time and clear session
      const elapsed = (Date.now() - academicSessionRef.current.enteredAt) / 3_600_000;
      updateStats({
        hoursStudied: Math.round((academicSessionRef.current.hoursAtEntry + elapsed) * 100) / 100,
      });
      academicSessionRef.current = null;
    }
  }, [normX, normY, scheduledLocations, stats.hoursStudied, updateStats]);

  // Convert accumulated GPS metres to miles and push to the shared store
  useEffect(() => {
    if (distanceMeters === 0) return;
    const miles = Math.round(distanceMeters * 0.000621371 * 100) / 100;
    updateStats({ distanceMiles: miles });
  }, [distanceMeters, updateStats]);

  // Tick every second to update hoursStudied in real-time while inside
  // an Academic location (normX/normY doesn't change when stationary).
  useEffect(() => {
    const id = setInterval(() => {
      const session = academicSessionRef.current;
      if (!session) return;
      const elapsed = (Date.now() - session.enteredAt) / 3_600_000;
      updateStats({
        hoursStudied:
          Math.round((session.hoursAtEntry + elapsed) * 100_000) / 100_000,
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [updateStats]);
  const {
    onViewportLayout,
    panGesture,
    mapPanStyle,
    mapW,
    mapH,
    mapScale,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
  } = useMapPan();

  return (
    <View className="flex-1 bg-neutral-900">
      <View className="flex-1 overflow-hidden" onLayout={onViewportLayout}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={mapPanStyle}>
            <ImageBackground
              source={CAMPUS_MAP}
              style={{ width: mapW, height: mapH }}
              resizeMode="contain"
            >
              <MapStops mapScale={mapScale} />
              <MapCharacter
                isMoving={isMoving}
                direction={direction}
                normX={normX}
                normY={normY}
                mapScale={mapScale}
              />
            </ImageBackground>
          </Animated.View>
        </GestureDetector>
      </View>

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
        <MapZoomControls
          bottomInset={insets.bottom}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />

        {/* GPS debug overlay — remove when done testing */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            bottom: insets.bottom + 90,
            backgroundColor: "rgba(0,0,0,0.72)",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            gap: 3,
            maxWidth: 220,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <Ionicons
              name={location ? "locate" : errorMsg ? "warning-outline" : "hourglass-outline"}
              size={12}
              color={location ? "#4ade80" : errorMsg ? "#f87171" : "#facc15"}
            />
            <Text style={{ fontFamily: Pixelify.bold, fontSize: 10, color: "#e5e5e5", letterSpacing: 1 }}>
              GPS DEBUG
            </Text>
          </View>
          {errorMsg ? (
            <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#f87171" }}>
              {errorMsg}
            </Text>
          ) : location ? (
            <>
              <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#d4d4d4" }}>
                Lat:  {location.latitude.toFixed(6)}
              </Text>
              <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#d4d4d4" }}>
                Lng:  {location.longitude.toFixed(6)}
              </Text>
              <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#a3a3a3" }}>
                Acc: ±{location.accuracy != null ? location.accuracy.toFixed(1) : "?"} m
              </Text>
              <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#a3a3a3" }}>
                Spd: {location.speed != null ? `${location.speed.toFixed(2)} m/s` : "n/a"}
              </Text>
              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 2 }} />
              <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#86efac" }}>
                Map ({normX.toFixed(3)}, {normY.toFixed(3)})
              </Text>
              <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#86efac" }}>
                Dir: {direction}  {isMoving ? "🚶" : "🧍"}
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: Pixelify.regular, fontSize: 10, color: "#facc15" }}>
              Requesting permission…
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
