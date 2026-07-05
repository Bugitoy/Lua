import { FilterMode, MipmapMode } from "@shopify/react-native-skia";
import { PixelRatio, type ViewStyle } from "react-native";

import { SHEET } from "@/constants/luaSprites";

export const ACH = {
  text: "#1d1b24",
  textSecondary: "#6c6879",
  card: "#f3f3f5",
  border: "#e3e2e9",
  green: "#22a24a",
  greenPressed: "#1b8a3e",
  greenTile: "#eef8f1",
  gold: "#e2b324",
  lockedBadge: "#ecebf1",
  outline: "#4d485c",
  xpTrack: "#e6e6ea",
  xpEnd: "#e8c21b",
  shadow: "#dedce5",
} as const;

export const CARD_STYLE: ViewStyle = {
  backgroundColor: ACH.card,
  borderRadius: 18,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

/** Hard-edged scaling for pixel art; Skia's default sampling would smooth it. */
export const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

/** Art pixels per cell edge on the avatar and preview sheets. */
export const AVATAR_GRID = SHEET.artGrid;
/** The icon sheet draws items at 32 bitmap px per art pixel, so a cell is 16 art px wide. */
export const ICON_GRID = SHEET.cell / 32;
/** Row of art pixels the feet stand on, in every avatar and preview cell. */
export const BASELINE_ART_Y = SHEET.baselineY / SHEET.artPixel;

/** Rounds down to whole device pixels so every art pixel spans the same number of them. */
export function snapToDevicePixels(dp: number): number {
  const dpr = PixelRatio.get();
  return Math.max(1, Math.floor(dp * dpr)) / dpr;
}

export function formatXp(xp: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(Math.floor(xp));
  } catch {
    return String(Math.floor(xp));
  }
}

/** Thousands separator for worklets, which format numbers without Intl. */
export function thousandsSeparator(locale: string): string {
  const sample = formatXp(1000, locale);
  return sample.length === 5 ? sample[1] : "";
}

export function formatXpWorklet(xp: number, separator: string): string {
  "worklet";
  const digits = String(Math.floor(Math.max(0, xp)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += separator;
    out += digits[i];
  }
  return out;
}
