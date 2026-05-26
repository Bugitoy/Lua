import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pixelify } from "@/constants/fonts";

type SettingsStubScreenProps = {
  title: string;
  description?: string;
};

export function SettingsStubScreen({
  title,
  description = "This section is coming soon.",
}: SettingsStubScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-neutral-100">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          className="mb-4 flex-row items-center gap-1 active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#525252" />
          <Text
            className="text-base text-neutral-600"
            style={{ fontFamily: Pixelify.medium }}
          >
            Back
          </Text>
        </Pressable>

        <Text
          className="mb-5 text-3xl text-neutral-900"
          style={{ fontFamily: Pixelify.bold }}
        >
          {title}
        </Text>

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
          <Text
            className="text-base text-neutral-600"
            style={{ fontFamily: Pixelify.regular }}
          >
            {description}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
