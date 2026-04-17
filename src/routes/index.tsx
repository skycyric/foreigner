import { createFileRoute, redirect } from "@tanstack/react-router";
import { detectBrowserLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const lang = detectBrowserLang();
    throw redirect({ to: "/$lang", params: { lang } });
  },
  component: () => null,
});
