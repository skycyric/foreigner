
## 問題

使用者操作（掃 QR、登錄交易單號、查抽獎結果、領取/查詢優惠券）後，畫面沒有明確的「處理中」遮罩，按鈕只是 disabled 但視覺上幾乎沒變化，導致使用者以為沒反應、一直重複點擊。同時跳轉時也是「畫面突然換掉」，沒有過渡提示。

掃過所有有非同步動作的頁面，盤點如下：

| 頁面 | 觸發點 | 目前狀態 | 問題 |
|---|---|---|---|
| `welcome` | 送出 email | 按鈕變 disabled、顯示 `submitting` 文字 | 太弱，使用者看不出來 |
| `manual` | 送出交易單號 | 按鈕變 disabled | 同上 |
| `scan` | 掃到 QR / 上傳照片 | 上方一行小字「正在辨識」 | 容易被忽略，且照片掃描時相機區塊空白 |
| `coupons` | 載入優惠券、按「掃描 QR」、按「手動輸入」 | 沒有過渡遮罩，按下按鈕到下一頁有空檔 | 使用者重複點 |
| `result` | 載入抽獎結果 | 用 `Loading...` 純文字 | 太單薄 |
| `winners` | 載入名單 | 用 `Loading...` 純文字 | 同上 |
| `index` (語系跳轉) | 入站第一秒 | 整頁空白 | 使用者以為壞了 |

---

## 解法

做一個**統一的全螢幕 Loading Overlay**，所有「會卡住一段時間」或「即將跳頁」的時刻都顯示它。一致的視覺語言＝使用者不會困惑。

### 1. 新建共用元件 `src/components/LoadingOverlay.tsx`

- 半透明黑色全螢幕遮罩（`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm`）
- 中央放一個大的 spinner（用 `lucide-react` 的 `Loader2` + `animate-spin`）
- 下方顯示一行訊息（i18n 文案）
- `pointer-events: auto` 完全擋住背景點擊，避免使用者誤觸
- props：`open: boolean`、`message?: string`

### 2. 新建小型 inline `Spinner` 元件

給按鈕內顯示用，按下按鈕後按鈕內出現 spinner + 文字（取代純 disabled）。

### 3. 各頁套用

**welcome**
- 送出 email 中：按鈕內顯示 spinner
- 送出成功正在跳轉到 `coupons`：顯示全螢幕 LoadingOverlay（訊息：「準備您的優惠券…」）

**manual**
- 送出中：按鈕內 spinner
- 送出成功跳 `result` 中：全螢幕 overlay（訊息：「處理中…」）

**scan**
- 掃到 QR / 上傳照片解碼成功 → 呼叫 API 期間：全螢幕 overlay（訊息：「驗證交易單號…」）
  - 取代目前那行不明顯的 `scan.processing` 狀態文字
- 上傳照片解碼期間（`fileScanning`）：全螢幕 overlay（訊息：「辨識中…」）

**coupons**
- 初次載入清單：用 skeleton 卡片（不要白屏）
- 點「掃描 QR」/「手動輸入」按鈕：立刻顯示全螢幕 overlay 再跳頁，避免空檔
- 同樣處理「查看抽獎結果」按鈕

**result**
- 載入中：全螢幕 overlay（訊息：「查詢結果中…」）取代目前的 `Loading...` 純文字

**winners**
- 載入中：用 skeleton 列表

**index（語系跳轉）**
- 顯示一個極簡的全螢幕 spinner（不需要文字，因為 i18n 還沒載入），避免白屏

### 4. i18n 文案新增

`src/locales/{zh,en,ja,ko}.json` 加：
- `common.loading`（通用）
- `common.processing`（處理中）
- `common.verifying`（驗證中）
- `common.preparing`（準備中）
- `common.redirecting`（跳轉中）

### 5. 防呆：按鈕點擊去抖

所有觸發跳頁的按鈕，按下後立刻 setState 顯示 overlay，避免使用者短時間內連點兩次觸發兩次導航。

---

## 不會動到的部分

- ZXing 掃描器邏輯
- AlertDialog（已使用過交易單）popup
- API / Supabase 邏輯
- 路由結構

---

## 待確認

1. **視覺風格**：Loading overlay 你想要 (a) 半透明黑底 + 白色 spinner（簡潔）還是 (b) 帶品牌色（用主色 spinner）？我預設走 (b)，更符合活動氛圍。
2. **是否需要 skeleton**：`coupons` 與 `winners` 的列表載入，要做 skeleton 卡片，還是統一用全螢幕 overlay 就好？我預設 skeleton（體感較順）。

如果這兩點沒意見，我直接照預設執行。
