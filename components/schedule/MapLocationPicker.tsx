import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { type MapPressEvent, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN, MAP_REGION_DELTA } from "@/constants/mapAssets";
import { reverseGeocode, type NearbyPlace } from "@/lib/nearbyPlacesProvider";

/** Zoomed-out fallback when we have neither GPS nor a previous pick. */
const WORLD_REGION_DELTA = 60;
const REVERSE_DEBOUNCE_MS = 400;
const REVERSE_TIMEOUT_MS = 6000;
const PIN_SIZE = 44;

type LatLng = { latitude: number; longitude: number };

type MapLocationPickerProps = {
  /** Where the pin starts — the previous pick, or the user's position. */
  initial: LatLng | null;
  userLocation: LatLng | null;
  onCancel: () => void;
  onConfirm: (place: NearbyPlace) => void;
};

/**
 * Full-screen "move the map under a fixed pin" picker. The coordinate under
 * the pin is named via reverse geocoding; if that fails the pick is still
 * usable as a generic "Dropped pin".
 */
export function MapLocationPicker({
  initial,
  userLocation,
  onCancel,
  onConfirm,
}: MapLocationPickerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const initialRegion = useMemo<Region>(
    () =>
      initial
        ? {
            ...initial,
            latitudeDelta: MAP_REGION_DELTA,
            longitudeDelta: MAP_REGION_DELTA,
          }
        : {
            latitude: 20,
            longitude: 0,
            latitudeDelta: WORLD_REGION_DELTA,
            longitudeDelta: WORLD_REGION_DELTA,
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [center, setCenter] = useState<LatLng>({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });
  const [moving, setMoving] = useState(false);
  const [resolved, setResolved] = useState<NearbyPlace | null>(null);
  const [resolving, setResolving] = useState(false);

  // Name whatever is under the pin once the map settles.
  useEffect(() => {
    if (moving) return;
    const controller = new AbortController();
    setResolved(null);
    setResolving(true);
    const handle = setTimeout(async () => {
      try {
        const place = await reverseGeocode(
          center.latitude,
          center.longitude,
          controller.signal,
        );
        if (!controller.signal.aborted) setResolved(place);
      } catch {
        // Leave unresolved — confirm falls back to "Dropped pin".
      } finally {
        if (!controller.signal.aborted) setResolving(false);
      }
    }, REVERSE_DEBOUNCE_MS);
    // Give up on slow lookups so the pin can still be used as "Dropped pin".
    const giveUp = setTimeout(() => {
      controller.abort();
      setResolving(false);
    }, REVERSE_DEBOUNCE_MS + REVERSE_TIMEOUT_MS);
    return () => {
      clearTimeout(handle);
      clearTimeout(giveUp);
      controller.abort();
    };
  }, [center.latitude, center.longitude, moving]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setMoving(false);
    setCenter({ latitude: region.latitude, longitude: region.longitude });
  }, []);

  const moveTo = useCallback((point: LatLng, delta?: number) => {
    mapRef.current?.animateToRegion(
      {
        ...point,
        latitudeDelta: delta ?? MAP_REGION_DELTA,
        longitudeDelta: delta ?? MAP_REGION_DELTA,
      },
      350,
    );
  }, []);

  // Opened before the first GPS fix (world view): fly in once one arrives,
  // unless the user has already started moving the map themselves.
  const awaitingFirstFixRef = useRef(initial == null);
  const userMovedMapRef = useRef(false);
  useEffect(() => {
    if (!awaitingFirstFixRef.current || !userLocation) return;
    awaitingFirstFixRef.current = false;
    if (!userMovedMapRef.current) moveTo(userLocation);
  }, [userLocation, moveTo]);

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      userMovedMapRef.current = true;
      moveTo(e.nativeEvent.coordinate);
    },
    [moveTo],
  );

  const confirm = useCallback(() => {
    onConfirm({
      id:
        resolved?.id ??
        `pin:${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}`,
      title: resolved?.title ?? t("schedule.mapPicker.droppedPin"),
      latitude: center.latitude,
      longitude: center.longitude,
    });
  }, [center, onConfirm, resolved, t]);

  const busy = moving || resolving;
  const label = busy
    ? t("schedule.mapPicker.findingAddress")
    : (resolved?.title ?? t("schedule.mapPicker.droppedPin"));

  return (
    <View className="flex-1 bg-white">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPanDrag={() => {
          userMovedMapRef.current = true;
        }}
        onRegionChange={() => setMoving(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
      />

      {/* Fixed pin — its tip marks the map centre. */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <Ionicons name="location" size={PIN_SIZE} color={LUA_GREEN} />
      </View>

      <View
        className="absolute left-3 right-3 flex-row items-center rounded-2xl bg-white px-4 py-3"
        style={[styles.shadow, { top: insets.top + 8 }]}
      >
        <Pressable
          onPress={onCancel}
          hitSlop={12}
          accessibilityLabel={t("common.cancel")}
        >
          <Ionicons name="close" size={24} color="#525252" />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text
            className="text-base text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("schedule.mapPicker.title")}
          </Text>
          <Text
            className="text-xs text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
          >
            {t("schedule.mapPicker.hint")}
          </Text>
        </View>
      </View>

      {userLocation ? (
        <Pressable
          accessibilityLabel={t("a11y.recenterOnMe")}
          onPress={() => moveTo(userLocation)}
          hitSlop={8}
          className="absolute right-3 h-10 w-10 items-center justify-center rounded-full bg-white"
          style={[styles.shadow, { top: insets.top + 84 }]}
        >
          <Ionicons name="locate" size={18} color="#111827" />
        </Pressable>
      ) : null}

      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white px-5 pt-4"
        style={[
          styles.shadow,
          { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
      >
        <View className="mb-3 flex-row items-center">
          <Ionicons name="location-outline" size={20} color="#525252" />
          <Text
            className="ml-2 flex-1 text-base text-neutral-900"
            style={{ fontFamily: Pixelify.semibold }}
            numberOfLines={2}
          >
            {label}
          </Text>
          {busy ? <ActivityIndicator size="small" color="#525252" /> : null}
        </View>
        <Pressable
          onPress={confirm}
          disabled={busy}
          className="items-center rounded-xl py-3.5 active:opacity-90"
          style={{ backgroundColor: LUA_GREEN, opacity: busy ? 0.45 : 1 }}
        >
          <Text
            className="text-base text-white"
            style={{ fontFamily: Pixelify.bold }}
          >
            {t("schedule.mapPicker.confirm")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    // Put the pin's tip, not its middle, on the centre point.
    marginLeft: -PIN_SIZE / 2,
    marginTop: -PIN_SIZE + 4,
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
});
