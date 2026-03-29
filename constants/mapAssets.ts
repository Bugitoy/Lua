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

/**
 * Real-world GPS bounding box of the campus map image.
 * topLeft  = NW corner (top-left pixel of the bitmap)
 * botRight = SE corner (bottom-right pixel of the bitmap)
 *
 * Calibration tip: cross-reference a known stop against its normalized (x, y)
 * in mapStops.ts. e.g. Fifth Third Arena ≈ (x:0.68, y:0.45) → ~39.1306°N, 84.5163°W
 */
export const CAMPUS_GPS_BOUNDS = {
  topLeft:  { lat: 39.1372, lng: -84.5248 },
  botRight: { lat: 39.1255, lng: -84.5065 },
} as const;

/** Virtual map size vs the visible area — larger = more room to pan */
export const MAP_SCALE = 3.5;

/** `effectiveScale = MAP_SCALE * zoom` — lower zoom = smaller map = see more (zoom out). */
export const MAP_ZOOM_MIN = 0.68;
export const MAP_ZOOM_MAX = 1.50;
export const MAP_ZOOM_STEP = 0.12;

/** Starting stats — goalsDone/goalsTotal are driven by schedule items at runtime */
export const MAP_DEMO = {
  healthRatio: 0.9,
  goalsDone: 0,
  goalsTotal: 0,
  goalDayPercent: 0,
  distanceMiles: 0,
  hoursStudied: 0,
  goalStreak: 0,
} as const;
