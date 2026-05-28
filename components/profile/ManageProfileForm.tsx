import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import {
  getAvatarUri,
  isValidHandle,
  normalizeHandle,
  updateProfile,
  useProfile,
} from "@/lib/profileStore";

export function ManageProfileForm() {
  const { t } = useTranslation();
  const { profile, isReady } = useProfile();
  const hydratedForm = useRef(false);

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUri);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isReady || hydratedForm.current) return;
    hydratedForm.current = true;
    setDisplayName(profile.displayName);
    setHandle(profile.handle);
    setAvatarUri(profile.avatarUri);
  }, [isReady, profile]);

  const previewAvatar = avatarUri ?? getAvatarUri(profile);

  const onPickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("manageProfile.permissionDeniedTitle"),
        t("manageProfile.permissionDeniedMessage"),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }, [t]);

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
        avatarUri,
      });
      router.back();
    } catch {
      Alert.alert(t("manageProfile.errorTitle"), t("manageProfile.errorSave"));
    } finally {
      setSaving(false);
    }
  }, [avatarUri, displayName, handle, t]);

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
        <Pressable onPress={onPickAvatar} className="active:opacity-80">
          <Image
            source={{ uri: previewAvatar }}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              borderWidth: 3,
              borderColor: LUA_GREEN,
            }}
            accessibilityLabel={t("a11y.profileAvatar")}
          />
          <View
            className="absolute bottom-0 right-0 size-8 items-center justify-center rounded-full border-2 border-white"
            style={{ backgroundColor: LUA_GREEN }}
          >
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        <Pressable onPress={onPickAvatar} className="mt-3 active:opacity-70">
          <Text
            className="text-sm text-neutral-600"
            style={{ fontFamily: Pixelify.semibold }}
          >
            {t("manageProfile.changePhoto")}
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
        className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
        style={{ fontFamily: Pixelify.regular }}
      />

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
