import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LongPressEvent,
  type MapPressEvent,
  type Region,
} from "react-native-maps";

import { SPRITE_CHARACTER } from "@/constants/mapAssets";
import type { LatLngPoint } from "@/hooks/useDestinationTracking";
import type { LocationCoords } from "@/hooks/useLocation";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";

const SPRITE_COLS = 4;
const SPRITE_ROWS = 4;
const SPRITE_FRAME_SIZE = 38;
const MOVING_SPEED_THRESHOLD = 0.6;

type GeoMapViewProps = {
  currentLocation: LocationCoords | null;
  destination: LatLngPoint | null;
  nearbyPlaces: NearbyPlace[];
  onSetDestination: (point: LatLngPoint) => void;
};

function toRegion(location: LocationCoords): Region {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.004,
    longitudeDelta: 0.004,
  };
}

function headingToSpriteRow(heading: number | null): number {
  if (heading == null || heading < 0) return 0;
  if (heading >= 315 || heading < 45) return 2; // up
  if (heading >= 45 && heading < 135) return 1; // right
  if (heading >= 135 && heading < 225) return 0; // down
  return 3; // left
}

function GeoMapViewImpl({
  currentLocation,
  destination,
  nearbyPlaces,
  onSetDestination,
}: GeoMapViewProps) {
  const mapRef = useRef<any>(null);
  const hasCenteredOnUserRef = useRef(false);
  const [spriteFrame, setSpriteFrame] = useState(0);
  const [spriteRow, setSpriteRow] = useState(0);
  const isMoving = (currentLocation?.speed ?? 0) > MOVING_SPEED_THRESHOLD;
  const initialRegion = useMemo(
    () => (currentLocation ? toRegion(currentLocation) : undefined),
    [currentLocation],
  );

  useEffect(() => {
    if (!currentLocation || !mapRef.current) return;

    const region = toRegion(currentLocation);
    const animationDurationMs = hasCenteredOnUserRef.current ? 500 : 750;

    mapRef.current.animateToRegion(region, animationDurationMs);
    hasCenteredOnUserRef.current = true;
  }, [currentLocation]);

  useEffect(() => {
    setSpriteRow(headingToSpriteRow(currentLocation?.heading ?? null));
  }, [currentLocation?.heading]);

  useEffect(() => {
    const cadenceMs = isMoving ? 160 : 480;
    const idleFrames = [0, 2] as const;

    const id = setInterval(() => {
      setSpriteFrame((prev) => {
        if (isMoving) return (prev + 1) % SPRITE_COLS;
        return prev === idleFrames[0] ? idleFrames[1] : idleFrames[0];
      });
    }, cadenceMs);

    return () => clearInterval(id);
  }, [isMoving]);

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

  const onPress = (event: MapPressEvent | LongPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onSetDestination({ latitude, longitude });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        followsUserLocation
        showsMyLocationButton
        onLongPress={onPress}
        onPress={onPress}
      >
        {currentLocation ? (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
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
          </Marker>
        ) : null}

        {destination ? (
          <Marker
            coordinate={destination}
            title="Destination"
            description="Long press anywhere to move this marker"
            pinColor="#16a34a"
          />
        ) : null}

        {pathCoordinates.length === 2 ? (
          <Polyline
            coordinates={pathCoordinates}
            strokeColor="#16a34a"
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
      {!currentLocation ? (
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
});

export const GeoMapView = memo(GeoMapViewImpl);
