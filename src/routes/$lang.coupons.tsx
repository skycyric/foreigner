import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ScanLine, Keyboard, Ticket } from "lucide-react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ACTIVITY_COUPONS } from "@/lib/coupons";

export const Route = createFileRoute("/$lang/coupons")({
  head: ({ params }) => ({
    meta: [{ title: `My Coupons — Lucky Draw (${params.lang})` }],
  }),
  component: CouponsPage,
});

function CouponQR({ value }: { value: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 320,
    })
      .then(setSrc)
      .catch((err) => console.error("qr error", err));
  }, [value]);
  return (
    <img
      src={src}
      alt={value}
      className="mx-auto h-64 w-64"
      width={256}
      height={256}
    />
  );
}

function CouponsPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/coupons" });
  const [navigating, setNavigating] = useState<string | null>(null);

  return (
    <PageShell>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("coupons.title")}
      </h1>

      {/* 抽獎入口 */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          {t("coupons.lotteryHint")}
        </p>
        <div className="space-y-2">
          <Button asChild className="h-12 w-full font-medium" disabled={!!navigating}>
            <Link
              to="/$lang/scan"
              params={{ lang }}
              onClick={() => setNavigating(t("common.redirecting"))}
            >
              <ScanLine className="h-4 w-4" strokeWidth={1.75} />
              {t("coupons.scanBtn")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full font-medium" disabled={!!navigating}>
            <Link
              to="/$lang/manual"
              params={{ lang }}
              onClick={() => setNavigating(t("common.redirecting"))}
            >
              <Keyboard className="h-4 w-4" strokeWidth={1.75} />
              {t("coupons.manualBtn")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {ACTIVITY_COUPONS.map((c) => (
          <div
            key={c.serialnum}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground">
              <Ticket className="h-4 w-4" strokeWidth={1.75} />
              <span>{t(c.nameKey)}</span>
            </div>
            <div className="bg-white px-4 py-4">
              <CouponQR value={c.serialnum} />
              <p className="mt-3 text-center font-mono text-xs tracking-wider text-foreground">
                {c.serialnum}
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {t(c.descriptionKey)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <LoadingOverlay open={!!navigating} message={navigating ?? undefined} />
    </PageShell>
  );
}
