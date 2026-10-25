import { useMemo } from "react";

import {
  COSTUMES,
  ITEMS,
  PALETTE_SKINS,
  type CostumeId,
  type PaletteSkinId,
  type Slot,
} from "@/constants/luaSprites";
import { useAchievements, type Equipped } from "@/lib/achievementsStore";
import { useStatsXp } from "@/lib/xp";

/** What a Lua avatar wears. A costume replaces the body and every item. */
export type AvatarLook = {
  skin: PaletteSkinId;
  costume: CostumeId | null;
  equipped: Equipped;
};

/** Soft tints behind other players' avatars. */
const BACKDROPS = ["#e0f2fe", "#fce7f3", "#ede9fe", "#fef3c7", "#dcfce7", "#ffedd5", "#e0e7ff"];

/** Chance a random look wears something in each slot. */
const SLOT_CHANCE: Record<Slot, number> = {
  head: 0.75,
  feet: 0.6,
  legs: 0.55,
  face: 0.3,
  neck: 0.3,
  top: 0.3,
  back: 0.15,
};
const COSTUME_CHANCE = 0.3;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, and the same sequence for the same seed on every device. */
function seededRandom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

/** A dressed-up Lua for another player, always the same for the same seed. */
export function randomAvatar(seed: string): { look: AvatarLook; backdrop: string } {
  const random = seededRandom(seed);
  const backdrop = pick(BACKDROPS, random);
  const skin = pick(PALETTE_SKINS, random).id;
  if (random() < COSTUME_CHANCE) {
    return { look: { skin, costume: pick(COSTUMES, random).id, equipped: {} }, backdrop };
  }
  const equipped: Equipped = {};
  for (const slot of Object.keys(SLOT_CHANCE) as Slot[]) {
    if (random() >= SLOT_CHANCE[slot]) continue;
    equipped[slot] = pick(
      ITEMS.filter((item) => item.slot === slot),
      random,
    ).id;
  }
  return { look: { skin, costume: null, equipped }, backdrop };
}

/** randomAvatar for each seed, re-rolling anyone whose costume is already in the list. */
export function randomAvatars(seeds: string[]): { look: AvatarLook; backdrop: string }[] {
  const taken = new Set<CostumeId>();
  return seeds.map((seed) => {
    let avatar = randomAvatar(seed);
    for (let roll = 1; roll < 8 && avatar.look.costume && taken.has(avatar.look.costume); roll++) {
      avatar = randomAvatar(`${seed}#${roll}`);
    }
    if (avatar.look.costume) taken.add(avatar.look.costume);
    return avatar;
  });
}

/** The signed-in player's Lua, wearing only what their XP has unlocked. */
export function useMyLook(): AvatarLook {
  const statsXp = useStatsXp();
  const { skin, costume, equipped, devXpBonus } = useAchievements();
  const xp = Math.max(0, statsXp + devXpBonus);

  return useMemo(() => {
    const owned: Equipped = {};
    for (const item of ITEMS) {
      if (item.unlockXp <= xp && equipped[item.slot] === item.id) owned[item.slot] = item.id;
    }
    const skinUnlocked = PALETTE_SKINS.some((s) => s.id === skin && s.unlockXp <= xp);
    return { skin: skinUnlocked ? skin : "classic", costume, equipped: owned };
  }, [xp, skin, costume, equipped]);
}
