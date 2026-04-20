import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { ScanLine, Keyboard, Trophy, Ticket } from "lucide-react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { api, type Coupon } from "@/lib/api";
import { clearStoredEmail, getStoredEmail } from "@/lib/device";
import { getSsrIdentity } from "@/lib/server-identity";

const COUPONS_CACHE_PREFIX = "lucky_coupons_cache_";

export const Route = createFileRoute("/$lang/coupons")({
  head: ({ params }) => ({
    meta: [{ title: `My Coupons — Lucky Draw (${params.lang})` }],
  }),
  // SSR loader：用 cookie 直接預載券清單，HTML 直接帶資料下來
  loader: async () => {
    if (typeof window !== "undefined") {
      // client 端不在 loader 抓（會在 component 用 cache + 背景 refresh）
      return { ssrEmail: null as string | null, ssrCoupons: null as Coupon[] | null };
    }
    try {
      const { email } = await getSsrIdentity();
      if (!email) return { ssrEmail: null, ssrCoupons: null };
      const coupons = await api.getMyCoupons({ email });
      return { ssrEmail: email, ssrCoupons: coupons };
    } catch (e) {
      console.error("coupons SSR loader failed", e);
      return { ssrEmail: null, ssrCoupons: null };
    }
  },
  component: CouponsPage,
});

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        height: 70,
        margin: 8,
        background: "#ffffff",
      });
    } catch (e) {
      console.error("barcode error", e);
    }
  }, [value]);
  return <svg ref={ref} className="w-full" />;
}

function readCachedCoupons(email: string): Coupon[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COUPONS_CACHE_PREFIX + email);
    if (!raw) return null;
    return JSON.parse(raw) as Coupon[];
  } catch {
    return null;
  }
}

function writeCachedCoupons(email: string, coupons: Coupon[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COUPONS_CACHE_PREFIX + email, JSON.stringify(coupons));
  } catch {
    /* ignore */
  }
}

function CouponsPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/coupons" });
  const navigate = useNavigate();
  const { ssrEmail, ssrCoupons } = Route.useLoaderData();

  // 初始：優先用 SSR 資料；否則用 client localStorage 快取
  const [email, setEmail] = useState<string | null>(ssrEmail);
  const [coupons, setCoupons] = useState<Coupon[] | null>(ssrCoupons);

  useEffect(() => {
    const stored = getStoredEmail();
    if (!stored) {
      navigate({ to: "/$lang/welcome", params: { lang }, replace: true });
      return;
    }
    setEmail(stored);

    // 1. 立刻顯示快取（避免閃骨架）
    if (coupons === null) {
      const cached = readCachedCoupons(stored);
      if (cached) setCoupons(cached);
    }

    // 2. 背景刷新
    api
      .getMyCoupons({ email: stored })
      .then((fresh) => {
        setCoupons(fresh);
        writeCachedCoupons(stored, fresh);
      })
      .catch((err) => {
        console.error(err);
        if (coupons === null) setCoupons([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, navigate]);

  if (!email) return null;

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("coupons.title")}</h1>
        <button
          onClick={() => {
            clearStoredEmail();
            // 同時清除快取
            try {
              window.localStorage.removeItem(COUPONS_CACHE_PREFIX + email);
            } catch {
              /* ignore */
            }
            navigate({ to: "/$lang/welcome", params: { lang } });
          }}
          className="text-xs text-muted-foreground underline"
        >
          {t("coupons.changeEmail")}
        </button>
      </div>
      <p className="mt-1 break-all text-xs text-muted-foreground">{email}</p>

      {/* 抽獎入口 */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          {t("coupons.lotteryHint")}
        </p>
        <div className="space-y-2">
          <Button asChild className="h-12 w-full font-medium">
            <Link to="/$lang/scan" params={{ lang }}>
              <ScanLine className="h-4 w-4" strokeWidth={1.75} />
              {t("coupons.scanBtn")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full font-medium">
            <Link to="/$lang/manual" params={{ lang }}>
              <Keyboard className="h-4 w-4" strokeWidth={1.75} />
              {t("coupons.manualBtn")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {coupons === null && (
          <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        )}
        {coupons && coupons.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("coupons.empty")}
          </div>
        )}
        {coupons?.map((c) => (
          <div
            key={c.coupon_code}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground">
              <Ticket className="h-4 w-4" strokeWidth={1.75} />
              <span>{c.note ?? "Discount Coupon"}</span>
            </div>
            <div className="bg-white px-2 py-3">
              <Barcode value={c.coupon_code} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/$lang/winners"
          params={{ lang }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Trophy className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t("coupons.viewWinners")}
        </Link>
      </div>
    </PageShell>
  );
}
