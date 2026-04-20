import { createFileRoute, redirect } from "@tanstack/react-router";
import { detectInitialLang } from "@/lib/server-identity";
import { resolvePreferredLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  // SSR 端：用 cookie / Accept-Language 直接決定語言；client 端 fallback 用 navigator + localStorage
  beforeLoad: async () => {
    const lang =
      typeof window === "undefined"
        ? await detectInitialLang()
        : resolvePreferredLang();
    throw redirect({ to: "/$lang", params: { lang }, replace: true });
  },
});
