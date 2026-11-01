import { useLedgerXp } from "@/lib/xpLedger";

export { useXpLoaded } from "@/lib/xpLedger";

/**
 * Lifetime XP from walking (steps, the daily step goal and goals walked to).
 * It only goes up; working time earns none. See `lib/xpLedger.ts`.
 */
export function useStatsXp(): number {
  return useLedgerXp();
}
