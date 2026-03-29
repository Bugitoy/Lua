import { Image as RNImage } from "react-native";

export const CAMPUS_MAP = require("../assets/images/campus-map.png");
export const LUA_LOGO = require("../assets/images/lua-logo.png");
/** 500×500 / 4 cols × 4 rows — row 0 = full health … row 3 = dead */
export const SPRITE_HEALTH = require("../assets/images/sprite-health.png");

const MAP_SRC = RNImage.resolveAssetSource(CAMPUS_MAP);
export const MAP_SRC_W = MAP_SRC?.width ?? 1;
export const MAP_SRC_H = MAP_SRC?.height ?? 1;

export const SPRITE_URI =
  "https://s3-us-west-2.amazonaws.com/s.cdpn.io/21542/DemoRpgCharacter.png";
export const SHADOW_URI =
  "https://s3-us-west-2.amazonaws.com/s.cdpn.io/21542/DemoRpgCharacterShadow.png";

export const LUA_GREEN = "#16a34a";

/** Virtual map size vs the visible area — larger = more room to pan */
export const MAP_SCALE = 3.5;

/** `effectiveScale = MAP_SCALE * zoom` — lower zoom = smaller map = see more (zoom out). */
export const MAP_ZOOM_MIN = 0.68;
export const MAP_ZOOM_MAX = 1.50;
export const MAP_ZOOM_STEP = 0.12;

/** Demo stats — replace with real tracking later */
export const MAP_DEMO = {
  healthRatio: 0.9,
  goalsDone: 6,
  goalsTotal: 12,
  goalDayPercent: 88,
  distanceMiles: 6,
  hoursStudied: 3,
  goalStreak: 7,
} as const;
