import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguagePickerList } from "@/components/settings/LanguagePickerList";
import { Pixelify } from "@/constants/fonts";

type LanguagePickerModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function LanguagePickerModal({
  visible,
  onClose,
}: LanguagePickerModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="max-h-[75%] rounded-t-3xl bg-white px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text
              className="text-xl text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              {t("common.chooseLanguage")}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#737373" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <LanguagePickerList onSelect={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
