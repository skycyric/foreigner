import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";
import {
  BarcodeFormat,
  DecodeHintType,
  Result,
} from "@zxing/library";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, isValidTnFormat } from "@/lib/api";
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

function buildScannerConstraints(): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 1 },
    },
  };
}

function ScanPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/scan" });
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomMax, setZoomMax] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const setBusyState = useCallback((next: boolean) => {
    busyRef.current = next;
    setBusy(next);
  }, []);

  const stopScanner = useCallback(async () => {
    const controls = controlsRef.current;
    if (controls) {
      try {
        controls.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
    }
    // 確保所有 track 都釋放（相機指示燈熄滅）
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
      if (video) video.srcObject = null;
    }
    setTorchOn(false);
    setZoomLevel(1);
  }, []);

  const processDecodedText = useCallback(
    async (decodedText: string) => {
      if (busyRef.current || cancelledRef.current || blockedRef.current) return;

      const tn = extractTn(decodedText);
      if (processedTnsRef.current.has(tn)) return;
      processedTnsRef.current.add(tn);

      if (!isValidTnFormat(tn)) {
        toast.error(t("scan.invalidFormat"));
        setTimeout(() => processedTnsRef.current.delete(tn), 1500);
        return;
      }

      let navigatingAway = false;
      setBusyState(true);
      setError(null);

      try {
        const email = getStoredEmail();
        if (!email) {
          navigatingAway = true;
          navigate({ to: "/$lang/welcome", params: { lang }, replace: true });
          return;
        }

        const result = await api.submitLotteryEntry({
          tn,
          email,
          raw_payload: decodedText,
          source: "qr",
        });

        if (result.alreadyUsed) {
          const msg = t("manual.alreadyUsed");
          blockedRef.current = true;
          setBlockingError(msg);
          toast.error(msg);
          await stopScanner();
          return;
        }

        navigatingAway = true;
        await stopScanner();
        navigate({ to: "/$lang/result", params: { lang }, search: { tn }, replace: true });
      } catch (e) {
        console.error(e);
        toast.error(String(e));
        processedTnsRef.current.delete(tn);
      } finally {
        if (!navigatingAway && !cancelledRef.current) {
          setBusyState(false);
        }
      }
    },
    [lang, navigate, setBusyState, stopScanner, t],
  );

  const processDecodedTextRef = useRef(processDecodedText);
  useEffect(() => {
    processDecodedTextRef.current = processDecodedText;
  }, [processDecodedText]);

  const handleRescan = useCallback(async () => {
    blockedRef.current = false;
    processedTnsRef.current.clear();
    setBlockingError(null);
    setError(null);
    if (!controlsRef.current) {
      await restartScannerRef.current?.();
    }
  }, []);

  function getActiveVideoTrack(): MediaStreamTrack | null {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    return stream?.getVideoTracks?.()[0] ?? null;
  }

  async function applyAdvancedTrackConstraints() {
    const track = getActiveVideoTrack();
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

    if (advanced.length > 0) {
      try {
        await track.applyConstraints({ advanced } as unknown as MediaTrackConstraints);
      } catch (e) {
        console.warn("applyConstraints failed", e);
      }
    }

    const zoomCap = caps.zoom as { min?: number; max?: number; step?: number } | undefined;
    if (zoomCap && typeof zoomCap.max === "number" && zoomCap.max > 1) {
      setZoomSupported(true);
      setZoomMax(zoomCap.max);
      setZoomLevel(1);
    } else {
      setZoomSupported(false);
    }
    if ((caps as { torch?: boolean }).torch) {
      setTorchSupported(true);
      setTorchOn(false);
    } else {
      setTorchSupported(false);
    }
  }

  async function applyZoom(next: number) {
    const track = getActiveVideoTrack();
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: next }],
      } as unknown as MediaTrackConstraints);
      setZoomLevel(next);
    } catch (e) {
      console.warn("zoom failed", e);
    }
  }

  async function toggleZoom() {
    if (!zoomSupported) return;
    const target = zoomLevel === 1 ? Math.min(2, zoomMax) : zoomLevel < zoomMax ? zoomMax : 1;
    await applyZoom(target);
  }

  async function toggleTorch() {
    const track = getActiveVideoTrack();
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch (e) {
      console.warn("torch toggle failed", e);
    }
  }

  async function tapToFocus() {
    const track = getActiveVideoTrack();
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
          advanced: [{ focusMode: "manual" }],
        } as unknown as MediaTrackConstraints);
      }
    } catch (e) {
      console.warn("tap-to-focus failed", e);
    }
    if (focusModes.includes("continuous")) {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" }],
        } as unknown as MediaTrackConstraints);
      } catch {
        /* ignore */
      }
    }
  }

  async function resumeVideoPlayback() {
    setNeedsTap(false);
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = true;
      await video.play();
    } catch (e) {
      console.error("video resume failed", e);
      setNeedsTap(true);
    }
  }

  async function handleSelectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || busyRef.current || fileScanning) return;

    const reader = readerRef.current;
    if (!reader) return;

    const wasRunning = controlsRef.current !== null;
    setFileScanning(true);
    setScannerReady(false);
    setError(null);

    try {
      await stopScanner();
      const url = URL.createObjectURL(file);
      try {
        const result: Result = await reader.decodeFromImageUrl(url);
        await processDecodedTextRef.current(result.getText());
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("photo scan failed", e);
      const message = t("scan.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      if (!cancelledRef.current) {
        setFileScanning(false);
        if (!busyRef.current && wasRunning) {
          await restartScannerRef.current?.();
        }
      }
    }
  }

  useEffect(() => {
    const email = getStoredEmail();
    if (!email) {
      navigate({ to: "/$lang/welcome", params: { lang }, replace: true });
      return;
    }

    cancelledRef.current = false;
    setError(null);
    setScannerReady(false);

    // 設定 ZXing 解碼提示：只認 QR、加上嘗試更努力解碼
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 600,
    });
    readerRef.current = reader;

    async function startScanner() {
      if (cancelledRef.current || busyRef.current) return;

      setError(null);
      setScannerReady(false);

      try {
        const video = videoRef.current;
        if (!video) return;
        // iOS Safari 必備：playsinline 才能在頁內播放
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        setNeedsTap(false);
        setZoomSupported(false);
        setTorchSupported(false);

        const controls = await reader.decodeFromConstraints(
          buildScannerConstraints(),
          video,
          (result, _err, ctrl) => {
            if (cancelledRef.current) {
              ctrl.stop();
              return;
            }
            if (result) {
              void processDecodedTextRef.current(result.getText());
            }
          },
        );

        if (cancelledRef.current) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;

        // 嘗試自動播放
        try {
          await video.play();
        } catch {
          setNeedsTap(true);
        }

        void applyAdvancedTrackConstraints();
        setScannerReady(true);
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
      if (document.visibilityState === "visible" && controlsRef.current) {
        void resumeVideoPlayback();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelledRef.current = true;
      restartScannerRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void stopScanner();
      readerRef.current = null;
    };
  }, [lang, navigate, stopScanner, t]);

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
        onClick={() => {
          if (needsTap) {
            void resumeVideoPlayback();
          } else if (scannerReady) {
            void tapToFocus();
          }
        }}
        className="mt-4 overflow-hidden rounded-xl border-2 border-primary bg-black cursor-pointer relative"
        style={{ aspectRatio: "1 / 1" }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
      </div>

      <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        {needsTap ? t("scan.tapToResume") : statusMessage}
      </div>

      {(zoomSupported || torchSupported) && scannerReady && !needsTap && (
        <div className="mt-2 flex flex-wrap gap-2">
          {zoomSupported && (
            <Button
              type="button"
              variant={zoomLevel > 1 ? "default" : "outline"}
              size="sm"
              onClick={() => void toggleZoom()}
              disabled={working}
            >
              {t("scan.zoom")} {zoomLevel.toFixed(zoomLevel % 1 === 0 ? 0 : 1)}x
            </Button>
          )}
          {torchSupported && (
            <Button
              type="button"
              variant={torchOn ? "default" : "outline"}
              size="sm"
              onClick={() => void toggleTorch()}
              disabled={working}
            >
              {t("scan.torch")}{torchOn ? " ✓" : ""}
            </Button>
          )}
        </div>
      )}

      {scannerReady && !needsTap && !working && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{t("scan.tapToFocus")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("scan.paperHint")}</p>
        </>
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
          onClick={() => navigate({ to: "/$lang/coupons", params: { lang }, replace: true })}
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
          onClick={() => navigate({ to: "/$lang/manual", params: { lang }, replace: true })}
          disabled={working}
        >
          {t("coupons.manualBtn")}
        </Button>
      </div>

      <AlertDialog
        open={!!blockingError}
        onOpenChange={(open) => {
          if (!open) void handleRescan();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{blockingError}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {blockingError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => void handleRescan()}>
              {t("scan.rescan")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
