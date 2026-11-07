import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MySpriteAvatar, SpriteAvatar } from "@/components/profile/SpriteAvatar";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { LEADER_AVATARS, type LeaderEntry } from "@/lib/leaderboard";

/** Gold, silver and bronze. */
const MEDAL_COLORS = ["#f59e0b", "#9ca3af", "#c2410c"];

type LeaderRowProps = {
  entry: LeaderEntry;
  rank: number;
  value: string;
  /** Shows the tagline under the name (the full leaderboard). */
  showTagline?: boolean;
};

/** One player on the leaderboard: rank or medal, their Lua, name and number. */
export function LeaderRow({ entry, rank, value, showTagline }: LeaderRowProps) {
  const avatar = LEADER_AVATARS[entry.id];
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <RankBadge rank={rank} />
      <SpriteAvatar look={avatar.look} backdrop={avatar.backdrop} size={40} />
      <View className="min-w-0 flex-1">
        <Text className="text-neutral-900" style={{ fontFamily: Pixelify.semibold, fontSize: 14 }} numberOfLines={1}>
          {entry.name}
        </Text>
        {showTagline && entry.tagline ? (
          <Text className="text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 11 }} numberOfLines={1}>
            {entry.tagline}
          </Text>
        ) : null}
      </View>
      <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 15 }}>
        {value}
      </Text>
    </View>
  );
}

type MyLeaderRowProps = {
  entry: LeaderEntry;
  rank: number;
  value: string;
  /** Shows the streak under "You" (the full leaderboard). */
  showStreak?: boolean;
};

/** The player's own row, tinted green. */
export function MyLeaderRow({ entry, rank, value, showStreak }: MyLeaderRowProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 px-4 py-3" style={{ backgroundColor: `${LUA_GREEN}12` }}>
      <RankBadge rank={rank} highlight />
      <MySpriteAvatar size={40} ringWidth={2} ringColor={LUA_GREEN} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-neutral-900" style={{ fontFamily: Pixelify.bold, fontSize: 14 }}>
            {entry.name}
          </Text>
          <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${LUA_GREEN}22` }}>
            <Text style={{ fontFamily: Pixelify.bold, fontSize: 9, color: LUA_GREEN }}>
              {t("stats.leaderboard.youBadge")}
            </Text>
          </View>
        </View>
        {showStreak && entry.streak > 0 ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Ionicons name="flame" size={11} color="#f97316" />
            <Text className="text-neutral-500" style={{ fontFamily: Pixelify.regular, fontSize: 11 }}>
              {t("stats.leaderboard.streakDays", { count: entry.streak })}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: Pixelify.bold, fontSize: 15, color: LUA_GREEN }}>{value}</Text>
    </View>
  );
}

/** A medal for the top three, otherwise "#8". */
function RankBadge({ rank, highlight }: { rank: number; highlight?: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="w-8 items-center">
      {rank <= 3 ? (
        <Ionicons name="medal-outline" size={20} color={MEDAL_COLORS[rank - 1]} />
      ) : (
        <Text style={{ fontFamily: Pixelify.bold, fontSize: 13, color: highlight ? LUA_GREEN : "#a3a3a3" }}>
          {t("stats.leaderboard.rank", { rank })}
        </Text>
      )}
    </View>
  );
}
