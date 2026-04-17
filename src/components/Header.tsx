import { Link, useNavigate, useParams, useRouter, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import i18n, { isSupportedLang, SUPPORTED_LANGS } from "@/lib/i18n";

export function Header() {
  const { t } = useTranslation();
  const params = useParams({ strict: false }) as { lang?: string };
  const lang = isSupportedLang(params.lang) ? params.lang : "zh";
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();

  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  // 路徑樣式：/zh、/zh/、/zh/welcome … 取出 lang 後面的子路徑
  const subPath = location.pathname.replace(/^\/[a-z]{2}\/?/, "");
  // 首頁、註冊頁、結果頁不需要返回鈕（首頁＝起點；welcome 是入口；result 是終點）
  const hideBack = subPath === "" || subPath === "welcome" || subPath === "result";

  function handleBack() {
    // 若有上一頁就 back，否則回首頁
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/$lang", params: { lang } });
    }
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
