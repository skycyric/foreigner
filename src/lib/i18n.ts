import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zh from "@/locales/zh.json";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";

export const SUPPORTED_LANGS = ["zh", "en", "ja", "ko"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export function isSupportedLang(s: string | undefined): s is Lang {
  return !!s && (SUPPORTED_LANGS as readonly string[]).includes(s);
}

export function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "zh";
  const raw = (navigator.language || "zh").toLowerCase();
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ko")) return "ko";
  return "en";
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        zh: { translation: zh },
        en: { translation: en },
        ja: { translation: ja },
        ko: { translation: ko },
      },
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      interpolation: { escapeValue: false },
      detection: {
        order: ["path", "navigator"],
        lookupFromPathIndex: 0,
      },
    });
}

export default i18n;
