import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { deleteAccount, resetFriendCode, useAccount } from "@/lib/account";
import { showAppAlert, showAppNotice } from "@/lib/appAlert";
import { inviteLink } from "@/lib/invite";

/**
 * Manage Profile's account card, shown while signed in: the friend code with
 * Share and Reset, and deleting the account.
 */
export function AccountCard() {
  const { t } = useTranslation();
  const { friendCode, username } = useAccount();
  const [busy, setBusy] = useState<"reset" | "delete" | null>(null);

  const somethingWentWrong = useCallback(
    (network: boolean) =>
      showAppNotice(
        {
          icon: "alert-circle-outline",
          tone: "danger",
          title: t("account.errors.genericTitle"),
          message: t(network ? "account.errors.network" : "account.errors.unknown"),
        },
        t("common.ok"),
      ),
    [t],
  );

  const onShare = useCallback(() => {
    if (!friendCode) return;
    const link = inviteLink(friendCode);
    const vars = { code: friendCode, username: username ?? "", link };
    void Share.share({
      message: t(link ? "account.shareLinkMessage" : "account.shareCodeMessage", vars),
    }).catch(() => {});
  }, [friendCode, t, username]);

  const onReset = useCallback(() => {
    showAppAlert({
      icon: "refresh-outline",
      tone: "primary",
      title: t("account.resetCodeTitle"),
      message: t("account.resetCodeMessage"),
      buttons: [
        {
          label: t("account.resetCodeButton"),
          tone: "primary",
          onPress: () => {
            setBusy("reset");
            void resetFriendCode()
              .then((result) => {
                if (!result.ok) somethingWentWrong(result.error === "network");
              })
              .finally(() => setBusy(null));
          },
        },
      ],
    });
  }, [somethingWentWrong, t]);

  const onDelete = useCallback(() => {
    showAppAlert({
      icon: "trash-outline",
      tone: "danger",
      title: t("account.deleteTitle"),
      message: t("account.deleteMessage"),
      buttons: [
        {
          label: t("account.deleteButton"),
          tone: "danger",
          onPress: () => {
            setBusy("delete");
            void deleteAccount()
              .then((result) => {
                if (!result.ok) {
                  somethingWentWrong(result.error === "network");
                  return;
                }
                router.back();
                showAppNotice(
                  {
                    icon: "checkmark-circle-outline",
                    tone: "primary",
                    title: t("account.deletedTitle"),
                    message: t("account.deletedMessage"),
                  },
                  t("common.ok"),
                );
              })
              .finally(() => setBusy(null));
          },
        },
      ],
    });
  }, [somethingWentWrong, t]);

  return (
    <View
      className="mt-4 rounded-2xl bg-white p-5"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text className="mb-1.5 text-xs text-neutral-500" style={{ fontFamily: Pixelify.medium }}>
        {t("account.friendCodeLabel")}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          {friendCode ? (
            <Text
              selectable
              className="text-lg tracking-widest text-neutral-900"
              style={{ fontFamily: Pixelify.bold }}
            >
              {friendCode}
            </Text>
          ) : (
            <ActivityIndicator color={LUA_GREEN} />
          )}
        </View>
        <Pressable
          onPress={onShare}
          disabled={!friendCode}
          accessibilityRole="button"
          accessibilityLabel={t("account.shareCode")}
          className="size-[50px] items-center justify-center rounded-xl border active:opacity-80"
          style={{ borderColor: LUA_GREEN, backgroundColor: "rgba(22,163,74,0.08)" }}
        >
          <Ionicons name="share-social-outline" size={20} color={LUA_GREEN} />
        </Pressable>
        <Pressable
          onPress={onReset}
          disabled={!friendCode || busy !== null}
          accessibilityRole="button"
          accessibilityLabel={t("account.resetCodeButton")}
          className="size-[50px] items-center justify-center rounded-xl border border-neutral-200 active:opacity-80"
        >
          {busy === "reset" ? (
            <ActivityIndicator color="#737373" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#737373" />
          )}
        </Pressable>
      </View>
      <Text className="mt-1.5 text-xs text-neutral-500" style={{ fontFamily: Pixelify.regular }}>
        {t("account.friendCodeHint")}
      </Text>

      <View className="my-4 h-px bg-neutral-100" />

      <Pressable
        onPress={onDelete}
        disabled={busy !== null}
        className="flex-row items-center justify-center gap-2 py-1 active:opacity-70"
      >
        {busy === "delete" ? <ActivityIndicator color="#ef4444" /> : null}
        <Text className="text-sm text-red-500" style={{ fontFamily: Pixelify.semibold }}>
          {t("account.deleteButton")}
        </Text>
      </Pressable>
    </View>
  );
}
