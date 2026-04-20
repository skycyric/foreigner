

## 修正 Android 掃描速度 + 測試模式失效

### 問題 1：Android 相機掃描慢

可能原因（需看 scan.tsx 確認）：
- `@yudiel/react-qr-scanner` 預設 scan delay 較保守
- 沒指定後鏡頭 / 解析度過高導致每幀處理變慢
- constraints 沒鎖定 `facingMode: environment` 或解析度

### 問題 2：測試 QR code 一直顯示「已掃過」

可能原因：
1. **`IS_TEST_MODE` 在 published 環境是 false** — 目前用 `import.meta.env.DEV`，但 published preview / production build 都是 false，所以 TN 不會加時間戳，第二次掃就被 unique constraint 擋掉
2. user 現在在 `id-preview--*.lovable.app`（published preview），不是 dev server，所以測試模式根本沒啟用

從 console 看到 `index-CTRb1Dr1.js`（minified bundle）→ 確認是 production build，`import.meta.env.DEV = false`。

### 修正方案

**1. 改 `src/lib/test-mode.ts` — 用更可靠的判斷**

改用 hostname 判斷，preview / lovableproject 環境都算測試：
```ts
export const IS_TEST_MODE =
  import.meta.env.DEV ||
  (typeof window !== "undefined" &&
    /lovable(project)?\.app$/.test(window.location.hostname));
```

正式網域（例如自訂 domain 或 `foreigner.lovable.app` published 上線後）只要不在白名單就會自動關掉。

> 補充：若希望 `foreigner.lovable.app`（published 正式網址）也關掉測試模式，會排除 `foreigner.lovable.app`，只允許 `*-preview--*.lovable.app` 與 `lovableproject.com`。會在 plan 確認後實作。

**2. 加快 Android 掃描（`src/routes/$lang.scan.tsx`）**

需先 view 檔案確認目前 props，預期調整：
- `scanDelay={100}` （或更低，預設常是 500ms）
- `constraints={{ facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }}` — 鎖定後鏡頭 + 720p（過高解析會拖慢解碼）
- 確認 `formats={["qr_code"]}` 限制只解 QR（如果套件支援）

**3. SSR hydration 注意**

`window.location.hostname` 在 SSR 會炸 → 已用 `typeof window !== "undefined"` 守衛，SSR 時回傳 false，client hydrate 後才變 true。這對 TN 提交沒影響（提交一定在 client 端發生）。

### 檔案影響
- 修改：`src/lib/test-mode.ts`、`src/routes/$lang.scan.tsx`
- 不動 DB、不動 docs（PRODUCTION_CHECKLIST 仍適用）

### 風險
- 測試模式判斷改寬後，preview 網域的所有掃描資料都會帶 `__t` 後綴 → 上線清理 SQL 一樣可清乾淨，符合既有 checklist
- 掃描速度調快若造成誤判，可回調 `scanDelay`

