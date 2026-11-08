import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { formatXp } from "@/components/achievements/theme";
import { SpriteAvatar } from "@/components/profile/SpriteAvatar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { backdropFor } from "@/lib/avatarLook";
import type { PublicProfile } from "@/lib/friends";
import { getAppLocale } from "@/lib/i18n/formatLocale";

type PersonRowProps = {
  person: PublicProfile;
  /** Buttons or a label on the right. */
  right?: ReactNode;
  onPress?: () => void;
};

/** Someone else's Lua, name, @username, XP and streak. */
export function PersonRow({ person, right, onPress }: PersonRowProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-neutral-50"
    >
      <SpriteAvatar look={person.look} backdrop={backdropFor(person.id)} size={44} />
      <View className="min-w-0 flex-1">
        <Text
          className="text-neutral-900"
          style={{ fontFamily: Pixelify.semibold, fontSize: 14 }}
          numberOfLines={1}
        >
          {person.displayName}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text
            className="shrink text-neutral-500"
            style={{ fontFamily: Pixelify.regular, fontSize: 12 }}
            numberOfLines={1}
          >
            @{person.username}
          </Text>
          <Text className="text-neutral-400" style={{ fontFamily: Pixelify.regular, fontSize: 12 }}>
            ·
          </Text>
          <Text className="text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 12 }}>
            {t("achievements.xpAmount", { xp: formatXp(person.xp, getAppLocale()) })}
          </Text>
          {person.streak > 0 ? (
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="flame" size={11} color="#f97316" />
              <Text className="text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 12 }}>
                {person.streak}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {right}
    </Pressable>
  );
}

type SmallButtonProps = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "plain";
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

/** The compact buttons on a person's row: Add, Accept, Cancel… */
export function SmallButton({ label, onPress, tone = "primary", disabled, icon }: SmallButtonProps) {
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-1 rounded-lg px-3 py-1.5 active:opacity-80"
      style={{
        backgroundColor: primary ? LUA_GREEN : "#f5f5f5",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={primary ? "#fff" : "#525252"} /> : null}
      <Text style={{ fontFamily: Pixelify.semibold, fontSize: 12, color: primary ? "#fff" : "#525252" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A quiet status where a button would be: "Friends", "Requested". */
export function StatusPill({ label }: { label: string }) {
  return (
    <Text className="px-2 text-neutral-400" style={{ fontFamily: Pixelify.semibold, fontSize: 12 }}>
      {label}
    </Text>
  );
}
