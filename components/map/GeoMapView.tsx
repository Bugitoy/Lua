import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
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
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

function GeoMapViewImpl({
  currentLocation,
  destination,
  nearbyPlaces,
  onSetDestination,
}: GeoMapViewProps) {
  const initialRegion = useMemo(
    () => (currentLocation ? toRegion(currentLocation) : undefined),
    [currentLocation],
  );

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export const GeoMapView = memo(GeoMapViewImpl);
