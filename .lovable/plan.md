
對，正確方向。S24 那段問題的本質是「JS-only 的 ZXing 在新 Android 高解析感測器上效能不夠」，所以最乾淨的解法就是**依瀏覽器能力分流**到不同解碼器，而不是無止境調 ZXing 參數。

## 三層解碼策略（依機型自動分流）

```text
┌─────────────────────────────────────────────────┐
│ 啟動掃描器                                      │
└──────────────┬──────────────────────────────────┘
               │
        偵測 'BarcodeDetector' in window
               │
       ┌───────┴────────┐
       │ 有             │ 沒有
       ▼                ▼
┌──────────────┐   ┌──────────────────┐
│ Tier 1       │   │ Tier 2           │
│ 原生         │   │ ZXing fallback   │
│ BarcodeDet.  │   │ (現有路徑)       │
│              │   │                  │
│ S24 / 新     │   │ iOS Safari /     │
│ Android      │   │ 舊 Android       │
│ Chrome       │   │                  │
└──────────────┘   └──────────────────┘
       │                  │
       └────────┬─────────┘
                ▼
        共用 ROI 中央裁切
        共用 processDecodedText
```

## 實際改動（只動 `src/routes/$lang.scan.tsx`）

**Tier 1 — 原生 BarcodeDetector**（S24、Pixel、新 Android Chrome）
- 啟動時 `'BarcodeDetector' in window` 探測
- `new BarcodeDetector({ formats: ['qr_code'] })`
- `requestAnimationFrame` loop 每幀（節流 200ms）跑 `detector.detect(video)`
- 硬體加速、毫秒級命中

**Tier 2 — @zxing/browser fallback**（iOS Safari、舊瀏覽器）
- 原生 API 不存在 → 走現有 `reader.decodeFromVideoElement(...)` 路徑
- 不動現有邏輯，已驗證可用

**共用優化（兩條路徑都套）**
- constraint 升到 `width 1920 ideal / 1280 min`、`height 1080 ideal / 720 min`
- 解碼前裁中央 60% ROI（offscreen canvas）→ 餵給對應 detector / reader
- 命中後共用 `processDecodedTextRef.current(...)`

**stop / cleanup**
- 新增 `nativeLoopRef`（rAF id），cleanup 時 `cancelAnimationFrame`
- 既有 `controlsRef.current.stop()` 並列保留
- 確保「離開頁面後相機指示燈關閉」這個之前修的行為不退化

**照片上傳**
- 同樣優先 native：`createImageBitmap(file)` → `detector.detect(bitmap)`
- 失敗 fallback `reader.decodeFromImageUrl(url)`

**Log 標記**
- 啟動時印 `[scan] decoder = native | zxing`，方便日後使用者回報直接看 console 判斷走哪條

## 不做的事
- 不換掉 @zxing/browser（移除會破 iOS）
- 不加 html5-qrcode 等新依賴（自己包 native API 已足夠）
- 不動 UI、文案、navigation、coupon 寫入邏輯、其他頁面

## 驗證方式
- **Galaxy S24 Chrome**：開 `/zh/scan`，console 應印 `[scan] decoder = native`，對紙本 QR 應 < 200ms 命中
- **iPhone Safari**：console 應印 `[scan] decoder = zxing`，行為與現在完全一致
- **離開頁面**：相機指示燈仍正常關閉

## 檔案影響
- 修改：`src/routes/$lang.scan.tsx`（單檔）
- 不動：DB、其他路由、依賴清單、docs

## 風險
- 原生 API 在極少數 Android Chrome 版本回傳空陣列但不丟錯 → 保留 ZXing 當第二層 fallback：native 連續 N 秒沒命中時自動切 ZXing（可選加碼，先不做，視實測決定）
