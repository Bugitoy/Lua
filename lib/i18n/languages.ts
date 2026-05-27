export type SupportedLanguageCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "zh"
  | "ja"
  | "ko"
  | "it"
  | "hi";

export type SupportedLanguage = {
  code: SupportedLanguageCode;
  label: string;
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "it", label: "Italiano" },
  { code: "hi", label: "हिन्दी" },
];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en";
export const LANGUAGE_STORAGE_KEY = "app_language";

export function getLanguageLabel(code: string): string {
  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.label ?? "English"
  );
}

export function resolveSupportedLanguage(
  locale: string | null | undefined,
): SupportedLanguageCode {
  if (!locale) return DEFAULT_LANGUAGE;
  const normalized = locale.toLowerCase().replace("_", "-");
  const base = normalized.split("-")[0];
  const match = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === base || lang.code === normalized,
  );
  return match?.code ?? DEFAULT_LANGUAGE;
}
