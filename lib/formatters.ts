/**
 * Format a decimal hours value into a human-readable string.
 *   0.000  → "0s"
 *   0.003  → "10s"
 *   0.5    → "30m"
 *   1.0    → "1h"
 *   1.5    → "1h 30m"
 *   3.25   → "3h 15m"
 *
 * Seconds are shown only when the total time is under one minute, so
 * live study-session tracking feels responsive from the very first second.
 */
export function formatHours(hours: number): string {
  const totalSeconds = Math.round(hours * 3_600);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
