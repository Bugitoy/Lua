import type { SkImage } from "@shopify/react-native-skia";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { FittedIcon, SKIN_ICON_CROP, SpriteIcon, SpriteStill } from "@/components/achievements/SpriteCell";
import { ACH, CARD_STYLE, formatXp } from "@/components/achievements/theme";
import { lastUnlockedXp } from "@/components/achievements/unlockRoute";
import { Pixelify } from "@/constants/fonts";
import {
  COSTUME_CELLS,
  COSTUMES,
  ICON_BOUNDS,
  ICON_CELLS,
  ITEMS,
  PALETTE_SKINS,
  SKIN_ICON_CELLS,
  type CostumeId,
  type ItemId,
  type PaletteSkinId,
} from "@/constants/luaSprites";
import type { Equipped } from "@/lib/achievementsStore";
import { getAppLocale } from "@/lib/i18n/formatLocale";

const COLUMNS = 3;
const GAP = 10;
const CARD_PADDING = 14;
const LOCKED_ICON_OPACITY = 0.45;

type WardrobeProps = {
  width: number;
  icons: SkImage | null;
  iconsLocked: SkImage | null;
  skinIcons: SkImage | null;
  costumeStills: SkImage | null;
  unlockedCount: number;
  equipped: Equipped;
  skin: PaletteSkinId;
  costume: CostumeId | null;
  ownedCostumes: CostumeId[];
  onPressItem: (id: ItemId) => void;
  onPressSkin: (id: PaletteSkinId) => void;
  onPressCostume: (id: CostumeId) => void;
};

