import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Pixelify } from "@/constants/fonts";
import { MAP_STOP_LOCATION_LABELS } from "@/constants/mapStops";

type LocationSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** When false, collapse the suggestion list (e.g. modal closed). */
  active: boolean;
};

export function LocationSearchField({
  value,
  onChange,
  active,
}: LocationSearchFieldProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!active) setMenuOpen(false);
  }, [active]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [...MAP_STOP_LOCATION_LABELS];
    return MAP_STOP_LOCATION_LABELS.filter((label) =>
      label.toLowerCase().includes(q),
    );
  }, [value]);

  const pick = useCallback(
    (label: string) => {
      onChange(label);
      setMenuOpen(false);
      Keyboard.dismiss();
    },
    [onChange],
  );

  return (
    <View className="z-10 mb-2">
      <View className="flex-row items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3">
        <Ionicons name="location-outline" size={20} color="#525252" />
        <TextInput
          value={value}
          onChangeText={(t) => {
            onChange(t);
            setMenuOpen(true);
          }}
          onFocus={() => setMenuOpen(true)}
          placeholder="Search campus locations…"
          placeholderTextColor="#a3a3a3"
          className="min-h-[48px] flex-1 py-3 pl-2 pr-2 text-base text-neutral-900"
          style={{ fontFamily: Pixelify.regular }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        <Pressable
          onPress={() => setMenuOpen((o) => !o)}
          hitSlop={8}
          accessibilityLabel={menuOpen ? "Hide location list" : "Show location list"}
        >
          <Ionicons
            name={menuOpen ? "chevron-up" : "chevron-down"}
            size={22}
            color="#525252"
          />
        </Pressable>
      </View>

      {menuOpen && active && filtered.length > 0 ? (
        <View
          className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white"
          style={{
            maxHeight: 220,
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
            style={{ maxHeight: 220 }}
          >
            {filtered.map((item) => (
              <Pressable
                key={item}
                onPress={() => pick(item)}
                className="border-b border-neutral-100 px-4 py-3.5 active:bg-neutral-50"
              >
                <Text
                  className="text-base text-neutral-900"
                  style={{ fontFamily: Pixelify.medium }}
                  numberOfLines={2}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {menuOpen && active && value.trim() && filtered.length === 0 ? (
        <View className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <Text
            className="text-sm text-neutral-500"
            style={{ fontFamily: Pixelify.regular }}
          >
            No locations match. Try a different search.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Returns the canonical label if `input` matches a map stop (case-insensitive), else null. */
export function matchMapStopLocation(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const exact = MAP_STOP_LOCATION_LABELS.find((l) => l === t);
  if (exact) return exact;
  return (
    MAP_STOP_LOCATION_LABELS.find((l) => l.toLowerCase() === t.toLowerCase()) ??
    null
  );
}
