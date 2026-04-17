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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const [email, setEmail] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 只做 email 檢查，不在這裡啟動相機（避免打斷 user gesture chain）
  useEffect(() => {
    const e = getStoredEmail();
    if (!e) {
      navigate({ to: "/$lang/welcome", params: { lang } });
      return;
    }
    setEmail(e);
  }, [lang, navigate]);

  // 卸載時清理
  useEffect(() => {
    return () => {
      const sc = scannerRef.current;
      if (!sc) return;
      sc.stop()
        .then(() => sc.clear())
        .catch(() => {
          try { sc.clear(); } catch { /* ignore */ }
        });
    };
  }, []);

  /** 處理掃到的 / 解碼出來的內容（共用） */
  async function handleDecoded(decodedText: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    try {
      const tn = extractTn(decodedText);
      const lookup = await api.lookupTransaction({ tn });
      if (!lookup.found) {
        toast.error(t("manual.notFound"));
        busyRef.current = false;
        setSubmitting(false);
        return;
      }
      if (lookup.alreadyUsed) {
        toast.error(t("manual.alreadyUsed"));
        busyRef.current = false;
        setSubmitting(false);
        return;
      }
      await api.submitLotteryEntry({
        tn,
        email: email!,
        raw_payload: decodedText,
        source: "qr",
      });
      // 提交成功後再停相機並導頁
      const sc = scannerRef.current;
      if (sc) {
        await sc.stop().catch(() => {});
      }
      navigate({ to: "/$lang/result", params: { lang }, search: { tn } });
    } catch (e) {
      console.error(e);
      toast.error(String(e));
      busyRef.current = false;
      setSubmitting(false);
    }
  }

  /** 點按鈕 → 同步啟動相機（保住 user gesture chain） */
  function startCamera() {
    setError(null);
    if (!email) return;
    if (scannerRef.current) {
      // 已存在就直接 start（避免重複 new）
      scannerRef.current
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          handleDecoded,
          () => {},
        )
        .then(() => setRunning(true))
        .catch((err) => {
          console.error("camera start failed", err);
          setError(t("scan.permissionDenied"));
        });
      return;
    }
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleDecoded,
        () => {},
      )
      .then(() => setRunning(true))
      .catch((err) => {
        console.error("camera start failed", err);
        setError(t("scan.permissionDenied"));
      });
  }

  function stopCamera() {
    const sc = scannerRef.current;
    if (!sc) return;
    sc.stop()
      .then(() => setRunning(false))
      .catch(() => setRunning(false));
  }

  /** 從相簿選照片 → 用 html5-qrcode 解碼 */
  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset，方便重選同一張
    if (!file || !email) return;
    // 用獨立 instance 避免和相機 instance 衝突
    const fileScanner = new Html5Qrcode(containerId);
    try {
      const decoded = await fileScanner.scanFile(file, true);
      await handleDecoded(decoded);
    } catch (err) {
      console.error("scanFile failed", err);
      toast.error(t("scan.decodeFailed"));
    } finally {
      try { await fileScanner.clear(); } catch { /* ignore */ }
    }
  }

  return (
    <PageShell>
      <h1 className="text-xl font-bold">{t("scan.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("scan.hint")}</p>

      <div
        id={containerId}
        className="mt-4 min-h-[240px] overflow-hidden rounded-xl border-2 border-primary bg-black"
      />

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 相機控制 */}
      <div className="mt-4 space-y-2">
        {!running ? (
          <Button
            className="h-12 w-full font-semibold"
            onClick={startCamera}
            disabled={submitting || !email}
          >
            {t("scan.startBtn")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="h-12 w-full font-semibold"
            onClick={stopCamera}
          >
            {t("scan.stopBtn")}
          </Button>
        )}

        {/* 相簿上傳備援 */}
        <Button
          variant="outline"
          className="h-12 w-full font-semibold"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting || !email}
        >
          {t("scan.uploadBtn")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFilePicked}
        />
      </div>

      {submitting && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {t("scan.scanning")}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/$lang/coupons", params: { lang } })}
        >
          {t("scan.back")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/$lang/manual", params: { lang } })}
        >
          {t("coupons.manualBtn")}
        </Button>
      </div>
    </PageShell>
  );
}
