import { Ionicons } from "@expo/vector-icons";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  AnimatedRegion,
  Circle,
  Marker,
  MarkerAnimated,
  Polyline,
  type LongPressEvent,
  type MapPressEvent,
  type Region,
} from "react-native-maps";

import { LUA_GREEN, SPRITE_CHARACTER } from "@/constants/mapAssets";
import type { LatLngPoint } from "@/hooks/useDestinationTracking";
import type { FusedLocation } from "@/hooks/useFusedLocation";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";
import type { ScheduledItem } from "@/lib/scheduleStore";

const SPRITE_COLS = 4;
const SPRITE_ROWS = 4;
const SPRITE_FRAME_SIZE = 38;

/**
 * Sprite movement is driven by `Animated.timing(coords)` between GPS fixes.
 * The tween adapts to the actual inter-fix delta (so we don't finish in 450ms
 * and freeze for a second), but it is capped well below the typical 1500ms
 * fix cadence — otherwise a single noisy indoor fix would get fully painted
 * across the screen before the next correction can arrive, and the sprite
 * would always trail real position by the full inter-fix gap.
 */
const MARKER_ANIM_MIN_DURATION_MS = 250;
const MARKER_ANIM_MAX_DURATION_MS = 650;
const MARKER_ANIM_FIRST_FIX_DURATION_MS = 400;
const INITIAL_REGION_DELTA = 0.0075;
/** Hide GPS accuracy ring when zoomed out past this — fixed-meter circle shrinks on-screen and looks odd vs the sprite. */
const ACCURACY_CIRCLE_HIDE_WHEN_LAT_DELTA_GT = 0.002;
const GOAL_GLOW_RADIUS_METERS = 30;
const GOAL_PENDING_FILL = "rgba(250, 204, 21, 0.22)";
const GOAL_PENDING_STROKE = "rgba(250, 204, 21, 0.85)";
const GOAL_PENDING_PIN = "#facc15";
const GOAL_COMPLETED_FILL = "rgba(22, 163, 74, 0.22)";
const GOAL_COMPLETED_STROKE = "rgba(22, 163, 74, 0.9)";

type GeoMapViewProps = {
  currentLocation: FusedLocation | null;
  destination: LatLngPoint | null;
  nearbyPlaces: NearbyPlace[];
  scheduledItems?: ScheduledItem[];
  onSetDestination?: (point: LatLngPoint) => void;
  /** When false the map ignores taps, hides the recenter button, and disables long-press destination drops. */
  interactive?: boolean;
};

function regionFor(latitude: number, longitude: number): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: INITIAL_REGION_DELTA,
    longitudeDelta: INITIAL_REGION_DELTA,
  };
}

function headingToSpriteRow(heading: number | null): number | null {
  if (heading == null || heading < 0) return null;
  if (heading >= 315 || heading < 45) return 2; // up
  if (heading >= 45 && heading < 135) return 1; // right
  if (heading >= 135 && heading < 225) return 0; // down
  return 3; // left
}

