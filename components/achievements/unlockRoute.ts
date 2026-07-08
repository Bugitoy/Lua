import { Skia, type SkPath, type SkRect } from "@shopify/react-native-skia";

import { ITEMS } from "@/constants/luaSprites";

/** Tile grid from the spec: 80 columns, milestones alternate between columns 30 and 50. */
export const PATH_COLS = 80;
export const START_COL = 40;
const MILESTONE_COLS = [30, 50] as const;
/** One detour column per stretch, START → first milestone included. */
const DETOUR_COLS = [48, 40, 54, 38, 44, 26] as const;
/** Each stretch: down 8, across to the detour, down 10, across to the milestone, down 10. */
const FIRST_DROP = 8;
const SECOND_DROP = 10;
const STRETCH_ROWS = 28;
/** Half of the 6-tile road. */
export const ROAD_HALF = 3;
/** Rows above START, leaving room for the START pill. */
export const START_ROW = 8;

/** XP at START and at each milestone. */
export const XP_STOPS = [0, ...ITEMS.map((item) => item.unlockXp)];
/** Fill distance once every item is unlocked: covers the end cap too. */
const FULL_FILL = 1e9;

export type RouteSegment = {
  /** Start point, in tiles. */
  col: number;
  row: number;
  dCol: number;
  dRow: number;
  len: number;
  /** Route distance at the start point, in tiles. */
  dist: number;
  /**
   * First tile along the road this segment fills. Tiles before it are the corner square, which
   * the previous segment fills as an extension so the fill front stays a straight line.
   */
  fillFrom: number;
};

export type UnlockRoute = {
  segments: RouteSegment[];
  milestones: { col: number; row: number }[];
  /** Fill distance at each entry of XP_STOPS. */
  stopDistances: number[];
};

function buildUnlockRoute(): UnlockRoute {
  const points = [{ col: START_COL, row: START_ROW }];
  const milestones: UnlockRoute["milestones"] = [];
  let { col, row } = points[0];
  DETOUR_COLS.forEach((detour, i) => {
    const to = MILESTONE_COLS[i % 2];
    points.push(
      { col, row: row + FIRST_DROP },
      { col: detour, row: row + FIRST_DROP },
      { col: detour, row: row + FIRST_DROP + SECOND_DROP },
      { col: to, row: row + FIRST_DROP + SECOND_DROP },
      { col: to, row: row + STRETCH_ROWS },
    );
    col = to;
    row += STRETCH_ROWS;
    milestones.push({ col, row });
  });

  const segments: RouteSegment[] = [];
  const stopDistances = [0];
  // START's end cap fills first, so an empty road means distance 0.
  let dist = ROAD_HALF;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.abs(b.col - a.col) + Math.abs(b.row - a.row);
    if (len > 0) {
      segments.push({
        col: a.col,
        row: a.row,
        dCol: Math.sign(b.col - a.col),
        dRow: Math.sign(b.row - a.row),
        len,
        dist,
        fillFrom: segments.length === 0 ? -ROAD_HALF : ROAD_HALF,
      });
      dist += len;
    }
    if (i % 5 === 0) stopDistances.push(dist);
  }

  return { segments, milestones, stopDistances };
}

export const UNLOCK_ROUTE = buildUnlockRoute();

/** Last milestone row; the road ends there. */
export const LAST_ROW = UNLOCK_ROUTE.milestones[UNLOCK_ROUTE.milestones.length - 1].row;

/** Tiles `from`–`to` along the segment (0 = start point), widened by `grow` tiles all round. */
function segmentRect(s: RouteSegment, from: number, to: number, tile: number, grow = 0): SkRect {
  "worklet";
  const half = ROAD_HALF + grow;
  const a = from - grow;
  const b = to + grow;
  if (s.dCol !== 0) {
    const left = s.dCol > 0 ? s.col + a : s.col - b;
    return Skia.XYWHRect(left * tile, (s.row - half) * tile, (b - a) * tile, 2 * half * tile);
  }
  const top = s.dRow > 0 ? s.row + a : s.row - b;
  return Skia.XYWHRect((s.col - half) * tile, top * tile, 2 * half * tile, (b - a) * tile);
}

/** The whole road (grow 0) or the road plus its 1-tile border (grow 1). */
export function roadPath(tile: number, grow: number): SkPath {
  const path = Skia.Path.Make();
  for (const s of UNLOCK_ROUTE.segments) {
    path.addRect(segmentRect(s, -ROAD_HALF, s.len + ROAD_HALF, tile, grow));
  }
  return path;
}

/** Road tiles whose centres lie less than `fill` tiles along the route. */
export function filledRegion(segments: RouteSegment[], fill: number, tile: number): SkPath {
  "worklet";
  const path = Skia.Path.Make();
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const end = Math.min(s.len + ROAD_HALF, Math.ceil(fill - s.dist - 0.5));
    if (end > s.fillFrom) path.addRect(segmentRect(s, s.fillFrom, end, tile));
  }
  return path;
}

/** Route distance filled at `xp`: proportional between the surrounding milestones. */
export function fillDistanceForXp(xp: number, stopDistances: number[]): number {
  "worklet";
  const last = XP_STOPS.length - 1;
  if (xp >= XP_STOPS[last]) return FULL_FILL;
  let k = 0;
  while (xp >= XP_STOPS[k + 1]) k++;
  const t = Math.max(0, (xp - XP_STOPS[k]) / (XP_STOPS[k + 1] - XP_STOPS[k]));
  return stopDistances[k] + t * (stopDistances[k + 1] - stopDistances[k]);
}

/** Progress from the previous milestone to the next, 0–1. */
export function xpBarProgress(xp: number): number {
  "worklet";
  const last = XP_STOPS.length - 1;
  if (xp >= XP_STOPS[last]) return 1;
  let k = 0;
  while (xp >= XP_STOPS[k + 1]) k++;
  return Math.max(0, (xp - XP_STOPS[k]) / (XP_STOPS[k + 1] - XP_STOPS[k]));
}

export function nextStopXp(xp: number): number {
  "worklet";
  for (let i = 1; i < XP_STOPS.length; i++) {
    if (xp < XP_STOPS[i]) return XP_STOPS[i];
  }
  return XP_STOPS[XP_STOPS.length - 1];
}

export function unlockedCountForXp(xp: number): number {
  "worklet";
  let count = 0;
  for (let i = 1; i < XP_STOPS.length; i++) {
    if (xp >= XP_STOPS[i]) count = i;
  }
  return count;
}
