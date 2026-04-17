import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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

function getCameraErrorMessage(error: unknown, t: (key: string) => string): string {
  const message = String(error).toLowerCase();
  if (
    message.includes("permission") ||
    message.includes("notallowed") ||
    message.includes("denied")
  ) {
    return t("scan.permissionDenied");
  }
  if (
    message.includes("notfound") ||
    message.includes("camera not found") ||
    message.includes("device not found") ||
    message.includes("found no camera")
  ) {
    return t("scan.noCamera");
  }
  return t("scan.startFailed");
}

function ScanPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/scan" });
  const navigate = useNavigate();
  const containerId = "qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const cancelledRef = useRef(false);
  const restartScannerRef = useRef<null | (() => Promise<void>)>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const setBusyState = useCallback((next: boolean) => {
    busyRef.current = next;
    setBusy(next);
  }, []);

  const stopScanner = useCallback(async (clear = false) => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    if (startedRef.current) {
      await scanner.stop().catch(() => {});
      startedRef.current = false;
    }

    if (clear) {
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const processDecodedText = useCallback(
    async (decodedText: string) => {
      if (busyRef.current || cancelledRef.current) return;

      let navigatingAway = false;
      setBusyState(true);
      setError(null);

      try {
        const email = getStoredEmail();
        if (!email) {
          navigatingAway = true;
          navigate({ to: "/$lang/welcome", params: { lang } });
          return;
        }

        const tn = extractTn(decodedText);
        const lookup = await api.lookupTransaction({ tn });
        if (!lookup.found) {
          toast.error(t("manual.notFound"));
          return;
        }
        if (lookup.alreadyUsed) {
          toast.error(t("manual.alreadyUsed"));
          return;
        }

        await api.submitLotteryEntry({
          tn,
          email,
          raw_payload: decodedText,
          source: "qr",
        });

        navigatingAway = true;
        await stopScanner();
        navigate({ to: "/$lang/result", params: { lang }, search: { tn } });
      } catch (e) {
        console.error(e);
        toast.error(String(e));
      } finally {
        if (!navigatingAway && !cancelledRef.current) {
          setBusyState(false);
        }
      }
    },
    [lang, navigate, setBusyState, stopScanner, t],
  );

  async function handleSelectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || busyRef.current || fileScanning) return;

    const scanner = scannerRef.current;
    if (!scanner) return;

    const shouldRestart = startedRef.current;
    setFileScanning(true);
    setScannerReady(false);
    setError(null);

    try {
      await stopScanner();
      const decodedText = await scanner.scanFile(file, true);
      await processDecodedText(decodedText);
    } catch (e) {
      console.error("photo scan failed", e);
      const message = t("scan.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      if (!cancelledRef.current) {
        setFileScanning(false);
        if (!busyRef.current && shouldRestart) {
          await restartScannerRef.current?.();
        }
      }
    }
  }

  function ensureVideoPlaysInline() {
    const container = document.getElementById(containerId);
    const video = container?.querySelector("video");
    if (!video) return;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("muted", "true");
    video.muted = true;
    video.autoplay = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // 自動播放失敗 → 需要使用者點一下才能恢復
        setNeedsTap(true);
      });
    }
  }

  async function resumeVideoPlayback() {
    setNeedsTap(false);
    const container = document.getElementById(containerId);
    const video = container?.querySelector("video");
    if (!video) return;
    try {
      video.muted = true;
      await video.play();
    } catch (e) {
      console.error("video resume failed", e);
      setNeedsTap(true);
    }
  }

  useEffect(() => {
    const email = getStoredEmail();
    if (!email) {
      navigate({ to: "/$lang/welcome", params: { lang } });
      return;
    }

    cancelledRef.current = false;
    startedRef.current = false;
    setError(null);
    setScannerReady(false);

    const scanner = new Html5Qrcode(containerId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;

    async function startScanner() {
      if (cancelledRef.current || busyRef.current) return;

      setError(null);
      setScannerReady(false);

      try {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        const preferredCamera =
          cameras.find(({ label }) => /back|rear|environment|world|後|后/i.test(label)) ??
          cameras[cameras.length - 1];

        await scanner.start(
          preferredCamera?.id ?? { facingMode: { ideal: "environment" } },
          {
            fps: 10,
            aspectRatio: 1,
            disableFlip: true,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.max(
                180,
                Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72),
              );
              return {
                width: Math.min(edge, viewfinderWidth),
                height: Math.min(edge, viewfinderHeight),
              };
            },
            videoConstraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          (decodedText) => {
            void processDecodedText(decodedText);
          },
          () => {},
        );

        startedRef.current = true;
        if (!cancelledRef.current) {
          ensureVideoPlaysInline();
          setScannerReady(true);
        }
      } catch (err) {
        console.error("camera start failed", err);
        if (!cancelledRef.current) {
          setError(getCameraErrorMessage(err, t));
        }
      }
    }

    restartScannerRef.current = startScanner;
    void startScanner();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && startedRef.current) {
        void resumeVideoPlayback();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelledRef.current = true;
      restartScannerRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void stopScanner(true).finally(() => {
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }
      });
    };
  }, [lang, navigate, processDecodedText, stopScanner, t]);

  const working = busy || fileScanning;
  const statusMessage = working
    ? t("scan.processing")
    : scannerReady
      ? t("scan.ready")
      : t("scan.starting");

  return (
    <PageShell>
      <h1 className="text-xl font-bold">{t("scan.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("scan.hint")}</p>

      <div
        id={containerId}
        onClick={needsTap ? () => void resumeVideoPlayback() : undefined}
        className="mt-4 overflow-hidden rounded-xl border-2 border-primary bg-black"
      />

      <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        {needsTap ? t("scan.tapToResume") : statusMessage}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{t("scan.uploadHint")}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleSelectPhoto}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button
          variant="secondary"
          onClick={() => navigate({ to: "/$lang/coupons", params: { lang } })}
          disabled={working}
        >
          {t("scan.back")}
        </Button>
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={working}
        >
          {t("scan.uploadBtn")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate({ to: "/$lang/manual", params: { lang } })}
          disabled={working}
        >
          {t("coupons.manualBtn")}
        </Button>
      </div>
    </PageShell>
  );
}
