/** Local calendar day as `YYYY-MM-DD`, so stored days sort and compare as plain strings. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight at the start of `day`. */
export function startOfDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local midnight at the start of the day after `day`. */
export function startOfNextDay(day: string): Date {
  const start = startOfDay(day);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

/** Every day strictly between `from` and `to`, oldest first. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = startOfNextDay(from);
  const end = startOfDay(to);
  // A cap keeps a badly wrong clock from looping for years.
  while (cursor < end && days.length < 366) {
    days.push(dayKey(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return days;
}
