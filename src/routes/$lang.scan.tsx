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

function ScanPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/scan" });
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const cancelledRef = useRef(false);
  const blockedRef = useRef(false);
  const processedTnsRef = useRef<Set<string>>(new Set());
  const restartScannerRef = useRef<null | (() => Promise<void>)>(null);
  const processDecodedTextRef = useRef<(text: string) => Promise<void>>(async () => {});
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

  const stopScanner = useCallback(async () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
    }
    startedRef.current = false;
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
        navigate({
          to: "/$lang/result",
          params: { lang },
          search: { tn },
          replace: true,
        });
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

    const reader = readerRef.current;
    if (!reader) return;

    const shouldRestart = startedRef.current;
    setFileScanning(true);
    setScannerReady(false);
    setError(null);

    const url = URL.createObjectURL(file);
    try {
      await stopScanner();
      const result = await reader.decodeFromImageUrl(url);
      await processDecodedText(result.getText());
    } catch (e) {
      console.error("photo scan failed", e);
      const message = t("scan.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      URL.revokeObjectURL(url);
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

    const reader = createReader();
    readerRef.current = reader;

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

        // 720p 比 1080p 解碼快很多（每幀像素少 2.25 倍），對 QR 碼足夠
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1280, min: 960 },
                height: { ideal: 720, min: 540 },
                frameRate: { ideal: 30, min: 24 },
              }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280, min: 960 },
                height: { ideal: 720, min: 540 },
                frameRate: { ideal: 30, min: 24 },
              },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

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

        // ZXing 持續從 <video> 元素抓 frame 解碼
        const controls = await reader.decodeFromVideoElement(video, (result, err, c) => {
          if (cancelledRef.current) {
            c.stop();
            return;
          }
          if (result) {
            void processDecodedTextRef.current(result.getText());
          }
          // err 多半是 NotFoundException（每幀沒掃到），忽略即可
        });

        controlsRef.current = controls;
        startedRef.current = true;

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

      // 停掉 ZXing controls
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {
          /* ignore */
        }
        controlsRef.current = null;
      }
      // 停掉 video stream（torch 會跟著熄）
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        if (video) video.srcObject = null;
      }
      readerRef.current = null;
      startedRef.current = false;
    };
    // 只依賴 lang — processDecodedText / t / navigate 透過 ref 取最新值，
    // 避免語言切換或 callback 重建造成 scanner 重啟。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // 把最新的 processDecodedText 同步到 ref，給 ZXing callback 用
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
        {/* 視覺引導框 — 不影響解碼 */}
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
