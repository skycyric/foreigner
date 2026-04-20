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

/** Build ZXing reader — QR-only + TRY_HARDER, throttle to ~5 fps for paper scans. */
function createReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  // 200ms 間隔（~5fps）對紙本 QR 完全夠，CPU 大降
  (reader as unknown as { timeBetweenScansMillis: number }).timeBetweenScansMillis = 200;
  return reader;
}

/**
 * 找出最適合掃 QR 的後鏡頭 deviceId。
 * 重點：必須在拿到 camera 權限「之後」才呼叫，否則 device.label 會是空字串。
 * iPhone 多鏡頭裝置會有 wide/ultra-wide/telephoto，要挑「Back Camera」（主鏡頭），
 * 不要選 ultra-wide（最近對焦距離太遠，紙本 QR 會糊）或 telephoto。
 */
async function pickBackCameraDeviceId(): Promise<string | undefined> {
  try {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (devices.length === 0) return undefined;

    // 1) 優先：label 完全等於 "Back Camera"（iOS Safari 的主鏡頭）
    const exact = devices.find((d) => /^back camera$/i.test(d.label));
    if (exact) return exact.deviceId;

    // 2) 其次：label 含 back/rear/環境/後 但「不含」ultra/wide/telephoto
    const main = devices.find(
      (d) =>
        /back|rear|environment|後|后/i.test(d.label) &&
        !/ultra|wide|telephoto|tele|超廣角|長焦|远摄/i.test(d.label),
    );
    if (main) return main.deviceId;

    // 3) 再次：任何含 back/rear 的
    const anyBack = devices.find((d) => /back|rear|environment|後|后/i.test(d.label));
    if (anyBack) return anyBack.deviceId;

    // 4) 最後 fallback：第一個（不要選最後一個 — 在 iPhone 上常常是 telephoto）
    return devices[0]?.deviceId;
  } catch {
    return undefined;
  }
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
        // 第一步：先用 facingMode environment 拿到「相機權限」，
        // 之後 enumerateDevices 才會回傳真正的 device.label，可挑主鏡頭。
        // 這個 stream 只是引子，拿到 deviceId 後就會被 ZXing 自己接手換掉。
        let primingStream: MediaStream | null = null;
        try {
          primingStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch (err) {
          // 權限拒絕 / 沒相機 — 直接拋出讓外層處理
          throw err;
        } finally {
          // priming 用完立刻關，避免和 ZXing 等下要開的 stream 搶 track
          primingStream?.getTracks().forEach((tr) => {
            try {
              tr.stop();
            } catch {
              /* ignore */
            }
          });
        }

        if (cancelledRef.current) return;

        // 第二步：拿到權限後再 enumerate，挑出真正的後置主鏡頭
        const deviceId = await pickBackCameraDeviceId();

        if (cancelledRef.current) return;

        // 第三步：把 stream 生命週期完全交給 ZXing — 它會自己等 video ready
        // 才開始解碼，避免「video 還沒 ready 就 decode 拿到黑畫面」的問題。
        // 720p 比 1080p 解碼快 2.25x，對 QR 完全夠。
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

        video.setAttribute("playsinline", "true");
        video.muted = true;

        const controls = await reader.decodeFromConstraints(
          constraints,
          video,
          (result, _err, c) => {
            if (cancelledRef.current) {
              c.stop();
              return;
            }
            if (result) {
              void processDecodedTextRef.current(result.getText());
            }
            // _err 多半是 NotFoundException（每幀沒掃到），忽略即可
          },
        );

        if (cancelledRef.current) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        // 把 ZXing 接管的 stream 同步到 streamRef，cleanup 才能保證關閉相機
        streamRef.current = (video.srcObject as MediaStream | null) ?? null;
        startedRef.current = true;

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
