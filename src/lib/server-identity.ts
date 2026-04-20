import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import {
  isSupportedLang,
  pickLangFromAcceptLanguage,
  type Lang,
} from "@/lib/i18n";
import { COOKIE_KEYS } from "@/lib/identity";

/**
 * SSR：依 cookie → Accept-Language 決定首頁該導去哪個語言
 */
export const detectInitialLang = createServerFn({ method: "GET" }).handler(
  async (): Promise<Lang> => {
    const cookieLang = getCookie("preferred-lang");
    if (isSupportedLang(cookieLang)) return cookieLang;
    const accept = getRequestHeader("accept-language");
    return pickLangFromAcceptLanguage(accept);
  },
);

export interface SsrIdentity {
  email: string | null;
  deviceId: string | null;
}

/**
 * SSR：從 cookie 讀使用者識別資訊
 */
export const getSsrIdentity = createServerFn({ method: "GET" }).handler(
  async (): Promise<SsrIdentity> => {
    return {
      email: getCookie(COOKIE_KEYS.email) ?? null,
      deviceId: getCookie(COOKIE_KEYS.deviceId) ?? null,
    };
  },
);
