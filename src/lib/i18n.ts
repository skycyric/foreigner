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

const LANG_STORAGE_KEY = "preferred-lang";

export function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "zh";
  // 同時考慮 navigator.languages（使用者完整語言偏好清單）與 navigator.language
  const candidates: string[] = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language || "",
  ].map((l) => (l || "").toLowerCase());

  for (const raw of candidates) {
    if (!raw) continue;
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("ja")) return "ja";
    if (raw.startsWith("ko")) return "ko";
    if (raw.startsWith("en")) return "en";
  }
  return "en";
}

export function getStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isSupportedLang(v ?? undefined) ? (v as Lang) : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function resolvePreferredLang(): Lang {
  return getStoredLang() ?? detectBrowserLang();
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
