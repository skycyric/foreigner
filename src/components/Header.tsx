import { Link, useNavigate, useParams, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { isSupportedLang, SUPPORTED_LANGS, storeLang, type Lang } from "@/lib/i18n";

/**
 * 顯式上一頁路徑表 — 避免 history.back() 在 push/replace 混用時跳回 result 等中間頁。
 * key 是當前 sub-path（去掉語言前綴），value 是要去的 sub-path（"" = 首頁）。
 */
const BACK_MAP: Record<string, string> = {
  scan: "coupons",
  manual: "coupons",
  coupons: "",
  winners: "",
  about: "",
  terms: "",
  result: "",
};

export function Header() {
  const { t } = useTranslation();
  const params = useParams({ strict: false }) as { lang?: string };
  const lang = isSupportedLang(params.lang) ? params.lang : "zh";
  const navigate = useNavigate();
  const location = useLocation();

  const subPath = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  const cleanedSub = subPath.replace(/^\//, "").replace(/\/$/, "");
  const hideBack = cleanedSub === "" || cleanedSub === "welcome" || cleanedSub === "result";

  function handleBack() {
    const target = BACK_MAP[cleanedSub] ?? "";
    const href = target ? `/${lang}/${target}` : `/${lang}`;
    navigate({ href, replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1">
          {!hideBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={t("common.back")}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted active:bg-muted/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <Link
            to="/$lang"
            params={{ lang }}
            className="text-lg font-bold text-primary tracking-tight"
          >
            🎁 {t("brand")}
          </Link>
        </div>
        <select
          aria-label={t("lang.label")}
          value={lang}
          onChange={(e) => {
            const next = e.target.value;
            if (!isSupportedLang(next)) return;
            storeLang(next as Lang);
            const nextHref = cleanedSub ? `/${next}/${cleanedSub}` : `/${next}`;
            const search = location.searchStr || "";
            navigate({ href: nextHref + search, replace: true });
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
