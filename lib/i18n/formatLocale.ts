import i18n from "@/lib/i18n";

export function getAppLocale(): string {
  return i18n.language || "en";
}

export function formatAppDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString(getAppLocale(), options);
}

export function formatAppTime(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleTimeString(getAppLocale(), options);
}
