import { Link, useNavigate, useParams, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { isSupportedLang, SUPPORTED_LANGS, storeLang, type Lang } from "@/lib/i18n";
import richclubLogo from "@/assets/richclub-logo.jpg.asset.json";

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
    <header className="sticky top-0 z-40 border-b border-border bg-black backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 py-3 relative">
        {!hideBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t("common.back")}
            className="absolute left-3 flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 active:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <Link to="/$lang" params={{ lang }} aria-label="RICHCLUB">
          <img
            src={richclubLogo.url}
            alt="RICHCLUB powered by EVERRICH"
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>
      <div className="mx-auto flex max-w-md items-center justify-end px-4 py-2 border-t border-border bg-card/90">
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
