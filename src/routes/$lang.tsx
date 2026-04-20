import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import i18n, { isSupportedLang, storeLang } from "@/lib/i18n";

export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params }) => {
    if (!isSupportedLang(params.lang)) throw notFound();
    // Synchronously set language on BOTH server and client before rendering,
    // so SSR HTML matches the client's first render (avoids hydration mismatch).
    if (i18n.language !== params.lang) {
      // changeLanguage is sync when resources are already loaded (they are bundled).
      i18n.changeLanguage(params.lang);
    }
  },
  component: LangLayout,
});

function LangLayout() {
  const { lang } = Route.useParams();

  // Sync side effects only — do NOT mutate i18n during render to avoid
  // hydration mismatches.
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
