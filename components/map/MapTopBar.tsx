import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { LUA_LOGO } from "@/constants/mapAssets";
import { Pixelify } from "@/constants/fonts";

type MapTopBarProps = {
  topInset: number;
};

export function MapTopBar({ topInset }: MapTopBarProps) {
  return (
    <View
      className="border-b border-black/10 bg-white"
      style={{ paddingTop: topInset }}
      pointerEvents="auto"
    >
      <View className="flex-row items-center justify-between px-6 pb-1 pt-2">
        <View className="flex-row items-center">
          <Image
            source={LUA_LOGO}
            style={{ width: 48, height: 48 }}
            contentFit="contain"
            accessibilityLabel="Lua logo"
          />
          <Text
            className="text-2xl text-neutral-900"
            style={{ fontFamily: Pixelify.bold }}
          >
            Lua
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Link href="/(tabs)/profile" asChild>
            <Pressable>
              <Image
                source={{ uri: "https://i.pravatar.cc/120?img=12" }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.08)",
                }}
                accessibilityLabel="Profile"
              />
            </Pressable>
          </Link>
          <Link href="/(tabs)/settings" asChild>
            <Pressable
              className="size-10 items-center justify-center rounded-full bg-neutral-200/90"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={22} color="#525252" />
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
