import type { TFunction } from "i18next";

import { showAppAlert, showAppNotice } from "@/lib/appAlert";
import {
  blockUser,
  friendErrorKey,
  removeFriend,
  reportUser,
  type FriendsError,
  type PublicProfile,
  type ReportReason,
} from "@/lib/friends";

/**
 * The menus for acting on another person: remove, report and block, each
 * with its own confirmation. Shared by the Friends screen and the card shown
 * after scanning a code or opening a link.
 */

const REASONS: ReportReason[] = ["spam", "harassment", "inappropriate", "other"];

function failed(t: TFunction, error: FriendsError) {
  showAppNotice(
    { icon: "alert-circle-outline", tone: "danger", title: t("account.errors.genericTitle"), message: t(friendErrorKey(error)) },
    t("common.ok"),
  );
}

export function confirmBlock(t: TFunction, person: PublicProfile, onDone?: () => void) {
  showAppAlert({
    icon: "ban-outline",
    tone: "danger",
    title: t("friends.blockTitle", { name: person.displayName }),
    message: t("friends.blockMessage", { name: person.displayName }),
    buttons: [
      {
        label: t("friends.block"),
        tone: "danger",
        onPress: () => {
          void blockUser(person.id).then((result) => {
            if (!result.ok) return failed(t, result.error);
            showAppNotice(
              {
                icon: "checkmark-circle-outline",
                tone: "primary",
                title: t("friends.blockedTitle", { name: person.displayName }),
                message: t("friends.blockedMessage"),
              },
              t("common.ok"),
            );
            onDone?.();
          });
        },
      },
    ],
  });
}

export function startReport(t: TFunction, person: PublicProfile, onDone?: () => void) {
  showAppAlert({
    icon: "flag-outline",
    tone: "danger",
    title: t("friends.reportTitle", { name: person.displayName }),
    message: t("friends.reportMessage"),
    buttons: REASONS.map((reason) => ({
      label: t(`friends.reasons.${reason}`),
      tone: "neutral" as const,
      onPress: () => {
        void reportUser(person.id, reason).then((result) => {
          if (!result.ok) return failed(t, result.error);
          if (result.data === false) {
            showAppNotice(
              { icon: "time-outline", tone: "primary", title: t("friends.reportLimitTitle"), message: t("friends.reportLimitMessage") },
              t("common.ok"),
            );
            return;
          }
          // Reporting often goes with not wanting to hear from them again.
          showAppAlert({
            icon: "checkmark-circle-outline",
            tone: "primary",
            title: t("friends.reportedTitle"),
            message: t("friends.reportedMessage", { name: person.displayName }),
            buttons: [{ label: t("friends.block"), tone: "danger", onPress: () => confirmBlock(t, person, onDone) }],
            cancelLabel: t("common.notNow"),
          });
        });
      },
    })),
  });
}

function confirmRemove(t: TFunction, person: PublicProfile) {
  showAppAlert({
    icon: "person-remove-outline",
    tone: "danger",
    title: t("friends.removeTitle", { name: person.displayName }),
    message: t("friends.removeMessage", { name: person.displayName }),
    buttons: [
      {
        label: t("friends.remove"),
        tone: "danger",
        onPress: () => {
          void removeFriend(person.id).then((result) => {
            if (!result.ok) failed(t, result.error);
          });
        },
      },
    ],
  });
}

/** Remove (for friends), Report and Block, each confirmed in its own step. */
export function openPersonMenu(t: TFunction, person: PublicProfile, options: { isFriend?: boolean; onDone?: () => void } = {}) {
  showAppAlert({
    icon: "person-outline",
    tone: "primary",
    title: person.displayName,
    message: `@${person.username}`,
    buttons: [
      ...(options.isFriend
        ? [{ label: t("friends.remove"), tone: "neutral" as const, onPress: () => confirmRemove(t, person) }]
        : []),
      { label: t("friends.report"), tone: "neutral", onPress: () => startReport(t, person, options.onDone) },
      { label: t("friends.block"), tone: "danger", onPress: () => confirmBlock(t, person, options.onDone) },
    ],
  });
}
