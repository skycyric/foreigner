## 目標
在 `lottery_entries` 新增 `transaction_time` 欄位，解析 QR payload（`YA2101223581^20251206^0^ER`）的第二段 `20251206` 寫入，時間部分固定 `00:00:00`。

## 1. DB Migration
新增欄位（可為 NULL，避免歷史資料壞掉）：
```sql
ALTER TABLE public.lottery_entries
  ADD COLUMN transaction_time timestamptz;
CREATE INDEX idx_lottery_transaction_time
  ON public.lottery_entries(transaction_time);
```
- Nullable：手動輸入沒有日期；舊資料保留 NULL。
- 用 `timestamptz`，日期部分由前端解析後傳 `YYYY-MM-DD 00:00:00`。

## 2. 解析邏輯（`src/routes/$lang.scan.tsx`）
擴充現有 `parseTnFromScan`：
- 新增 `parseTransactionDate(raw)` → 取 `split("^")[1]`，驗證 8 碼數字，回傳 `"2025-12-06 00:00:00"`，否則 `undefined`。
- scan handler 一併取得 `transactionTime` 傳入 `submitLotteryEntry`。
- 手動輸入頁 (`manual.tsx`) 不傳 `transactionTime`，欄位留 NULL。

## 3. API 層 (`src/lib/api.ts`)
- `submitLotteryEntry` input 新增 optional `transaction_time?: string`。
- INSERT 時帶入：`transaction_time: input.transaction_time ?? null`。
- 遠端 API 分支 (`USE_REMOTE_API`) 也透傳此欄位 → 對接公司 API 時格式一致。

## 4. Types
Migration 跑完後 `src/integrations/supabase/types.ts` 會自動更新，無需手動編輯。

## 5. 文件更新
- `docs/DATABASE_SCHEMA.md`：`lottery_entries` 欄位表新增 `transaction_time` 一列、附錄 SQL 同步。
- `docs/MIGRATION_PLAN.md`：在 `/lottery/submit` API contract 加上 `transaction_time` 欄位。

## 不動的部分
- RLS 政策、UNIQUE on tn_number、測試模式後綴邏輯都不變。
- 不解析第三段（金額）、第四段（`ER`）— 目前需求只要日期。

## 待確認
1. 第二段日期格式固定 `YYYYMMDD` 8 碼？或可能出現其他格式？
2. 解析失敗（非 8 碼數字）時：寫 NULL 還是擋下整筆登錄？建議寫 NULL，因為 `raw_payload` 已保留原字串可事後追查。
