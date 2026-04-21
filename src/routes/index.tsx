import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
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
  // 萬一跳轉沒立即發生（極短一瞬），不要白屏
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" strokeWidth={2} />
    </div>
  ),
});
