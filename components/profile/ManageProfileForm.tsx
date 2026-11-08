import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { MySpriteAvatar } from "@/components/profile/SpriteAvatar";
import { MapLocationPicker } from "@/components/schedule/MapLocationPicker";
import { NearbyLocationSearchField } from "@/components/schedule/NearbyLocationSearchField";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useLocation } from "@/hooks/useLocation";
import { homeFromPlace } from "@/lib/homeAddress";
import type { NearbyPlace } from "@/lib/nearbyPlacesProvider";
import {
  isValidHandle,
  normalizeHandle,
  updateProfile,
  useProfile,
  type HomeAddress,
} from "@/lib/profileStore";


export function ManageProfileForm() {
  const { t } = useTranslation();
  const { profile, isReady } = useProfile();
  const hydratedForm = useRef(false);

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [home, setHome] = useState<HomeAddress | null>(profile.home);
  const [homeQuery, setHomeQuery] = useState(profile.home?.address ?? "");
  const [mapOpen, setMapOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // The address search ranks results near where the user is.
  const { location } = useLocation();
  const lat = location?.latitude;
  const lng = location?.longitude;
  const userLocation = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  useEffect(() => {
    if (!isReady || hydratedForm.current) return;
    hydratedForm.current = true;
    setDisplayName(profile.displayName);
    setHandle(profile.handle);
    setHome(profile.home);
    setHomeQuery(profile.home?.address ?? "");
  }, [isReady, profile]);

  const pickHome = useCallback((place: NearbyPlace) => {
    const next = homeFromPlace(place);
    setHome(next);
    setHomeQuery(next.address);
    setMapOpen(false);
  }, []);

  const onCustomizeLook = useCallback(() => {
    router.push("/achievements");
  }, []);

  const onSave = useCallback(async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert(
        t("manageProfile.errorTitle"),
        t("manageProfile.errorEmptyName"),
      );
      return;
    }

    const normalizedHandle = normalizeHandle(handle);
    if (!isValidHandle(normalizedHandle)) {
      Alert.alert(
        t("manageProfile.errorTitle"),
        t("manageProfile.errorInvalidHandle"),
      );
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        displayName: trimmedName,
        handle: normalizedHandle,
        home,
      });
      router.back();
    } catch {
      Alert.alert(t("manageProfile.errorTitle"), t("manageProfile.errorSave"));
    } finally {
      setSaving(false);
    }
  }, [displayName, handle, home, t]);

  return (
    <View
      className="rounded-2xl bg-white p-5"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="mb-6 items-center">
        <Pressable
          onPress={onCustomizeLook}
          className="active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={t("a11y.profileAvatar")}
          accessibilityHint={t("a11y.customizeAvatarHint")}
        >
          <MySpriteAvatar size={96} ringWidth={3} ringColor={LUA_GREEN} />
          <View
            className="absolute bottom-0 right-0 size-8 items-center justify-center rounded-full border-2 border-white"
            style={{ backgroundColor: LUA_GREEN }}
          >
            <Ionicons name="shirt" size={14} color="#fff" />
          </View>
        </Pressable>
        <Pressable onPress={onCustomizeLook} className="mt-3 active:opacity-70">
          <Text
            className="text-sm text-neutral-600"
            style={{ fontFamily: Pixelify.semibold }}
          >
            {t("manageProfile.customizeLook")}
          </Text>
        </Pressable>
      </View>

      <Text
        className="mb-1.5 text-xs text-neutral-500"
        style={{ fontFamily: Pixelify.medium }}
      >
        {t("manageProfile.displayNameLabel")}
      </Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t("manageProfile.displayNamePlaceholder")}
        placeholderTextColor="#a3a3a3"
        autoCapitalize="words"
        className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
        style={{ fontFamily: Pixelify.regular }}
      />

      <Text
        className="mb-1.5 text-xs text-neutral-500"
        style={{ fontFamily: Pixelify.medium }}
      >
        {t("manageProfile.handleLabel")}
      </Text>
      <TextInput
        value={handle}
        onChangeText={setHandle}
        placeholder={t("manageProfile.handlePlaceholder")}
        placeholderTextColor="#a3a3a3"
        autoCapitalize="none"
        autoCorrect={false}
        className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
        style={{ fontFamily: Pixelify.regular }}
      />

      <Text
        className="mb-1.5 text-xs text-neutral-500"
        style={{ fontFamily: Pixelify.medium }}
      >
        {t("manageProfile.homeLabel")}
      </Text>
      <NearbyLocationSearchField
        value={homeQuery}
        onChangeQuery={setHomeQuery}
        onPick={pickHome}
        userLocation={userLocation}
        active={!mapOpen}
        pickedTitle={home?.address ?? null}
        onClearPick={() => setHome(null)}
        compact
        placeholder={t("manageProfile.homePlaceholder")}
        trailing={
          <Pressable
            onPress={() => setMapOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("schedule.addModal.pickOnMap")}
            className="w-[52px] items-center justify-center rounded-xl border active:opacity-80"
            style={{
              borderColor: LUA_GREEN,
              backgroundColor: "rgba(22,163,74,0.08)",
            }}
          >
            <Ionicons name="map-outline" size={20} color={LUA_GREEN} />
          </Pressable>
        }
      />
      <Text
        className="mb-6 text-xs text-neutral-500"
        style={{ fontFamily: Pixelify.regular }}
      >
        {t("manageProfile.homeHint")}
      </Text>

      <Modal
        visible={mapOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMapOpen(false)}
      >
        <MapLocationPicker
          initial={home ?? userLocation}
          userLocation={userLocation}
          onCancel={() => setMapOpen(false)}
          onConfirm={pickHome}
        />
      </Modal>

      <Pressable
        onPress={onSave}
        disabled={saving}
        className="items-center rounded-xl py-3.5 active:opacity-80"
        style={{ backgroundColor: LUA_GREEN, opacity: saving ? 0.7 : 1 }}
      >
        <Text
          className="text-base text-white"
          style={{ fontFamily: Pixelify.bold }}
        >
          {t("manageProfile.save")}
        </Text>
      </Pressable>
    </View>
  );
}
