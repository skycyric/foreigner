import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import i18n, { ensureLangLoaded, isSupportedLang, storeLang } from "@/lib/i18n";

export const Route = createFileRoute("/$lang")({
  beforeLoad: async ({ params }) => {
    if (!isSupportedLang(params.lang)) throw notFound();
    // 動態載入該語言的 bundle（zh 已內建，立即解析）
    await ensureLangLoaded(params.lang);
    if (i18n.language !== params.lang) {
      i18n.changeLanguage(params.lang);
    }
  },
  component: LangLayout,
});

function LangLayout() {
  const { lang } = Route.useParams();

  useLayoutEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    if (isSupportedLang(lang)) {
      storeLang(lang);
    }
  }, [lang]);

  return <Outlet />;
}
