## 目標

依據討論結果，調整資料庫 schema 與文件，讓 `coupons` 表純粹作為「領取／使用紀錄」，券碼欄位對齊昇恆昌 16 碼規則，實際券資訊一律由票券中台 API 提供。

## 決策摘要（討論結論）


| 項目                           | 決定                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1 `coupons` 表定位             | **B**：只存 email × coupon_code × 領取／使用時間，不鏡像折扣／效期等資訊（票券中台是 single source of truth）                                                                                   |
| Q2 欄位粒度                      | **拆欄位存**：`coupon_code` char(16) 為主鍵，並用 generated columns 自動拆出 `leading_code` / `issue_source` / `usage_category` / `type_serial` / `serial_number` / `check_digit` |
| Q3 `coupon_allocation_rules` | **廢棄**：刪除規則表、trigger、function                                                                                                                                      |
| Q4 API 呼叫時機                  | **B（Lazy）**：註冊只記 email，使用者進「我的優惠券」頁時才呼叫中台 API                                                                                                                      |
| Q5 券碼來源                      | **(a) 中台回傳**：`coupon_code` 在使用者按「領取」前不存在；按下後寫入中台回傳的 16 碼                                                                                                           |
| Q6 首次 API 觸發                 | **(b) 使用者按「領取」按鈕**：明確意圖、避免被動呼叫造成中台流量浪費                                                                                                                             |


## 新版資料流

```text
1. 註冊 → INSERT participants（不再自動產券）
2. 使用者進 /coupons 頁 → 前端 GET /api/coupons/available
   （server function 呼叫中台「該 email 可領哪些券」）
3. 使用者按「領取」 → POST /api/coupons/claim
   - server function 呼叫中台領券 API → 拿到 16 碼 coupon_code
   - INSERT coupons (coupon_code, email, assigned_at)
4. 使用者使用券 → 中台 webhook 或下次查詢時 UPDATE coupons.used_at
```

## 變更內容

### A. 資料庫 migration（單一遷移檔）

**1. 廢棄舊機制**

- `DROP TRIGGER trg_assign_coupons_on_participant ON public.participants`
- `DROP FUNCTION public.assign_coupons_to_participant()`
- `DROP TABLE public.coupon_allocation_rules`

**2. 重建 `coupons` 表結構**

- 改 `coupon_code` 為 `char(16) PRIMARY KEY`
- 加 CHECK：`coupon_code ~ '^[0-9][0-9][WER][1-7][0-9]{11}$'`（Leading 2 數字 + W/E/R + 1-7 + 11 位數字）
- 新增 generated columns（`STORED`，自動由 `coupon_code` 拆解）：
  - `leading_code char(2)`  → substring 1-2（99/98/97/96 = iRich/ERP/POS/宜睿）
  - `issue_source char(1)`  → substring 3 (W/E/R)
  - `usage_category char(1)` → substring 4 (1-7)
  - `type_serial char(2)`   → substring 5-6
  - `serial_number char(9)` → substring 7-15
  - `check_digit char(1)`   → substring 16
- `email` 改 `NOT NULL` + 加回 `REFERENCES participants(email) ON DELETE CASCADE`（Q1 結論：不允許未指派的券存在）
- `assigned_at timestamptz NOT NULL DEFAULT now()`（領取即建立）
- `used_at timestamptz`（中台回傳後 update）
- 移除 `note` 欄位（細節由中台 API 提供，不在 DB 鏡像）
- 加 unique index：`(email, coupon_code)`，加 btree index：`(email, used_at)` 方便查未使用券

**3. RLS 政策調整**

- 保留：`Anyone can read coupons`（前端依 email 過濾）
- 新增：`Anyone can insert coupon claim`（INSERT WITH CHECK true，由 server function 呼叫）
- 新增：`Anyone can update coupon used_at`（UPDATE，僅允許 used_at 變更 — 由 server function trigger 收緊）

> 註：實際生產環境 RLS 應改為 `auth.uid()` 收緊，這部分已列在文件第 7 節 R3。

### B. 文件更新 `docs/DATABASE_SCHEMA.md`

- 第 1 節「概覽」：表數量改為 4 張（移除 `coupon_allocation_rules`）
- 第 1 節「資料流」：改寫為新版 Lazy 領取流程
- 第 2 節 `coupons` 表：完整改寫欄位規格、新增 16 碼結構說明表
- 第 2 節：刪除 `coupon_allocation_rules` 整段
- 第 3 節「函式」：刪除 `assign_coupons_to_participant()` 段落
- 第 4 節「Triggers 總覽」：移除 coupon trigger
- 新增第 9 節「票券中台 API 對接規格」：列出 server function 預期 endpoint、I/O schema、錯誤處理
- 第 7 節風險表：新增 R8「中台 API 不可用時的降級策略」
- 附錄 A：更新精簡 SQL

### C. 前端 server function 骨架（暫不接真實中台）

新增（純骨架 + TODO，等中台 API 規格出來才實作）：

- `src/lib/coupons.functions.ts`
  - `listAvailableCoupons({ email })` — 回傳可領清單（mock）
  - `claimCoupon({ email, coupon_template_id })` — 呼叫中台拿 16 碼 → INSERT
  - `markCouponUsed({ coupon_code })` — UPDATE used_at（webhook 或輪詢用）
- 修改 `src/lib/api.ts`：`getMyCoupons` 維持原樣（讀本地 coupons 表 = 已領取紀錄）

### D. `.env` 預留變數（文件提及，不實際寫入）

- `COUPON_MIDDLEWARE_BASE_URL`
- `COUPON_MIDDLEWARE_API_KEY`（之後用 `secrets--add_secret`）

## 不會動到的部分

- `participants`、`lottery_entries`、`winners` 三張表結構
- 抽獎登錄邏輯（TN_FORMAT、`submitLotteryEntry`）
- i18n、UI 元件、樣式
- 認證機制（仍是匿名 RLS 全開，等之後另案收緊）

## 風險與注意事項

1. **breaking change**：`coupon_allocation_rules` 表會被 drop，目前資料會遺失（確認過此表為純設定，非交易資料）
2. **舊 coupons 資料**：現有 `coupons` 表的測試資料無法符合新 CHECK 約束，migration 需先 `TRUNCATE coupons` 或 `DROP TABLE` 重建
3. **前端** `/coupons` **頁面**：在中台 API 接通前會顯示空清單（因為不再自動配券），是先放 mock 資料供前端測試需確認
4. **types.ts 重新生成**：migration 後 Supabase types 會自動更新，前端 `Coupon` interface 需同步調整（移除 `note`，新增拆解欄位）

## 待確認

- 上面 D 項的環境變數 / secret 名稱是否照建議命名？ -是
- 風險 3：`/coupons` 頁面在中台接通前要不要顯示 mock 券？還是先顯示「目前無可領取優惠券」即可？ -要