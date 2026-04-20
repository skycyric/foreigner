import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zh from "@/locales/zh.json";

export const SUPPORTED_LANGS = ["zh", "en", "ja", "ko"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export function isSupportedLang(s: string | undefined): s is Lang {
  return !!s && (SUPPORTED_LANGS as readonly string[]).includes(s);
}

const LANG_STORAGE_KEY = "preferred-lang";
const LANG_COOKIE_KEY = "preferred-lang";

export function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "en";
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

/**
 * 從 Accept-Language header 解析最佳語言（SSR 端使用）
 * e.g. "zh-TW,zh;q=0.9,en;q=0.8" → "zh"
 */
export function pickLangFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return "en";
  const parts = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("ko")) return "ko";
    if (tag.startsWith("en")) return "en";
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
    // 同步寫 cookie 讓 SSR 下次能讀到
    document.cookie = `${LANG_COOKIE_KEY}=${lang}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function resolvePreferredLang(): Lang {
  return getStoredLang() ?? detectBrowserLang();
}

// --- i18next 初始化（只內建 zh，其他語言動態載入）---
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
    },
    lng: "zh",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    // 關閉自動 detect — 我們用 URL 的 $lang 決定
    initImmediate: true,
  });
}

const loadedLangs = new Set<Lang>(["zh"]);
const loadingPromises = new Map<Lang, Promise<void>>();

/**
 * 動態載入語言包（同一語言多次呼叫只 fetch 一次）
 */
export async function ensureLangLoaded(lang: Lang): Promise<void> {
  if (loadedLangs.has(lang)) return;
  const existing = loadingPromises.get(lang);
  if (existing) return existing;

  const p = (async () => {
    let mod: { default: Record<string, unknown> };
    switch (lang) {
      case "en":
        mod = await import("@/locales/en.json");
        break;
      case "ja":
        mod = await import("@/locales/ja.json");
        break;
      case "ko":
        mod = await import("@/locales/ko.json");
        break;
      default:
        return;
    }
    i18n.addResourceBundle(lang, "translation", mod.default, true, true);
    loadedLangs.add(lang);
  })();

  loadingPromises.set(lang, p);
  try {
    await p;
  } finally {
    loadingPromises.delete(lang);
  }
}

export default i18n;
