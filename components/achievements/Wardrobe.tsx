import type { SkImage } from "@shopify/react-native-skia";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { SpriteIcon } from "@/components/achievements/SpriteCell";
import { ACH, CARD_STYLE, formatXp } from "@/components/achievements/theme";
import { Pixelify } from "@/constants/fonts";
import { ICON_CELLS, ITEMS, type ItemId } from "@/constants/luaSprites";
import type { Equipped } from "@/lib/achievementsStore";
import { getAppLocale } from "@/lib/i18n/formatLocale";

const COLUMNS = 3;
const GAP = 10;
const CARD_PADDING = 14;

type WardrobeProps = {
  width: number;
  icons: SkImage | null;
  unlockedCount: number;
  /** Only items the player owns. */
  equipped: Equipped;
  onPressItem: (id: ItemId) => void;
};

export function Wardrobe({ width, icons, unlockedCount, equipped, onPressItem }: WardrobeProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const tileWidth = Math.floor((width - 2 * CARD_PADDING - (COLUMNS - 1) * GAP) / COLUMNS);
  const iconWidth = Math.min(52, Math.round(tileWidth * 0.48));

  return (
    <View className="mb-4 pb-3.5 pt-4" style={[CARD_STYLE, { paddingHorizontal: CARD_PADDING }]}>
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Text className="text-base" style={{ fontFamily: Pixelify.bold, color: ACH.text }}>
          {t("achievements.wardrobe.title")}
        </Text>
        <Text
          className="shrink text-right text-xs"
          style={{ fontFamily: Pixelify.medium, color: ACH.textSecondary }}
          numberOfLines={1}
        >
          {t("achievements.wardrobe.hint")}
        </Text>
      </View>

      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {ITEMS.map((item, i) => {
          const owned = i < unlockedCount;
          const wearing = owned && equipped[item.slot] === item.id;
          const name = t(`achievements.items.${item.id}`);
          const xpText = formatXp(item.unlockXp, locale);
          const status = wearing
            ? t("achievements.wardrobe.wearing")
            : owned
              ? t("achievements.wardrobe.tapToWear")
              : t("achievements.wardrobe.locked", { xp: xpText });
          const a11yLabel = wearing
            ? t("achievements.a11y.itemWearing", { item: name })
            : owned
              ? t("achievements.a11y.itemOwned", { item: name })
              : t("achievements.a11y.itemLocked", { item: name, xp: xpText });

          return (
            <Pressable
              key={item.id}
              onPress={() => onPressItem(item.id)}
              accessibilityRole="button"
              accessibilityLabel={a11yLabel}
              accessibilityState={{ selected: wearing }}
              className="items-center rounded-xl px-1 pb-2.5 pt-3 active:opacity-80"
              style={{
                width: tileWidth,
                borderWidth: 1.5,
                borderColor: wearing ? ACH.green : ACH.border,
                backgroundColor: wearing ? ACH.greenTile : "#ffffff",
              }}
            >
              <SpriteIcon
                image={icons}
                cell={owned ? ICON_CELLS[item.id].unlocked : ICON_CELLS[item.id].locked}
                width={iconWidth}
              />
              <Text
                className="mt-1.5 text-[13px]"
                style={{ fontFamily: Pixelify.semibold, color: ACH.text }}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                className="mt-0.5 text-[11px]"
                style={{
                  fontFamily: Pixelify.medium,
                  color: wearing ? ACH.green : ACH.textSecondary,
                }}
                numberOfLines={1}
              >
                {status}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
