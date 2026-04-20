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
  const blockedRef = useRef(false);
  const processedTnsRef = useRef<Set<string>>(new Set());
  const restartScannerRef = useRef<null | (() => Promise<void>)>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockingError, setBlockingError] = useState<string | null>(null);
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
      if (busyRef.current || cancelledRef.current || blockedRef.current) return;

      const tn = extractTn(decodedText);
      // 防止同一張單在這次掃描期間被反覆觸發
      if (processedTnsRef.current.has(tn)) return;
      processedTnsRef.current.add(tn);

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

        const lookup = await api.lookupTransaction({ tn });
        if (!lookup.found) {
          const msg = t("manual.notFound");
          blockedRef.current = true;
          setBlockingError(msg);
          toast.error(msg);
          await stopScanner();
          return;
        }
        if (lookup.alreadyUsed) {
          const msg = t("manual.alreadyUsed");
          blockedRef.current = true;
          setBlockingError(msg);
          toast.error(msg);
          await stopScanner();
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
        // 發生錯誤時讓使用者可重試此 TN
        processedTnsRef.current.delete(tn);
      } finally {
        if (!navigatingAway && !cancelledRef.current) {
          setBusyState(false);
        }
      }
    },
    [lang, navigate, setBusyState, stopScanner, t],
  );

  const handleRescan = useCallback(async () => {
    blockedRef.current = false;
    processedTnsRef.current.clear();
    setBlockingError(null);
    setError(null);
    if (!startedRef.current) {
      await restartScannerRef.current?.();
    }
  }, []);

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

  /**
   * Apply advanced video constraints (continuous focus, exposure, higher
   * resolution) after the stream starts. Many Android devices ignore these
   * inside the initial getUserMedia constraints but accept them via
   * applyConstraints on the live track.
   */
  async function applyAdvancedTrackConstraints() {
    const container = document.getElementById(containerId);
    const video = container?.querySelector("video") as HTMLVideoElement | null;
    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;

    const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
    const advanced: Record<string, unknown>[] = [];

    const focusModes = (caps.focusMode as string[] | undefined) ?? [];
    if (focusModes.includes("continuous")) {
      advanced.push({ focusMode: "continuous" });
    } else if (focusModes.includes("auto")) {
      advanced.push({ focusMode: "auto" });
    }

    const exposureModes = (caps.exposureMode as string[] | undefined) ?? [];
    if (exposureModes.includes("continuous")) {
      advanced.push({ exposureMode: "continuous" });
    }

    const whiteBalanceModes = (caps.whiteBalanceMode as string[] | undefined) ?? [];
    if (whiteBalanceModes.includes("continuous")) {
      advanced.push({ whiteBalanceMode: "continuous" });
    }

    if (advanced.length === 0) return;
    try {
      await track.applyConstraints({ advanced } as unknown as MediaTrackConstraints);
    } catch (e) {
      console.warn("applyConstraints failed", e);
    }
  }

  /** Tap-to-focus: trigger a one-shot focus on tap (Android). */
  async function tapToFocus() {
    const container = document.getElementById(containerId);
    const video = container?.querySelector("video") as HTMLVideoElement | null;
    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
    const focusModes = (caps.focusMode as string[] | undefined) ?? [];
    try {
      if (focusModes.includes("single-shot")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "single-shot" }],
        } as unknown as MediaTrackConstraints);
      } else if (focusModes.includes("manual")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "manual" }, { focusMode: "continuous" }],
        } as unknown as MediaTrackConstraints);
      }
    } catch (e) {
      console.warn("tap-to-focus failed", e);
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
      // 關閉原生 BarcodeDetector：Android Chrome 上常見「啟動成功但永遠不回傳結果」
      useBarCodeDetectorIfSupported: false,
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
            // 提高 fps：Android 上每秒解碼次數越多，掃到模糊/低解析 QR 的機率越高
            fps: 15,
            // 不要強制 aspectRatio：Android 上會讓 stream 不符 constraint 造成黑畫面
            // 不要 disableFlip：Android sensor 旋轉常與顯示不一致，需嘗試兩個方向
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const w = Math.max(1, viewfinderWidth);
              const h = Math.max(1, viewfinderHeight);
              // 加大掃描框（80%），讓 QR Code 更容易落在解碼區
              const edge = Math.max(220, Math.floor(Math.min(w, h) * 0.8));
              return {
                width: Math.min(edge, w),
                height: Math.min(edge, h),
              };
            },
            videoConstraints: {
              facingMode: { ideal: "environment" },
              // 拉高解析度：Android 預設常給 640x480，QR 模糊就解不出來
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 30, min: 15 },
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
          // 套用 continuous focus / exposure / white balance（Android 必備）
          void applyAdvancedTrackConstraints();
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

      {blockingError && (
        <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <p>{blockingError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void handleRescan()}
          >
            {t("scan.rescan")}
          </Button>
        </div>
      )}

      {error && !blockingError && (
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
