import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FoundPerson } from "@/components/friends/FoundPerson";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { friendCodeIn } from "@/lib/friends";

/** Side of the square the code should be lined up in, as a share of the screen width. */
const FRAME = 0.7;

/** Scans a friend's Lua QR code, then shows who it belongs to with an Add button. */
export default function ScanFriendScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const [notLua, setNotLua] = useState(false);
  const lastBad = useRef<string | null>(null);

  const onScanned = useCallback((result: BarcodeScanningResult) => {
    const found = friendCodeIn(result.data);
    if (found) {
      setNotLua(false);
      setCode(found);
    } else if (result.data !== lastBad.current) {
      // Some other QR code; say so once, and keep scanning.
      lastBad.current = result.data;
      setNotLua(true);
    }
  }, []);

  const back = (
    <Pressable
      onPress={() => router.back()}
      className="flex-row items-center gap-1 self-start rounded-full bg-black/40 px-3 py-1.5 active:opacity-70"
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={20} color="#fff" />
      <Text className="text-base text-white" style={{ fontFamily: Pixelify.medium }}>
        {t("common.back")}
      </Text>
    </Pressable>
  );

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-neutral-100 px-5" style={{ paddingTop: insets.top + 12 }}>
        <StatusBar style="dark" />
        <Pressable
          onPress={() => router.back()}
          className="mb-6 flex-row items-center gap-1 self-start active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#525252" />
          <Text className="text-base text-neutral-600" style={{ fontFamily: Pixelify.medium }}>
            {t("common.back")}
          </Text>
        </Pressable>
        <View className="items-center rounded-2xl bg-white p-6">
          <Ionicons name="camera-outline" size={40} color={LUA_GREEN} />
          <Text className="mt-3 text-center text-lg text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
            {t("friends.cameraTitle")}
          </Text>
          <Text className="mt-1 text-center text-sm text-neutral-600" style={{ fontFamily: Pixelify.regular }}>
            {t("friends.cameraMessage")}
          </Text>
          <Pressable
            onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
            className="mt-5 w-full items-center rounded-xl py-3 active:opacity-80"
            style={{ backgroundColor: LUA_GREEN }}
          >
            <Text className="text-base text-white" style={{ fontFamily: Pixelify.bold }}>
              {t(permission.canAskAgain ? "friends.allowCamera" : "common.openSettings")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        // Stop scanning while a result is showing.
        onBarcodeScanned={code ? undefined : onScanned}
      />

      <View
        pointerEvents="box-none"
        className="absolute inset-0 items-center justify-center"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View
          pointerEvents="none"
          className="rounded-3xl border-4"
          style={{ width: `${FRAME * 100}%`, aspectRatio: 1, borderColor: "rgba(255,255,255,0.85)" }}
        />
        <Text
          className="mt-5 rounded-full bg-black/50 px-4 py-2 text-center text-sm text-white"
          style={{ fontFamily: Pixelify.medium }}
        >
          {t(notLua ? "friends.notLuaCode" : "friends.scanHint")}
        </Text>
      </View>

      <View className="absolute left-5 right-5" style={{ top: insets.top + 12 }}>
        {back}
      </View>

      {code ? (
        <View className="absolute left-5 right-5" style={{ bottom: insets.bottom + 24 }}>
          <FoundPerson
            code={code}
            onDone={() => {
              setCode(null);
              router.back();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
