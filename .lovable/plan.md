## 目標

直接覆蓋為**搬遷版**：砍掉所有 Supabase 與用不到的程式碼/欄位，只保留會打到 everrich API 的單一流程。API 不在 dev 測試，假設照格式跑都通。

## 一、新增

**`src/lib/api.ts`（完全重寫）**
- 唯一方法：`api.submitEntry({ email, tn, lang })`
- `POST /landing/eventpost.php`（相對路徑，same-origin）
- `Content-Type: application/x-www-form-urlencoded`
  - `lang_type` = `tw / en / jp / kr`
  - `eventName` = `EmailLuckyDraw2026`（檔內常數）
  - `upload_data` = `JSON.stringify({ Email, NoteText: tn })`
- HTTP 2xx 視為成功；非 2xx throw
- 保留 `TN_FORMAT` / `isValidTnFormat` / `InvalidTnError`
- localStorage 黑名單 `lucky_used_tns`：送出前命中 → 回 `{ alreadyUsed: true }`，成功後寫入

**`src/lib/lang-map.ts`**
- `toEverrichLang(lang): 'tw'|'en'|'jp'|'kr'`

## 二、改

- **`src/lib/identity.ts`**：移除 `getDeviceId` 與相關 cookie（只保留 email）
- **`src/lib/server-identity.ts`**：精簡到只剩 `detectInitialLang`，移除 `getSsrIdentity` 的 deviceId
- **`src/routes/$lang.welcome.tsx`**：移除 `getOrCreateParticipant` 呼叫，email 只寫 localStorage + cookie
- **`src/routes/$lang.manual.tsx`** / **`src/routes/$lang.scan.tsx`**：改呼叫 `api.submitEntry({ email, tn, lang })`；移除 `source` / `raw_payload` / `transaction_time` 傳遞；命中黑名單顯示「此單號已登錄」
- **`src/components/Header.tsx`** / 任何導引：移除 `/winners` 入口
- **locale 檔**（zh/en/ja/ko.json）：移除 `winners.*` 字串
- **`.env`**：移除 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID`

## 三、刪

- `src/routes/$lang.winners.tsx`
- `src/integrations/supabase/`（整個資料夾）
- `supabase/`（migrations + config.toml）
- `src/lib/device.ts`（功能搬到 identity.ts）
- `src/lib/test-mode.ts`
- `docs/DATABASE_SCHEMA.md`
- `package.json` 依賴：`@supabase/supabase-js`

## 四、保留

- 所有 UI / 樣式 / logo / 多語系
- 優惠券 (`src/lib/coupons.ts`)
- QR scan 解析邏輯（只取出 TN，丟給 `submitEntry`）
- TanStack Start SSR + `$lang` 路由
- TN 格式 `^[A-Z]{2}\d{10}$` 前端驗證

## 五、文件

- `docs/MIGRATION_PLAN.md` → 改寫為「搬遷版部署指南」：same-origin 假設、API 規格、localStorage 重複檢查的限制、上線檢查清單
- `docs/PRODUCTION_CHECKLIST.md` → 同步更新（移除 Supabase 相關項目、移除測試模式項目）

## 六、已知風險（先記錄）

- 後端回應格式未知 → 以 HTTP 2xx 判定成功；實際接通後若格式不符再調 `submitEntry`
- NoteText 後端無驗證 → 前端 regex 為唯一防線
- 重複登錄純靠 localStorage → 清快取/換瀏覽器會繞過（後端 API 不支援，接受此取捨）
- Dev 階段打 `/landing/eventpost.php` 必然 404 → 不在 dev 測試，UI 用 mock console.log 觀察即可（實作上送出後直接視為成功處理 UX flow）
