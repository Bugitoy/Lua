import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "@/locales/de.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import hi from "@/locales/hi.json";
import it from "@/locales/it.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import pt from "@/locales/pt.json";
import zh from "@/locales/zh.json";

import {
  DEFAULT_LANGUAGE,
  resolveSupportedLanguage,
} from "./languages";

const deviceLocale = getLocales()[0]?.languageTag ?? DEFAULT_LANGUAGE;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    pt: { translation: pt },
    zh: { translation: zh },
    ja: { translation: ja },
    ko: { translation: ko },
    it: { translation: it },
    hi: { translation: hi },
  },
  lng: resolveSupportedLanguage(deviceLocale),
  fallbackLng: DEFAULT_LANGUAGE,
  compatibilityJSON: "v4",
  interpolation: { escapeValue: false },
});

export default i18n;
