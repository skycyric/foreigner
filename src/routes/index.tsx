import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { detectBrowserLang, resolvePreferredLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  // SSR / 首次同步：用 navigator（伺服器端會 fallback 到 zh），瀏覽器一拿到 HTML 就立即 redirect
  beforeLoad: () => {
    const lang = detectBrowserLang();
    throw redirect({ to: "/$lang", params: { lang } });
  },
  // 萬一 redirect 沒生效（例如 client-only 路由），補一層 client redirect 並讀 localStorage
  component: RootRedirect,
});

function RootRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const lang = resolvePreferredLang();
    navigate({ to: "/$lang", params: { lang }, replace: true });
  }, [navigate]);
  return null;
}
