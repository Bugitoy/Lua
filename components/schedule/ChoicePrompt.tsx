import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

const DANGER = "#dc2626";

export type ChoiceTone = "primary" | "danger" | "neutral";

export type PromptChoice = {
  label: string;
  /** A short line under the label, e.g. which days it affects. */
  detail?: string;
  tone: ChoiceTone;
  onPress: () => void;
};

type ChoicePromptProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Tints the icon: green for changes, red for removing. */
  tone: "primary" | "danger";
  title: string;
  message: string;
  choices: PromptChoice[];
  onCancel: () => void;
  /** The quiet button under the choices; defaults to Cancel, null hides it. */
  cancelLabel?: string | null;
};

const TONES: Record<ChoiceTone, { bg: string; border: string; text: string; detail: string }> = {
  primary: { bg: LUA_GREEN, border: LUA_GREEN, text: "#ffffff", detail: "rgba(255,255,255,0.85)" },
  danger: { bg: DANGER, border: DANGER, text: "#ffffff", detail: "rgba(255,255,255,0.85)" },
  neutral: { bg: "#ffffff", border: "#e5e5e5", text: "#171717", detail: "#737373" },
};

/**
 * The app's own question card (in place of a system alert): an icon, a
 * title and message, a stack of choices and Cancel. Fills its parent, so
 * draw it over a sheet or inside a transparent Modal.
 */
export function ChoicePrompt({ icon, tone, title, message, choices, onCancel, cancelLabel }: ChoicePromptProps) {
  const { t } = useTranslation();
  const accent = tone === "danger" ? DANGER : LUA_GREEN;
  const cancelText = cancelLabel === undefined ? t("common.cancel") : cancelLabel;

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/45 px-5">
      <Pressable className="absolute inset-0" onPress={onCancel} accessibilityLabel={cancelText ?? t("common.cancel")} />
      <View
        className={`w-full max-w-[400px] rounded-3xl bg-white px-5 pt-6 ${cancelText ? "pb-3" : "pb-5"}`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 12,
        }}
        accessibilityViewIsModal
      >
        <View
          className="mb-3 size-14 items-center justify-center self-center rounded-full"
          style={{ backgroundColor: `${accent}1a` }}
        >
          <Ionicons name={icon} size={24} color={accent} />
        </View>
        <Text
          className="mb-1.5 text-center text-neutral-900"
          style={{ fontFamily: Pixelify.bold, fontSize: 18 }}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text
          className="mb-5 text-center text-neutral-500"
          style={{ fontFamily: Pixelify.regular, fontSize: 13, lineHeight: 18 }}
        >
          {message}
        </Text>

        <View style={{ gap: 10 }}>
          {choices.map((choice) => {
            const look = TONES[choice.tone];
            return (
              <Pressable
                key={choice.label}
                onPress={choice.onPress}
                accessibilityRole="button"
                accessibilityHint={choice.detail}
                className="items-center rounded-xl border px-4 py-3 active:opacity-85"
                style={{ backgroundColor: look.bg, borderColor: look.border }}
              >
                <Text style={{ fontFamily: Pixelify.bold, fontSize: 14, color: look.text }}>{choice.label}</Text>
                {choice.detail ? (
                  <Text className="mt-0.5" style={{ fontFamily: Pixelify.regular, fontSize: 11, color: look.detail }}>
                    {choice.detail}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {cancelText ? (
          <Pressable onPress={onCancel} accessibilityRole="button" className="mt-1 items-center py-3 active:opacity-70">
            <Text className="text-neutral-500" style={{ fontFamily: Pixelify.semibold, fontSize: 14 }}>
              {cancelText}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
