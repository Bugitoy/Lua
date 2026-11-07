import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { randomAvatars } from "@/lib/avatarLook";
import { formatHours } from "@/lib/formatters";
import { useGameStatsSelector } from "@/lib/gameStats";
import { useTodayRecord } from "@/lib/todayRecord";

/**
 * The leaderboard's players. There is no server yet, so these are 50 sample
 * players with made-up numbers; the player's own row uses their real figures.
 */

export type LeaderboardSortKey = "goals" | "distance" | "study";
export type LeaderboardPeriod = "today" | "week" | "month";

export const LEADERBOARD_SORT_KEYS: LeaderboardSortKey[] = ["goals", "distance", "study"];
export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = ["today", "week", "month"];

export type LeaderEntry = {
  id: string;
  name: string;
  tagline: string;
  goalsDone: number;
  goalsTotal: number;
  distanceMiles: number;
  hoursStudied: number;
  streak: number;
};

/** How many players the full leaderboard lists. */
export const LEADERBOARD_SIZE = 50;

const NAMES = [
  "Jordan Park", "Maya Chen", "Liam Torres", "Ava Johnson", "Noah Williams", "Sofia Nguyen", "Ethan Brown",
  "Priya Patel", "Lucas Martin", "Chloe Kim", "Mateo Garcia", "Zara Ahmed", "Oliver Smith", "Amara Okafor",
  "Kenji Sato", "Isabella Rossi", "Leo Schmidt", "Hana Lee", "Diego Ramirez", "Nora Jensen", "Samuel Adeyemi",
  "Emma Dubois", "Ravi Kumar", "Lily Zhang", "Gabriel Silva", "Mia Fischer", "Arjun Mehta", "Grace Wilson",
  "Yuki Tanaka", "Omar Haddad", "Ella Novak", "Daniel Cohen", "Aisha Bello", "Finn O'Brien", "Camila Lopez",
  "Ryan Choi", "Freya Larsen", "Kofi Mensah", "Sara Bianchi", "Tom Becker", "Layla Hassan", "Max Weber",
  "Ines Costa", "Jae Park", "Ruby Taylor", "Ali Rahman", "Clara Moreau", "Ben Murphy", "Ana Pereira", "Kai Nakamura",
] as const;

const TAGLINES = [
  "Trail walker", "Streak chaser", "Goal grinder", "Daily mover", "Long-walk fan", "Consistency > hype",
  "Weekend explorer", "Early riser", "Park regular", "Coffee-run walker", "Lunch-break stroller",
  "Stair climber", "City wanderer", "Sunset walker", "Step counter", "Desk escapee",
] as const;

/** The same "random" numbers every launch. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const PLAYERS: LeaderEntry[] = NAMES.map((name, i) => {
  const random = seeded(i + 1);
  const goalsTotal = 8 + Math.floor(random() * 7);
  return {
    id: String(i + 1),
    name,
    tagline: TAGLINES[i % TAGLINES.length],
    goalsTotal,
    goalsDone: Math.round(goalsTotal * (0.35 + random() * 0.65)),
    distanceMiles: round1(1.2 + random() * 8.5),
    hoursStudied: round1(1 + random() * 6.5),
    streak: Math.floor(random() * 30),
  };
});

export const LEADER_AVATARS = Object.fromEntries(
  randomAvatars(PLAYERS.map((e) => `${e.id}:${e.name}`)).map((avatar, i) => [PLAYERS[i].id, avatar]),
);

const PERIOD_DAYS: Record<LeaderboardPeriod, number> = { today: 1, week: 7, month: 30 };

/** Each player's numbers for the period, nudged so each period ranks a little differently. */
function playersFor(period: LeaderboardPeriod): LeaderEntry[] {
  const scale = PERIOD_DAYS[period];
  if (scale === 1) return PLAYERS;
  return PLAYERS.map((e, i) => ({
    ...e,
    goalsTotal: e.goalsTotal * scale,
    goalsDone: Math.min(Math.round(e.goalsDone * scale * (0.85 + Math.sin(i + scale) * 0.15)), e.goalsTotal * scale),
    distanceMiles: round1(e.distanceMiles * scale * (0.85 + Math.cos(i + scale) * 0.15)),
    hoursStudied: round1(e.hoursStudied * scale * (0.9 + Math.sin(i * 3 + scale) * 0.1)),
  }));
}

function score(e: LeaderEntry, key: LeaderboardSortKey): number {
  if (key === "goals") return e.goalsTotal > 0 ? e.goalsDone / e.goalsTotal + e.goalsDone / 10_000 : 0;
  if (key === "distance") return e.distanceMiles;
  return e.hoursStudied;
}

export type RankedBoard = {
  /** The other players, best first. */
  players: { entry: LeaderEntry; rank: number }[];
  myRank: number;
};

/** Ranks the sample players and the player (`me`) together. */
export function rankLeaderboard(
  period: LeaderboardPeriod,
  key: LeaderboardSortKey,
  me: LeaderEntry,
): RankedBoard {
  const ranked = [...playersFor(period), me].sort((a, b) => score(b, key) - score(a, key));
  return {
    players: ranked.flatMap((entry, i) => (entry.id === me.id ? [] : [{ entry, rank: i + 1 }])),
    myRank: ranked.findIndex((e) => e.id === me.id) + 1,
  };
}

const MILES_PER_METER = 0.000621371;

/** The player's own row: today's real figures, multiplied out for longer periods like the sample players. */
export function useMyLeaderEntry(period: LeaderboardPeriod): LeaderEntry {
  const { t } = useTranslation();
  const today = useTodayRecord();
  const streak = useGameStatsSelector((s) => s.goalStreak);
  const name = t("common.you");
  return useMemo(() => {
    const scale = PERIOD_DAYS[period];
    const goalsDone = today.goals.filter((g) => g.completed).length;
    return {
      id: "me",
      name,
      tagline: "",
      goalsDone: goalsDone * scale,
      goalsTotal: today.goals.length * scale,
      distanceMiles: round1(today.meters * MILES_PER_METER * scale),
      hoursStudied: round1(today.workHours * scale),
      streak,
    };
  }, [period, today, streak, name]);
}

/** Formats an entry's number for what the board is ranked by: "9/10", "5.8 mi" or "3h 30m". */
export function useLeaderValue(): (entry: LeaderEntry, key: LeaderboardSortKey) => string {
  const { t } = useTranslation();
  return (entry, key) => {
    if (key === "goals") return t("stats.summary.goalsValue", { done: entry.goalsDone, total: entry.goalsTotal });
    if (key === "distance") return t("stats.summary.distanceValue", { distance: entry.distanceMiles });
    return formatHours(entry.hoursStudied);
  };
}

export function isLeaderboardSortKey(value: unknown): value is LeaderboardSortKey {
  return typeof value === "string" && (LEADERBOARD_SORT_KEYS as string[]).includes(value);
}

export function isLeaderboardPeriod(value: unknown): value is LeaderboardPeriod {
  return typeof value === "string" && (LEADERBOARD_PERIODS as string[]).includes(value);
}