function GeoMapViewImpl({
  currentLocation,
  destination,
  nearbyPlaces,
  scheduledItems = [],
  onSetDestination,
  interactive = true,
}: GeoMapViewProps) {
  const mapRef = useRef<MapView | null>(null);
  const hasCenteredOnUserRef = useRef(false);
  /** Wall-clock ms of the previous GPS fix, used to size the next marker tween. */
  const lastFixMsRef = useRef<number | null>(null);

  const animatedCoordinateRef = useRef<AnimatedRegion | null>(null);
  if (animatedCoordinateRef.current == null && currentLocation) {
    animatedCoordinateRef.current = new AnimatedRegion({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });
  }

  const [spriteFrame, setSpriteFrame] = useState(0);
  const [spriteRow, setSpriteRow] = useState(0);
  const [mapLatitudeDelta, setMapLatitudeDelta] = useState(INITIAL_REGION_DELTA);

  const isStationary = currentLocation?.isStationary ?? true;

  const initialRegion = useMemo(
    () =>
      currentLocation
        ? regionFor(currentLocation.latitude, currentLocation.longitude)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Smoothly animate the user marker between fixes at native level.
  useEffect(() => {
    if (!currentLocation) return;
    if (!animatedCoordinateRef.current) {
      animatedCoordinateRef.current = new AnimatedRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      lastFixMsRef.current = Date.now();
      return;
    }

    // Match the tween to the real inter-fix cadence (~800–1500ms typical) so the
    // marker keeps sliding instead of finishing a 450ms slide and sitting idle.
    const now = Date.now();
    const sincePrev =
      lastFixMsRef.current == null ? null : now - lastFixMsRef.current;
    lastFixMsRef.current = now;
    const duration =
      sincePrev == null
        ? MARKER_ANIM_FIRST_FIX_DURATION_MS
        : Math.min(
            MARKER_ANIM_MAX_DURATION_MS,
            Math.max(MARKER_ANIM_MIN_DURATION_MS, sincePrev),
          );

    animatedCoordinateRef.current
      .timing({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration,
        useNativeDriver: false,
        // `toValue` is required by the Animated typings, but AnimatedRegion#timing
        // ignores it and reads each axis (`latitude`, `longitude`, …) directly.
        toValue: 0,
      })
      .start();
  }, [currentLocation?.latitude, currentLocation?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recenter map once on the very first fix; afterwards we leave control to the user
  // and the explicit recenter button below.
  useEffect(() => {
    if (!currentLocation || !mapRef.current) return;
    if (hasCenteredOnUserRef.current) return;
    hasCenteredOnUserRef.current = true;
    mapRef.current.animateToRegion(
      regionFor(currentLocation.latitude, currentLocation.longitude),
      750,
    );
  }, [currentLocation]);

  // Sprite row: only adopt a new row when heading is actually known, otherwise hold last.
  useEffect(() => {
    const nextRow = headingToSpriteRow(currentLocation?.heading ?? null);
    if (nextRow != null) {
      setSpriteRow(nextRow);
    }
  }, [currentLocation?.heading]);

  // Walk cycle when moving, gentle idle bob when stationary.
  useEffect(() => {
    const cadenceMs = isStationary ? 520 : 170;
    const idleFrames = [0, 2] as const;

    const id = setInterval(() => {
      setSpriteFrame((prev) => {
        if (!isStationary) return (prev + 1) % SPRITE_COLS;
        return prev === idleFrames[0] ? idleFrames[1] : idleFrames[0];
      });
    }, cadenceMs);

    return () => clearInterval(id);
  }, [isStationary]);

  const pathCoordinates = useMemo(() => {
    if (!currentLocation || !destination) return [];
    return [
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      },
      destination,
    ];
  }, [currentLocation, destination]);

  const handlePress = (event: MapPressEvent | LongPressEvent) => {
    if (!interactive || !onSetDestination) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onSetDestination({ latitude, longitude });
  };

  const recenterOnUser = () => {
    if (!currentLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      regionFor(currentLocation.latitude, currentLocation.longitude),
      450,
    );
  };

  const accuracyRadius =
    currentLocation?.accuracy != null && currentLocation.accuracy > 0
      ? Math.min(currentLocation.accuracy, 60)
      : null;

  const showAccuracyCircle =
    accuracyRadius != null &&
    mapLatitudeDelta <= ACCURACY_CIRCLE_HIDE_WHEN_LAT_DELTA_GT;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        onLongPress={interactive ? handlePress : undefined}
        onPress={interactive ? handlePress : undefined}
        onRegionChangeComplete={(region) => {
          setMapLatitudeDelta(region.latitudeDelta);
        }}
      >
        {currentLocation && showAccuracyCircle ? (
          <Circle
            center={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            radius={accuracyRadius!}
            strokeColor="rgba(22, 163, 74, 0.45)"
            fillColor="rgba(22, 163, 74, 0.12)"
            strokeWidth={1}
          />
        ) : null}

        {scheduledItems.map((item) => (
          <Circle
            key={`glow-${item.id}`}
            center={{ latitude: item.latitude, longitude: item.longitude }}
            radius={GOAL_GLOW_RADIUS_METERS}
            fillColor={
              item.completed ? GOAL_COMPLETED_FILL : GOAL_PENDING_FILL
            }
            strokeColor={
              item.completed ? GOAL_COMPLETED_STROKE : GOAL_PENDING_STROKE
            }
            strokeWidth={2}
          />
        ))}

        {scheduledItems.map((item) => (
          <Marker
            key={`pin-${item.id}`}
            coordinate={{
              latitude: item.latitude,
              longitude: item.longitude,
            }}
            title={item.label}
            description={
              item.completed
                ? `${item.category} · Goal complete`
                : item.category
            }
            pinColor={item.completed ? LUA_GREEN : GOAL_PENDING_PIN}
            zIndex={100}
          />
        ))}

        {currentLocation && animatedCoordinateRef.current ? (
          <MarkerAnimated
            coordinate={animatedCoordinateRef.current as unknown as Region}
            anchor={{ x: 0.5, y: 0.55 }}
            tracksViewChanges
            zIndex={999}
            title="You"
          >
            <View style={styles.userSpriteFrame}>
              <Image
                source={SPRITE_CHARACTER}
                style={[
                  styles.userSpriteSheet,
                  {
                    transform: [
                      { translateX: -spriteFrame * SPRITE_FRAME_SIZE },
                      { translateY: -spriteRow * SPRITE_FRAME_SIZE },
                    ],
                  },
                ]}
              />
            </View>
          </MarkerAnimated>
        ) : null}

        {destination ? (
          <Marker
            coordinate={destination}
            title="Destination"
            description="Long press anywhere to move this marker"
            pinColor={LUA_GREEN}
          />
        ) : null}

        {pathCoordinates.length === 2 ? (
          <Polyline
            coordinates={pathCoordinates}
            strokeColor={LUA_GREEN}
            strokeWidth={4}
            lineDashPattern={[6, 8]}
          />
        ) : null}

        {nearbyPlaces.map((place) => (
          <Marker
            key={place.id}
            coordinate={{
              latitude: place.latitude,
              longitude: place.longitude,
            }}
            title={place.title}
            description={place.subtitle}
            pinColor="#f59e0b"
          />
        ))}
      </MapView>

      {interactive ? (
        <Pressable
          accessibilityLabel="Recenter on me"
          onPress={recenterOnUser}
          style={styles.recenterButton}
          hitSlop={8}
        >
          <Ionicons name="locate" size={18} color="#111827" />
        </Pressable>
      ) : null}

      {interactive && !currentLocation ? (
        <View style={styles.centeringHint}>
          <Text style={styles.centeringHintText}>Acquiring GPS location...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeringHint: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  centeringHintText: {
    color: "#ffffff",
    fontSize: 12,
  },
  userSpriteFrame: {
    width: SPRITE_FRAME_SIZE,
    height: SPRITE_FRAME_SIZE,
    overflow: "hidden",
  },
  userSpriteSheet: {
    width: SPRITE_FRAME_SIZE * SPRITE_COLS,
    height: SPRITE_FRAME_SIZE * SPRITE_ROWS,
  },
  recenterButton: {
    position: "absolute",
    top: 96,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});

export const GeoMapView = memo(GeoMapViewImpl);
