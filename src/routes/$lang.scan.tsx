import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getStoredEmail } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/$lang/scan")({
  head: ({ params }) => ({ meta: [{ title: `Scan QR — (${params.lang})` }] }),
  component: ScanPage,
});

/** Parse QR payload like "YA2101223580^20251206^14980^ER" → "YA2101223580" */
function extractTn(raw: string): string {
  const first = raw.split("^")[0]?.trim() ?? raw.trim();
  return first.toUpperCase();
}

function ScanPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/scan" });
  const navigate = useNavigate();
  const containerId = "qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const email = getStoredEmail();
    if (!email) {
      navigate({ to: "/$lang/welcome", params: { lang } });
      return;
    }

    let cancelled = false;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    async function handleDecoded(decodedText: string) {
      if (busy || cancelled) return;
      setBusy(true);
      try {
        const tn = extractTn(decodedText);
        const lookup = await api.lookupTransaction({ tn });
        if (!lookup.found) {
          toast.error(t("manual.notFound"));
          setBusy(false);
          return;
        }
        if (lookup.alreadyUsed) {
          toast.error(t("manual.alreadyUsed"));
          setBusy(false);
          return;
        }
        await api.submitLotteryEntry({
          tn,
          email: email!,
          raw_payload: decodedText,
          source: "qr",
        });
        await scanner.stop().catch(() => {});
        navigate({ to: "/$lang/result", params: { lang }, search: { tn } });
      } catch (e) {
        console.error(e);
        toast.error(String(e));
        setBusy(false);
      }
    }

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleDecoded,
        () => {},
      )
      .catch((err) => {
        console.error(err);
        setError(t("scan.permissionDenied"));
      });

    return () => {
      cancelled = true;
      scanner.stop().catch(() => {});
      scanner.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <PageShell>
      <h1 className="text-xl font-bold">{t("scan.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("scan.hint")}</p>

      <div
        id={containerId}
        className="mt-4 overflow-hidden rounded-xl border-2 border-primary bg-black"
      />

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => navigate({ to: "/$lang/coupons", params: { lang } })}
        >
          {t("scan.back")}
        </Button>
        <Button onClick={() => navigate({ to: "/$lang/manual", params: { lang } })}>
          {t("coupons.manualBtn")}
        </Button>
      </div>
    </PageShell>
  );
}
