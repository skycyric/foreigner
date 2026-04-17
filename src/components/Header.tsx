import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import i18n, { isSupportedLang, SUPPORTED_LANGS } from "@/lib/i18n";

export function Header() {
  const { t } = useTranslation();
  const params = useParams({ strict: false }) as { lang?: string };
  const lang = isSupportedLang(params.lang) ? params.lang : "zh";
  const navigate = useNavigate();

  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Link
          to="/$lang"
          params={{ lang }}
          className="text-lg font-bold text-primary tracking-tight"
        >
          🎁 {t("brand")}
        </Link>
        <select
          aria-label={t("lang.label")}
          value={lang}
          onChange={(e) => {
            const next = e.target.value;
            if (!isSupportedLang(next)) return;
            navigate({ to: "/$lang", params: { lang: next } });
          }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {SUPPORTED_LANGS.map((l) => (
            <option key={l} value={l}>
              {t(`lang.${l}`)}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
    </div>
  );
}
