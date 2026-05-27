import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { useLanguagePreference } from "@/lib/i18n/LanguageProvider";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from "@/lib/i18n/languages";

type LanguagePickerListProps = {
  onSelect?: () => void;
};

export function LanguagePickerList({ onSelect }: LanguagePickerListProps) {
  const { language, setLanguage } = useLanguagePreference();

  const handleSelect = async (code: SupportedLanguageCode) => {
    await setLanguage(code);
    onSelect?.();
  };

  return (
    <View className="overflow-hidden rounded-2xl bg-white">
      {SUPPORTED_LANGUAGES.map((item, index) => {
        const selected = language === item.code;
        return (
          <View key={item.code}>
            <Pressable
              onPress={() => void handleSelect(item.code)}
              className="flex-row items-center justify-between px-4 py-3.5 active:bg-neutral-50"
            >
              <Text
                className="text-base"
                style={{
                  fontFamily: selected ? Pixelify.bold : Pixelify.regular,
                  color: selected ? LUA_GREEN : "#171717",
                }}
              >
                {item.label}
              </Text>
              {selected ? (
                <Ionicons name="checkmark" size={20} color={LUA_GREEN} />
              ) : null}
            </Pressable>
            {index < SUPPORTED_LANGUAGES.length - 1 ? (
              <View className="mx-4 h-px bg-neutral-100" />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
