
## 移除白名單機制

把 `valid_transactions` 白名單比對拿掉，改成只擋「同一張單號重複登錄」。

### 變更內容

**1. 資料庫 (migration)**
- `DROP TABLE public.valid_transactions`（含其 RLS policy，會一併消失）
- 在 `lottery_entries.tn_number` 加 `UNIQUE` 索引，從 DB 層保證一張單號全站只能登錄一次（避免 race condition）

**2. API 層 (`src/lib/api.ts`)**
- 移除 `lookupTransaction` 對 `valid_transactions` 的查詢，只查 `lottery_entries`
- 回傳簡化為 `{ alreadyUsed: boolean }`，移除 `found / amount / date`
- `submitLotteryEntry` 改用 try/catch 捕捉 unique 衝突 (Postgres `23505`)，轉成「已使用」訊息

**3. 掃描頁 (`src/routes/$lang.scan.tsx`)**
- 移除「查無此單」分支，只保留「已使用」與「成功」兩種結果
- 任何能解出 TN 格式的 QR 都視為有效，直接寫入 `lottery_entries`

**4. 手動輸入頁 (`src/routes/$lang.manual.tsx`)**
- 同上，拿掉「查無此單」分支
- 仍保留前端格式驗證（2 英文字母 + 數字）

**5. 多語系 (`src/locales/{zh,en,ja,ko}.json`)**
- 移除 `manual.notFound` 訊息（或保留 key 但不再使用，建議直接移除以保持乾淨）
- `manual.alreadyUsed` 維持

**6. 結果頁 (`src/routes/$lang.result.tsx`)**
- 確認沒有依賴 `amount / txn_date` 的顯示；若有，改為僅顯示登錄成功 + TN

### 不變的部分
- 註冊 (participants)、優惠券派發 trigger、抽獎名單 (winners)、cookie 自動登入流程都不動
- TN 仍用 `extractTn()` 取 `^` 前段並轉大寫

### 確認
- `valid_transactions` 目前只有 5 筆測試資料，刪表不會影響正式資料
- `coupon_allocation_rules` / `coupons` / `participants` / `winners` 完全不受影響

### 風險與後續
- 拿掉白名單後，任何看似合法的 TN 字串都能登錄，僅靠「同單號只能一次」防重複。若日後想再加防濫用，可改為「同 email 每日上限 N 筆」或「需收據照片人工審核」，但這次不做。