function WardrobeImpl({
  width,
  icons,
  iconsLocked,
  skinIcons,
  costumeStills,
  unlockedCount,
  equipped,
  skin,
  costume,
  ownedCostumes,
  onPressItem,
  onPressSkin,
  onPressCostume,
}: WardrobeProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const tileWidth = Math.floor((width - 2 * CARD_PADDING - (COLUMNS - 1) * GAP) / COLUMNS);
  const iconWidth = Math.min(52, Math.round(tileWidth * 0.48));
  const itemBoxWidth = tileWidth - 12;
  const itemBoxHeight = Math.round(itemBoxWidth * 0.4);
  const unlockedXp = lastUnlockedXp(unlockedCount);
  const ownedCostumesInOrder = COSTUMES.map((c) => c.id).filter((id) => ownedCostumes.includes(id));

  return (
    <View className="mb-4 pb-3.5 pt-4" style={[CARD_STYLE, { paddingHorizontal: CARD_PADDING }]}>
      <SectionHeader
        title={t("achievements.wardrobe.title")}
        hint={t("achievements.wardrobe.hint")}
      />

      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {ITEMS.map((item) => {
          const owned = item.unlockXp <= unlockedXp;
          const wearing = owned && equipped[item.slot] === item.id;
          const underCostume = wearing && costume !== null;
          const name = t(`achievements.items.${item.id}`);
          const xpText = formatXp(item.unlockXp, locale);
          const status = !owned
            ? t("achievements.wardrobe.locked", { xp: xpText })
            : underCostume
              ? t("achievements.wardrobe.underCostume")
              : wearing
                ? t("achievements.wardrobe.wearing")
                : t("achievements.wardrobe.tapToWear");
          const a11yLabel = !owned
            ? t("achievements.a11y.itemLocked", { item: name, xp: xpText })
            : underCostume
              ? t("achievements.a11y.itemUnderCostume", { item: name })
              : wearing
                ? t("achievements.a11y.itemWearing", { item: name })
                : t("achievements.a11y.itemOwned", { item: name });

          return (
            <Tile
              key={item.id}
              width={tileWidth}
              active={wearing && !underCostume}
              onPress={() => onPressItem(item.id)}
              accessibilityLabel={a11yLabel}
              selected={wearing && !underCostume}
            >
              <FittedIcon
                image={owned ? icons : iconsLocked}
                cell={ICON_CELLS[item.id]}
                bounds={ICON_BOUNDS[item.id]}
                boxWidth={itemBoxWidth}
                boxHeight={itemBoxHeight}
                maxUnit={itemBoxWidth / 12}
                opacity={owned ? 1 : LOCKED_ICON_OPACITY}
              />
              <TileLabel name={name} status={status} active={wearing && !underCostume} />
            </Tile>
          );
        })}
      </View>

      <SectionHeader
        title={t("achievements.wardrobe.skinsTitle")}
        hint={t("achievements.wardrobe.skinsHint")}
        className="mb-3 mt-5"
      />

      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {PALETTE_SKINS.map((palette) => {
          const owned = palette.unlockXp <= unlockedXp;
          const using = owned && costume === null && skin === palette.id;
          const name = t(`achievements.skins.${palette.id}`);
          const xpText = formatXp(palette.unlockXp, locale);
          const status = !owned
            ? t("achievements.wardrobe.locked", { xp: xpText })
            : using
              ? t("achievements.wardrobe.using")
              : t("achievements.wardrobe.tapToUse");
          const a11yLabel = !owned
            ? t("achievements.a11y.skinLocked", { skin: name, xp: xpText })
            : using
              ? t("achievements.a11y.skinUsing", { skin: name })
              : t("achievements.a11y.skinOwned", { skin: name });
          const cells = SKIN_ICON_CELLS[palette.id];

          return (
            <Tile
              key={palette.id}
              width={tileWidth}
              active={using}
              onPress={() => onPressSkin(palette.id)}
              accessibilityLabel={a11yLabel}
              selected={using}
            >
              <SpriteIcon
                image={skinIcons}
                cell={owned ? cells.unlocked : cells.locked}
                width={iconWidth}
                crop={SKIN_ICON_CROP}
              />
              <TileLabel name={name} status={status} active={using} />
            </Tile>
          );
        })}

        {ownedCostumesInOrder.map((id) => {
          const using = costume === id;
          const name = t(`achievements.costumes.${id}`);
          const status = using
            ? t("achievements.wardrobe.using")
            : t("achievements.wardrobe.tapToUse");
          const a11yLabel = using
            ? t("achievements.a11y.costumeUsing", { name })
            : t("achievements.a11y.costumeOwned", { name });

          return (
            <Tile
              key={id}
              width={tileWidth}
              active={using}
              onPress={() => onPressCostume(id)}
              accessibilityLabel={a11yLabel}
              selected={using}
            >
              <SpriteStill image={costumeStills} cell={COSTUME_CELLS[id]} size={iconWidth + 8} />
              <TileLabel name={name} status={status} active={using} />
            </Tile>
          );
        })}
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  hint,
  className = "mb-3",
}: {
  title: string;
  hint: string;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center justify-between gap-2 ${className}`}>
      <Text className="text-base" style={{ fontFamily: Pixelify.bold, color: ACH.text }}>
        {title}
      </Text>
      <Text
        className="shrink text-right text-xs"
        style={{ fontFamily: Pixelify.medium, color: ACH.textSecondary }}
        numberOfLines={1}
      >
        {hint}
      </Text>
    </View>
  );
}

function Tile({
  width,
  active,
  onPress,
  accessibilityLabel,
  selected,
  children,
}: {
  width: number;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  selected: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      className="items-center rounded-xl px-1 pb-2.5 pt-3 active:opacity-80"
      style={{
        width,
        borderWidth: 1.5,
        borderColor: active ? ACH.green : ACH.border,
        backgroundColor: active ? ACH.greenTile : "#ffffff",
      }}
    >
      {children}
    </Pressable>
  );
}

function TileLabel({ name, status, active }: { name: string; status: string; active: boolean }) {
  return (
    <>
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
          color: active ? ACH.green : ACH.textSecondary,
        }}
        numberOfLines={1}
      >
        {status}
      </Text>
    </>
  );
}

/** Skips re-rendering every tile canvas when the screen re-renders for unrelated state. */
export const Wardrobe = memo(WardrobeImpl);
