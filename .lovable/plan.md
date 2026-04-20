
## 修正回上一頁循環 + 換掉 html5-qrcode

### Part 1：回上一頁循環修正

**根本原因**
- `Header.handleBack()` 用 `router.history.back()`，但 `scan / manual → result` 時用 `navigate(push)`，history 累積成 `coupons → scan → result`
- 從 result 頁按「再抽一次」回 coupons 也是 push，再按瀏覽器 back 會回到 result，然後 result 又被當作有效歷史 → 看起來像循環
- 同時 Header 的 back 在某些頁面（如 manual）跟頁內的「返回」按鈕都導去 coupons，但走的路徑不同（一個 history.back、一個 navigate push），互相打架

**做法（`src/components/Header.tsx` + 三個頁面）**
1. Header 的 `handleBack` 改成：依當前路徑決定目的地，而不是無腦 `history.back()`
   - `/scan`、`/manual`、`/coupons` → 回 `/$lang`（首頁）或 `/$lang/coupons`
   - 其他 → fallback `/$lang`
   - 用一個簡單 map：`{ scan: 'coupons', manual: 'coupons', coupons: 'index', winners: 'index', about: 'index', terms: 'index' }`
2. `scan.tsx` / `manual.tsx` 導向 `/result` 時改用 `navigate({ ..., replace: true })` → result 不進 history，避免 back 又回到 result 觸發二次提交
3. `manual.tsx` 頁內的「返回」按鈕直接 `navigate({ to: "/$lang/coupons", replace: true })`，跟 Header 行為一致
4. `result.tsx` 的「再抽一次」/「回首頁」用 `<Link>` 即可，但加上 `replace`（透過 navigate 包一層 button），避免堆疊

### Part 2：換掉 html5-qrcode → @zxing/browser

**選擇理由**
- Dynamsoft Barcode Reader Web：商用、需 license key（trial 30 天後綁卡），不適合這個場景
- 原生 ZXing Android Intent：要寫 Android app，這是 web app 不適用
- **`@zxing/browser` + `@zxing/library`**：開源、ZXing 官方 JS port、已被 Google Lens / 多數 web QR app 採用、對紙本印刷品的容錯率明顯優於 html5-qrcode（更好的 binarizer，能處理低對比、反光、輕微失焦）

**做法（`src/routes/$lang.scan.tsx`）**
1. 加套件 `@zxing/browser`、`@zxing/library`
2. 把 `Html5Qrcode` 整段換成 `BrowserMultiFormatReader`：
   ```ts
   const hints = new Map();
   hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
   hints.set(DecodeHintType.TRY_HARDER, true);  // 紙本必開
   const reader = new BrowserMultiFormatReader(hints);
   await reader.decodeFromVideoDevice(deviceId, videoEl, (result, err) => {...});
   ```
3. 直接用 `<video ref={...}>` 元素，不再依賴 html5-qrcode 內建 UI（少一層 DOM 操作）
4. 保留現有的：
   - 高解析 constraint（1920x1080 / fps 30）
   - tap-to-focus、zoom、torch（直接對 `videoEl.srcObject` 取 track）
   - 上傳照片 fallback：用 `reader.decodeFromImageUrl()`
   - 自動播放失敗 → tap to resume
5. 移除 html5-qrcode 相關的 `useBarCodeDetectorIfSupported`、`qrbox`、`videoConstraints` 等設定
6. `extractTn`、`isValidTnFormat`、`processDecodedText`、busy/blocked/cancelled refs 等全部保留不動

### 檔案影響
1. `src/components/Header.tsx` — 改 `handleBack` 邏輯
2. `src/routes/$lang.scan.tsx` — 重寫 scanner 部分（約 100 行），UI 與 toolbar 不變
3. `src/routes/$lang.manual.tsx` — 兩處 navigate 加 `replace: true`
4. `package.json` — 加 `@zxing/browser`、`@zxing/library`，移除 `html5-qrcode`

### 風險
- ZXing-js 的 file scan API 名稱不同 → 用 `decodeFromImageUrl(URL.createObjectURL(file))`，記得 revoke
- 沒有 `qrbox` 視覺框 → 用 CSS 在 video 上疊一個半透明框當引導，不影響解碼
- iPhone 已正常 → ZXing-js 在 iOS Safari 也是支援的，回歸測試一遍即可
