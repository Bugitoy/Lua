import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import i18n from "@/lib/i18n";

import {
  DEFAULT_LANGUAGE,
  getLanguageLabel,
  LANGUAGE_STORAGE_KEY,
  resolveSupportedLanguage,
  type SupportedLanguageCode,
} from "./languages";

type LanguageContextValue = {
  language: SupportedLanguageCode;
  languageLabel: string;
  isReady: boolean;
  setLanguage: (code: SupportedLanguageCode) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguageCode>(
    DEFAULT_LANGUAGE,
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        const initial = stored
          ? resolveSupportedLanguage(stored)
          : resolveSupportedLanguage(getLocales()[0]?.languageTag);
        if (!active) return;
        await i18n.changeLanguage(initial);
        setLanguageState(initial);
      } finally {
        if (active) setIsReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (code: SupportedLanguageCode) => {
    await i18n.changeLanguage(code);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    setLanguageState(code);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      languageLabel: getLanguageLabel(language),
      isReady,
      setLanguage,
    }),
    [isReady, language, setLanguage],
  );

  if (!isReady) return null;

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguagePreference(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguagePreference must be used within LanguageProvider");
  }
  return ctx;
}
