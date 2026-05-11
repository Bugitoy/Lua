import { memo, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LongPressEvent,
  type MapPressEvent,
  type Region,
} from "react-native-maps";

import type { LatLngPoint } from "@/hooks/useDestinationTracking";
import type { LocationCoords } from "@/hooks/useLocation";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";

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

function GeoMapViewImpl({
  currentLocation,
  destination,
  nearbyPlaces,
  onSetDestination,
}: GeoMapViewProps) {
  const mapRef = useRef<any>(null);
  const hasCenteredOnUserRef = useRef(false);
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
        showsUserLocation
        followsUserLocation
        showsMyLocationButton
        onLongPress={onPress}
        onPress={onPress}
      >
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
});

export const GeoMapView = memo(GeoMapViewImpl);
