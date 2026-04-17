import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { api, type Coupon } from "@/lib/api";
import { clearStoredEmail, getStoredEmail } from "@/lib/device";

export const Route = createFileRoute("/$lang/coupons")({
  head: ({ params }) => ({
    meta: [{ title: `My Coupons — Lucky Draw (${params.lang})` }],
  }),
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

function CouponsPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/coupons" });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);

  useEffect(() => {
    const e = getStoredEmail();
    if (!e) {
      navigate({ to: "/$lang/welcome", params: { lang } });
      return;
    }
    setEmail(e);
    api
      .getMyCoupons({ email: e })
      .then(setCoupons)
      .catch((err) => {
        console.error(err);
        setCoupons([]);
      });
  }, [lang, navigate]);

  if (!email) return null;

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("coupons.title")}</h1>
        <button
          onClick={() => {
            clearStoredEmail();
            navigate({ to: "/$lang/welcome", params: { lang } });
          }}
          className="text-xs text-muted-foreground underline"
        >
          {t("coupons.changeEmail")}
        </button>
      </div>
      <p className="mt-1 break-all text-xs text-muted-foreground">{email}</p>

      <div className="mt-4 space-y-3">
        {coupons === null && (
          <div className="rounded-lg bg-muted p-4 text-center text-sm">{t("common.loading")}</div>
        )}
        {coupons && coupons.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("coupons.empty")}
          </div>
        )}
        {coupons?.map((c) => (
          <div
            key={c.coupon_code}
            className="overflow-hidden rounded-xl border-2 border-primary/20 bg-card shadow-sm"
          >
            <div
              className="px-4 py-2 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-festive)" }}
            >
              {c.note ?? "Discount Coupon"}
            </div>
            <div className="bg-white px-2 py-3">
              <Barcode value={c.coupon_code} />
            </div>
          </div>
        ))}
      </div>

      {/* 抽獎入口 */}
      <div className="mt-8 rounded-2xl border-2 border-accent bg-accent/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl">🎰</span>
          <p className="text-sm font-medium text-foreground">{t("coupons.lotteryHint")}</p>
        </div>
        <div className="space-y-2">
          <Button asChild className="h-12 w-full font-semibold">
            <Link to="/$lang/scan" params={{ lang }}>📷 {t("coupons.scanBtn")}</Link>
          </Button>
          <Button asChild variant="secondary" className="h-12 w-full font-semibold">
            <Link to="/$lang/manual" params={{ lang }}>⌨️ {t("coupons.manualBtn")}</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/$lang/winners"
          params={{ lang }}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          🏆 {t("coupons.viewWinners")}
        </Link>
      </div>
    </PageShell>
  );
}
