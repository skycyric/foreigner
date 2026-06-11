import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import {
  isSupportedLang,
  pickLangFromAcceptLanguage,
  type Lang,
} from "@/lib/i18n";

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
