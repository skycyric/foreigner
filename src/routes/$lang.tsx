import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import i18n, { isSupportedLang } from "@/lib/i18n";

export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params }) => {
    if (!isSupportedLang(params.lang)) throw notFound();
    if (i18n.language !== params.lang) {
      i18n.changeLanguage(params.lang);
    }
  },
  component: LangLayout,
});

function LangLayout() {
  const { lang } = Route.useParams();

  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  return <Outlet />;
}
