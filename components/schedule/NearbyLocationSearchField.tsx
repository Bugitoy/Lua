import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import {
  schedulePlacesSearchProvider,
  type NearbyPlace,
} from "@/lib/nearbyPlacesProvider";

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_RADIUS_METERS = 5000;

type NearbyLocationSearchFieldProps = {
  /** Currently entered query text. */
  value: string;
  onChangeQuery: (text: string) => void;
  /** Called when the user selects a search result. */
  onPick: (place: NearbyPlace) => void;
  /** User's current coordinates. When null we disable search and show a hint. */
  userLocation: { latitude: number; longitude: number } | null;
  /** When false (e.g. modal hidden) the suggestion list collapses. */
  active: boolean;
  /** Currently picked place — when set the field is shown in a "selected" state. */
  pickedTitle?: string | null;
  /** Clear the currently picked place. */
  onClearPick?: () => void;
};

export function NearbyLocationSearchField({
  value,
  onChangeQuery,
  onPick,
  userLocation,
  active,
  pickedTitle,
  onClearPick,
}: NearbyLocationSearchFieldProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) setMenuOpen(false);
  }, [active]);

  useEffect(() => {
    const trimmed = value.trim();
    if (!active || !userLocation || trimmed.length < 2 || pickedTitle) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const places = await schedulePlacesSearchProvider.getNearbyPlaces({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          radiusMeters: SEARCH_RADIUS_METERS,
          query: trimmed,
          signal: controller.signal,
          worldwide: true,
        });
        if (!controller.signal.aborted) {
          setResults(places);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : t("errors.searchFailed"),
          );
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [active, pickedTitle, t, userLocation?.latitude, userLocation?.longitude, value]);

  const pick = useCallback(
    (place: NearbyPlace) => {
      onPick(place);
      setMenuOpen(false);
      Keyboard.dismiss();
    },
    [onPick],
  );

  const clearPick = useCallback(() => {
    onClearPick?.();
    onChangeQuery("");
    setMenuOpen(true);
  }, [onChangeQuery, onClearPick]);

  const trimmed = value.trim();
  const showWaiting = !userLocation;
  const showResults =
    menuOpen && active && !pickedTitle && results.length > 0;
  const showEmpty =
    menuOpen &&
    active &&
    !pickedTitle &&
    !loading &&
    !error &&
    trimmed.length >= 2 &&
    results.length === 0;

  return (
    <View className="z-10 mb-2">
      <View
        className="flex-row items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3"
        style={{
          borderColor: pickedTitle ? "rgba(22,163,74,0.6)" : "#e5e5e5",
          backgroundColor: pickedTitle
            ? "rgba(22,163,74,0.06)"
            : "#fafafa",
        }}
      >
        <Ionicons
          name={pickedTitle ? "checkmark-circle" : "location-outline"}
          size={20}
          color={pickedTitle ? "#16a34a" : "#525252"}
        />
        {pickedTitle ? (
          <View className="min-h-[48px] flex-1 justify-center py-3 pl-2 pr-2">
            <Text
              className="text-base text-neutral-900"
              style={{ fontFamily: Pixelify.semibold }}
              numberOfLines={2}
            >
              {pickedTitle}
            </Text>
          </View>
        ) : (
          <TextInput
            value={value}
            onChangeText={(t) => {
              onChangeQuery(t);
              setMenuOpen(true);
            }}
            onFocus={() => setMenuOpen(true)}
            placeholder={
              showWaiting
                ? t("schedule.search.waitingForGps")
                : t("schedule.search.placeholder")
            }
            placeholderTextColor="#a3a3a3"
            className="min-h-[48px] flex-1 py-3 pl-2 pr-2 text-base text-neutral-900"
            style={{ fontFamily: Pixelify.regular }}
            autoCorrect={false}
            autoCapitalize="words"
            editable={!showWaiting}
          />
        )}

        {pickedTitle ? (
          <Pressable
            onPress={clearPick}
            hitSlop={8}
            accessibilityLabel={t("a11y.clearSelectedLocation")}
          >
            <Ionicons name="close-circle" size={22} color="#525252" />
          </Pressable>
        ) : loading ? (
          <ActivityIndicator size="small" color="#525252" />
        ) : null}
      </View>

      {showResults ? (
        <View
          className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white"
          style={{
            maxHeight: 260,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ maxHeight: 260 }}
          >
            {results.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => pick(place)}
                className="border-b border-neutral-100 px-4 py-3 active:bg-neutral-50"
              >
                <Text
                  className="text-base text-neutral-900"
                  style={{ fontFamily: Pixelify.medium }}
                  numberOfLines={1}
                >
                  {place.title}
                </Text>
                {place.subtitle ? (
                  <Text
                    className="mt-0.5 text-xs text-neutral-500"
                    style={{ fontFamily: Pixelify.regular }}
                    numberOfLines={1}
                  >
                    {place.subtitle}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {showEmpty ? (
        <View className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <Text
            className="text-sm text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
          >
            {t("schedule.search.noResults")}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <Text
            className="text-sm text-red-700"
            style={{ fontFamily: Pixelify.regular }}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
