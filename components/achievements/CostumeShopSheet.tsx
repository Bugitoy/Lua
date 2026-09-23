import { Ionicons } from "@expo/vector-icons";
import type { SkImage } from "@shopify/react-native-skia";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpriteStill } from "@/components/achievements/SpriteCell";
import { ACH, CARD_STYLE } from "@/components/achievements/theme";
import { Pixelify } from "@/constants/fonts";
import { COSTUME_CELLS, COSTUMES, type CostumeId } from "@/constants/luaSprites";

const COLUMNS = 3;
const GAP = 10;
const CARD_PADDING = 14;

type CostumeShopSheetProps = {
  visible: boolean;
  costumeStills: SkImage | null;
  ownedCostumes: CostumeId[];
  using: CostumeId | null;
  onClose: () => void;
  onBuy: (id: CostumeId) => void;
  onUse: (id: CostumeId) => void;
};

export function CostumeShopSheet({
  visible,
  costumeStills,
  ownedCostumes,
  using,
  onClose,
  onBuy,
  onUse,
}: CostumeShopSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState<CostumeId | null>(null);
  const owned = new Set(ownedCostumes);

  const close = () => {
    setConfirm(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/45">
        <Pressable className="flex-1" onPress={close} accessibilityLabel={t("achievements.a11y.closeShop")} />
        <View
          className="max-h-[86%] rounded-t-3xl bg-white px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <View className="mb-3 items-center">
            <View className="mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: ACH.border }} />
            <View className="w-full flex-row items-center justify-between">
              <Text className="text-xl" style={{ fontFamily: Pixelify.bold, color: ACH.text }}>
                {t("achievements.shop.title")}
              </Text>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("achievements.a11y.closeShop")}>
                <Ionicons name="close" size={22} color={ACH.textSecondary} />
              </Pressable>
            </View>
          </View>

          {confirm ? (
            <ConfirmStep
              id={confirm}
              costumeStills={costumeStills}
              onCancel={() => setConfirm(null)}
              onBuy={() => {
                const id = confirm;
                setConfirm(null);
                onBuy(id);
              }}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <ShopGrid
                costumeStills={costumeStills}
                owned={owned}
                using={using}
                onBuy={(id) => setConfirm(id)}
                onUse={onUse}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ShopGrid({
  costumeStills,
  owned,
  using,
  onBuy,
  onUse,
}: {
  costumeStills: SkImage | null;
  owned: Set<CostumeId>;
  using: CostumeId | null;
  onBuy: (id: CostumeId) => void;
  onUse: (id: CostumeId) => void;
}) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const inner = Math.min(windowWidth - 40, 430) - 2 * CARD_PADDING;
  const tileWidth = Math.floor((inner - (COLUMNS - 1) * GAP) / COLUMNS);

  return (
    <View className="mb-2 pb-3.5 pt-4" style={[CARD_STYLE, { paddingHorizontal: CARD_PADDING }]}>
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Text className="text-base" style={{ fontFamily: Pixelify.bold, color: ACH.text }}>
          {t("achievements.shop.section")}
        </Text>
        <Text
          className="shrink text-right text-xs"
          style={{ fontFamily: Pixelify.medium, color: ACH.textSecondary }}
          numberOfLines={1}
        >
          {t("achievements.shop.hint")}
        </Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {COSTUMES.map((costume) => {
          const name = t(`achievements.costumes.${costume.id}`);
          const isOwned = owned.has(costume.id);
          const isUsing = using === costume.id;
          const label = isUsing
            ? t("achievements.shop.using")
            : isOwned
              ? t("achievements.shop.use")
              : costume.price;

          return (
            <View
              key={costume.id}
              className="items-center rounded-xl px-1 pb-2.5 pt-3"
              style={{
                width: tileWidth,
                borderWidth: 1.5,
                borderColor: isUsing ? ACH.green : ACH.border,
                backgroundColor: isUsing ? ACH.greenTile : "#ffffff",
              }}
            >
              <SpriteStill image={costumeStills} cell={COSTUME_CELLS[costume.id]} size={72} />
              <Text
                className="mt-1.5 text-[13px]"
                style={{ fontFamily: Pixelify.semibold, color: ACH.text }}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Pressable
                onPress={() => (isOwned ? onUse(costume.id) : onBuy(costume.id))}
                disabled={isUsing}
                accessibilityRole="button"
                accessibilityLabel={
                  isUsing
                    ? t("achievements.a11y.costumeUsing", { name })
                    : isOwned
                      ? t("achievements.a11y.costumeOwned", { name })
                      : t("achievements.shop.buyTitle", { name })
                }
                className="mt-1.5 min-w-[72px] items-center rounded-lg px-2 py-1"
                style={{
                  backgroundColor: isUsing ? "transparent" : isOwned ? ACH.green : "#eef8f1",
                }}
              >
                <Text
                  className="text-[12px]"
                  style={{
                    fontFamily: Pixelify.bold,
                    color: isUsing ? ACH.green : isOwned ? "#ffffff" : ACH.green,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ConfirmStep({
  id,
  costumeStills,
  onCancel,
  onBuy,
}: {
  id: CostumeId;
  costumeStills: SkImage | null;
  onCancel: () => void;
  onBuy: () => void;
}) {
  const { t } = useTranslation();
  const costume = COSTUMES.find((c) => c.id === id)!;
  const name = t(`achievements.costumes.${id}`);

  return (
    <View className="items-center px-2 pb-6 pt-2">
      <View
        className="mb-4 items-center rounded-2xl bg-white p-4"
        style={{ borderWidth: 1.5, borderColor: ACH.border }}
      >
        <SpriteStill image={costumeStills} cell={COSTUME_CELLS[id]} size={140} />
      </View>
      <Text className="mb-6 text-center text-lg" style={{ fontFamily: Pixelify.bold, color: ACH.text }}>
        {t("achievements.shop.buyTitle", { name })}
      </Text>
      <View className="w-full flex-row gap-3">
        <Pressable
          onPress={onCancel}
          className="flex-1 items-center rounded-xl py-3 active:opacity-80"
          style={{ backgroundColor: ACH.card }}
        >
          <Text style={{ fontFamily: Pixelify.bold, color: ACH.text }}>{t("achievements.shop.cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={onBuy}
          className="flex-1 items-center rounded-xl py-3 active:opacity-80"
          style={{ backgroundColor: ACH.green }}
        >
          <Text style={{ fontFamily: Pixelify.bold, color: "#ffffff" }}>
            {t("achievements.shop.buy", { price: costume.price })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
