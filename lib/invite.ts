/**
 * Invite links: https://<invite host>/friend/LUA-7KX2QD. On Android, with Lua
 * installed, the link opens the app on that person's card (app/friend/[code]);
 * otherwise it opens the invite page from web/, which shows the code.
 *
 * The host comes from EXPO_PUBLIC_INVITE_HOST. Without it there are no links,
 * and sharing falls back to the code alone.
 */

const HOST = (process.env.EXPO_PUBLIC_INVITE_HOST ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

/** The invite link for a friend code, or null when no invite site is set up. */
export function inviteLink(code: string): string | null {
  return HOST ? `https://${HOST}/friend/${code}` : null;
}

/**
 * What a Lua QR code holds. The https link when there is one, so a phone's own
 * camera app opens Lua (or the invite page without it); otherwise the app's
 * own lua:// link, which only Lua's scanner and installed apps understand.
 */
export function friendQrValue(code: string): string {
  return inviteLink(code) ?? `lua://friend/${code}`;
}
