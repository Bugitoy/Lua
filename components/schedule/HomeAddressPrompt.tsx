import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { NearbyLocationSearchField } from "@/components/schedule/NearbyLocationSearchField";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { showAppNotice } from "@/lib/appAlert";
import { homeFromPlace } from "@/lib/homeAddress";
import { reverseGeocode, type NearbyPlace } from "@/lib/nearbyPlacesProvider";
import { updateProfile, type HomeAddress } from "@/lib/profileStore";

type HomeAddressPromptProps = {
  userLocation: { latitude: number; longitude: number } | null;
  /** Keyboard height to keep clear of, so the card isn't hidden while typing. */
  bottomInset?: number;
  onCancel: () => void;
  /** Called once the home is saved to the profile. */
  onSaved: (home: HomeAddress) => void;
};

/**
 * "Set your home address": asks for a home the first time one is needed.
 * Goals without a place are then set at home. Drawn over the New goal sheet.
 */
export function HomeAddressPrompt({ userLocation, bottomInset = 0, onCancel, onSaved }: HomeAddressPromptProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<NearbyPlace | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const pick = useCallback((place: NearbyPlace) => {
    setPicked(place);
    setQuery(place.title);
  }, []);

  const fillCurrentLocation = useCallback(async () => {
    if (!userLocation) {
      showAppNotice(
        {
          icon: "locate-outline",
          tone: "primary",
          title: t("schedule.homePrompt.title"),
          message: t("schedule.search.waitingForGps"),
        },
        t("common.ok"),
      );
      return;
    }
    setLocating(true);
    let place: NearbyPlace | null = null;
    try {
      place = await reverseGeocode(userLocation.latitude, userLocation.longitude);
    } catch {
      // Fall back to the bare coordinates below.
    }
    if (!mounted.current) return;
    setLocating(false);
    pick(
      place
        ? { ...place, latitude: userLocation.latitude, longitude: userLocation.longitude }
        : {
            id: `${userLocation.latitude},${userLocation.longitude}`,
            title: t("schedule.homePrompt.myLocation"),
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
    );
  }, [pick, t, userLocation]);

  const save = useCallback(async () => {
    if (!picked) return;
    const home = homeFromPlace(picked);
    setSaving(true);
    try {
      await updateProfile({ home });
      onSaved(home);
    } catch {
      showAppNotice(
        {
          icon: "alert-circle-outline",
          tone: "danger",
          title: t("manageProfile.errorTitle"),
          message: t("manageProfile.errorSave"),
        },
        t("common.ok"),
      );
    } finally {
      setSaving(false);
    }
  }, [onSaved, picked, t]);

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-black/45 px-5"
      style={{ paddingBottom: bottomInset }}
    >
      <Pressable className="absolute inset-0" onPress={onCancel} accessibilityLabel={t("schedule.homePrompt.notNow")} />
      <View
        className="w-full max-w-[400px] rounded-3xl bg-white px-5 pb-5 pt-6"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        <View
          className="mb-3 size-14 items-center justify-center self-center rounded-full"
          style={{ backgroundColor: "rgba(22,163,74,0.1)" }}
        >
          <Ionicons name="home-outline" size={24} color={LUA_GREEN} />
        </View>
        <Text
          className="mb-1.5 text-center text-neutral-900"
          style={{ fontFamily: Pixelify.bold, fontSize: 18 }}
          accessibilityRole="header"
        >
          {t("schedule.homePrompt.title")}
        </Text>
        <Text
          className="mb-5 text-center text-neutral-500"
          style={{ fontFamily: Pixelify.regular, fontSize: 13, lineHeight: 18 }}
        >
          {t("schedule.homePrompt.body")}
        </Text>

        <NearbyLocationSearchField
          value={query}
          onChangeQuery={setQuery}
          onPick={pick}
          userLocation={userLocation}
          active
          pickedTitle={picked?.title ?? null}
          onClearPick={() => setPicked(null)}
          compact
          placeholder={t("manageProfile.homePlaceholder")}
        />

        <Pressable
          onPress={fillCurrentLocation}
          disabled={locating}
          accessibilityRole="button"
          className="mb-4 mt-1 flex-row items-center justify-center gap-2 rounded-xl border border-neutral-200 py-3 active:opacity-70"
        >
          {locating ? (
            <ActivityIndicator size="small" color={LUA_GREEN} />
          ) : (
            <Ionicons name="locate" size={16} color={LUA_GREEN} />
          )}
          <Text style={{ fontFamily: Pixelify.semibold, fontSize: 13, color: LUA_GREEN }}>
            {t("schedule.homePrompt.useCurrent")}
          </Text>
        </Pressable>

        <View className="flex-row gap-3">
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            className="flex-1 items-center rounded-xl bg-neutral-100 py-3.5 active:opacity-80"
          >
            <Text className="text-neutral-700" style={{ fontFamily: Pixelify.semibold, fontSize: 14 }}>
              {t("schedule.homePrompt.notNow")}
            </Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!picked || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !picked || saving }}
            className="flex-1 items-center rounded-xl py-3.5 active:opacity-90"
            style={{ backgroundColor: LUA_GREEN, opacity: picked && !saving ? 1 : 0.45 }}
          >
            <Text className="text-white" style={{ fontFamily: Pixelify.bold, fontSize: 14 }}>
              {t("schedule.homePrompt.save")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
