import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
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

/** Build ZXing reader with TRY_HARDER + QR-only — best for paper scans. */
function createReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

/** Native BarcodeDetector type (not in lib.dom yet on all TS versions). */
type NativeDetectedBarcode = { rawValue: string };
type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource | ImageBitmapSource) => Promise<NativeDetectedBarcode[]>;
};
type NativeBarcodeDetectorCtor = new (opts?: { formats?: string[] }) => NativeBarcodeDetector;

function getNativeDetectorCtor(): NativeBarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

/** Crop center 60% of video into an offscreen canvas; returns null if video not ready. */
function cropCenterToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const cw = Math.floor(vw * 0.6);
  const ch = Math.floor(vh * 0.6);
  const sx = Math.floor((vw - cw) / 2);
  const sy = Math.floor((vh - ch) / 2);
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch);
  return canvas;
}

function ScanPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/scan" });
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const cancelledRef = useRef(false);
  const blockedRef = useRef(false);
  // 視野內單次鎖定：同一張 QR 只要還在鏡頭前，就只處理一次。
  const latchedTnRef = useRef<string | null>(null);
  const lastDetectedAtRef = useRef(0);
  const SCAN_LOST_RESET_MS = 800;
  const restartScannerRef = useRef<null | (() => Promise<void>)>(null);
  const processDecodedTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  // Native BarcodeDetector loop refs
  const nativeDetectorRef = useRef<NativeBarcodeDetector | null>(null);
  const nativeLoopRef = useRef<number | null>(null);
  const nativeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastNativeScanAtRef = useRef(0);
  // Native → ZXing 自動 fallback：native 啟動後若 NATIVE_FALLBACK_MS 內無任何命中，自動切 ZXing
  const nativeStartedAtRef = useRef(0);
  const lastNativeHitAtRef = useRef(0);
  const nativeFallbackTriggeredRef = useRef(false);
  const NATIVE_FALLBACK_MS = 5000;
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

  const stopNativeLoop = useCallback(() => {
    if (nativeLoopRef.current !== null) {
      try {
        cancelAnimationFrame(nativeLoopRef.current);
      } catch {
        /* ignore */
      }
      nativeLoopRef.current = null;
    }
  }, []);

  const stopScanner = useCallback(async () => {
    stopNativeLoop();
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
    }
    // 用獨立 streamRef 確保一定能停到 tracks（不依賴 videoRef，可能已被 React unmount 清掉）
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((tr) => {
        try {
          tr.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video && video.srcObject) {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
      video.srcObject = null;
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    }
    startedRef.current = false;
  }, [stopNativeLoop]);

  const releaseLatchedTnIfLost = useCallback(() => {
    if (!latchedTnRef.current) return;
    if (Date.now() - lastDetectedAtRef.current > SCAN_LOST_RESET_MS) {
      latchedTnRef.current = null;
    }
  }, []);

  const processDecodedText = useCallback(
    async (decodedText: string) => {
      if (busyRef.current || cancelledRef.current || blockedRef.current) return;

      const tn = extractTn(decodedText);
      lastDetectedAtRef.current = Date.now();
      if (latchedTnRef.current === tn) return;
      latchedTnRef.current = tn;

      if (!isValidTnFormat(tn)) {
        toast.error(t("scan.invalidFormat"));
        return;
      }

      let navigatingAway = false;
      setBusyState(true);
      setError(null);

      try {
        const email = getStoredEmail();
        if (!email) {
          navigatingAway = true;
          blockedRef.current = true;
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
        blockedRef.current = true;
        await stopScanner();
        navigate({
          to: "/$lang/result",
          params: { lang },
          search: { tn },
          replace: true,
        });
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

  const handleRescan = useCallback(async () => {
    blockedRef.current = false;
    latchedTnRef.current = null;
    lastDetectedAtRef.current = 0;
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

    const shouldRestart = startedRef.current;
    setFileScanning(true);
    setScannerReady(false);
    setError(null);

    let url: string | null = null;
    try {
      await stopScanner();

      // Try native BarcodeDetector first for static image
      const NativeCtor = getNativeDetectorCtor();
      if (NativeCtor) {
        try {
          const detector = new NativeCtor({ formats: ["qr_code"] });
          const bitmap = await createImageBitmap(file);
          try {
            const results = await detector.detect(bitmap);
            if (results.length > 0 && results[0].rawValue) {
              await processDecodedText(results[0].rawValue);
              return;
            }
          } finally {
            try {
              bitmap.close();
            } catch {
              /* ignore */
            }
          }
        } catch (e) {
          console.warn("[scan] native photo decode failed, falling back to zxing", e);
        }
      }

      // Fallback to ZXing
      const reader = readerRef.current;
      if (!reader) {
        const message = t("scan.uploadFailed");
        setError(message);
        toast.error(message);
        return;
      }
      url = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(url);
      await processDecodedText(result.getText());
    } catch (e) {
      console.error("photo scan failed", e);
      const message = t("scan.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (!cancelledRef.current) {
        setFileScanning(false);
        if (!busyRef.current && shouldRestart) {
          await restartScannerRef.current?.();
        }
      }
    }
  }

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

    const focusDistance = caps.focusDistance as
      | { min?: number; max?: number; step?: number }
      | undefined;
    if (focusDistance && typeof focusDistance.min === "number") {
      advanced.push({ focusDistance: focusDistance.min });
    }

    if (advanced.length > 0) {
      try {
        await track.applyConstraints({ advanced } as unknown as MediaTrackConstraints);
      } catch (e) {
        console.warn("applyConstraints failed", e);
      }
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

  useEffect(() => {
    const email = getStoredEmail();
    if (!email) {
      navigate({ to: "/$lang/welcome", params: { lang }, replace: true });
      return;
    }

    cancelledRef.current = false;
    startedRef.current = false;
    setError(null);
    setScannerReady(false);

    // ZXing reader is always created as fallback (and used as the primary path
    // when native BarcodeDetector is unavailable, e.g. iOS Safari).
    const reader = createReader();
    readerRef.current = reader;
    nativeCanvasRef.current = document.createElement("canvas");

    /** Native BarcodeDetector loop — feeds center-cropped frames at ~5fps. */
    function startNativeLoop(video: HTMLVideoElement, detector: NativeBarcodeDetector) {
      const SCAN_INTERVAL_MS = 200;
      const tick = () => {
        if (cancelledRef.current || !startedRef.current || blockedRef.current) {
          nativeLoopRef.current = null;
          return;
        }
        const now = performance.now();
        if (now - lastNativeScanAtRef.current >= SCAN_INTERVAL_MS && !busyRef.current) {
          lastNativeScanAtRef.current = now;
          const canvas = nativeCanvasRef.current;
          if (canvas && video.readyState >= 2) {
            const cropped = cropCenterToCanvas(video, canvas);
            if (cropped) {
              detector
                .detect(cropped)
                .then((results) => {
                  if (cancelledRef.current) return;
                  if (results.length > 0 && results[0].rawValue) {
                    void processDecodedTextRef.current(results[0].rawValue);
                  } else {
                    releaseLatchedTnIfLost();
                  }
                })
                .catch(() => {
                  /* per-frame errors are normal — ignore */
                });
            }
          }
        }
        nativeLoopRef.current = requestAnimationFrame(tick);
      };
      nativeLoopRef.current = requestAnimationFrame(tick);
    }

    async function startScanner() {
      if (cancelledRef.current || busyRef.current) return;

      const video = videoRef.current;
      if (!video) return;

      setError(null);
      setScannerReady(false);

      try {
        // 先 enumerate 找出 back camera；找不到就讓 ZXing 用 facingMode environment 預設
        let deviceId: string | undefined;
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          const back =
            devices.find((d) => /back|rear|environment|world|後|后/i.test(d.label)) ??
            devices[devices.length - 1];
          deviceId = back?.deviceId;
        } catch {
          /* ignore — fallback to facingMode */
        }

        // 1080p ideal — S24 等高解析感測器需要更多細節保留紙本 QR
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 30, min: 24 },
              }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 30, min: 24 },
              },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.autoplay = true;

        try {
          await video.play();
        } catch {
          setNeedsTap(true);
        }

        // 三層分流：Tier 1 native BarcodeDetector（S24 / 新 Android Chrome）
        // → Tier 2 @zxing/browser（iOS Safari / 舊瀏覽器）
        const NativeCtor = getNativeDetectorCtor();
        if (NativeCtor) {
          try {
            const detector = new NativeCtor({ formats: ["qr_code"] });
            nativeDetectorRef.current = detector;
            startedRef.current = true;
            console.info("[scan] decoder = native BarcodeDetector");
            startNativeLoop(video, detector);
          } catch (e) {
            console.warn("[scan] native BarcodeDetector init failed, using zxing", e);
            nativeDetectorRef.current = null;
          }
        }

        if (!nativeDetectorRef.current) {
          // ZXing 持續從 <video> 元素抓 frame 解碼
          console.info("[scan] decoder = zxing fallback");
          const controls = await reader.decodeFromVideoElement(video, (result, _err, c) => {
            if (cancelledRef.current) {
              c.stop();
              return;
            }
            if (result) {
              void processDecodedTextRef.current(result.getText());
            } else {
              releaseLatchedTnIfLost();
            }
          });
          controlsRef.current = controls;
          startedRef.current = true;
        }

        if (!cancelledRef.current) {
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
    latchedTnRef.current = null;
    lastDetectedAtRef.current = 0;
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

      // 停掉 native loop
      stopNativeLoop();
      nativeDetectorRef.current = null;

      // 停掉 ZXing controls
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {
          /* ignore */
        }
        controlsRef.current = null;
      }
      // 停掉 video stream（torch 會跟著熄）— 用 streamRef 確保即使 videoRef 已清空也能停
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        video.srcObject = null;
      }
      readerRef.current = null;
      nativeCanvasRef.current = null;
      startedRef.current = false;
    };
    // 只依賴 lang — processDecodedText / t / navigate 透過 ref 取最新值，
    // 避免語言切換或 callback 重建造成 scanner 重啟。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // 把最新的 processDecodedText 同步到 ref，給 ZXing / native callback 用
  useEffect(() => {
    processDecodedTextRef.current = processDecodedText;
  }, [processDecodedText]);

  const working = busy || fileScanning;
  const statusMessage = working
    ? t("scan.processing")
    : scannerReady
      ? t("scan.ready")
      : t("scan.starting");

  return (
    <PageShell>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("scan.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("scan.hint")}</p>

      <div
        onClick={() => {
          if (needsTap) {
            void resumeVideoPlayback();
          } else if (scannerReady) {
            void tapToFocus();
          }
        }}
        className="relative mt-4 overflow-hidden rounded-xl border border-foreground bg-black cursor-pointer aspect-square"
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {/* 視覺引導框 — 對應 native loop 裁切的中央 60% ROI */}
        {scannerReady && !needsTap && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/5 w-3/5 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        {needsTap ? t("scan.tapToResume") : statusMessage}
      </div>

      {scannerReady && !needsTap && !working && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{t("scan.tapToFocus")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("scan.paperHint")}</p>
        </>
      )}

      <AlertDialog open={!!blockingError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("scan.rescanTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{blockingError}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => void handleRescan()}>
              {t("scan.rescan")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </PageShell>
  );
}
