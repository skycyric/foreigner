# Coupons 表欄位調整

## 變更內容

| 原欄位 | 動作 | 新欄位 |
|---|---|---|
| `coupon_code` | 改名 | `coupon_serialnum` |
| `assigned_at` | **刪除**（時間跟著交易單，不需獨立記錄） |  — |
| `used_at` | 改名 | `used_date` |
| `created_at` | 保留不動 | `created_at` |

## 連帶影響（必須一起處理）

1. **Generated columns** (`leading_code`, `issue_source`, `usage_category`, `type_serial`, `serial_number`, `check_digit`)
   - 全部以 `coupon_code` 為來源，PG 不允許直接 rename 被 generated column 引用的欄位。
   - 做法：先 DROP 這 6 個 generated columns → rename `coupon_code` → 重新以 `coupon_serialnum` 為來源 ADD 回去。

2. **CHECK 約束** `coupons_code_format_chk`
   - 引用 `coupon_code`，先 DROP 再以新名稱 `coupon_serialnum` 重建。

3. **Primary Key**
   - PK 名稱 `coupons_pkey` 保留，欄位隨 rename 自動跟上，無需手動處理。

4. **索引** `idx_coupons_email_used`
   - 含 `used_at`，rename 會自動跟隨欄位（PG 行為），不需重建。

5. **RLS Policies**
   - 三條政策 condition 都是 `true`，不引用欄位名稱，無需更動。

## SQL 大綱

```sql
ALTER TABLE public.coupons
  DROP COLUMN leading_code,
  DROP COLUMN issue_source,
  DROP COLUMN usage_category,
  DROP COLUMN type_serial,
  DROP COLUMN serial_number,
  DROP COLUMN check_digit,
  DROP CONSTRAINT coupons_code_format_chk,
  DROP COLUMN assigned_at;

ALTER TABLE public.coupons RENAME COLUMN coupon_code TO coupon_serialnum;
ALTER TABLE public.coupons RENAME COLUMN used_at    TO used_date;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_serialnum_format_chk
    CHECK (coupon_serialnum ~ '^[0-9]{2}[WER][1-7][0-9]{11}$'),
  ADD COLUMN leading_code   char(2) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 1 FOR 2)) STORED,
  ADD COLUMN issue_source   char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 3 FOR 1)) STORED,
  ADD COLUMN usage_category char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 4 FOR 1)) STORED,
  ADD COLUMN type_serial    char(2) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 5 FOR 2)) STORED,
  ADD COLUMN serial_number  char(9) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 7 FOR 9)) STORED,
  ADD COLUMN check_digit    char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 16 FOR 1)) STORED;
```

## 程式碼同步

migration 跑完 `types.ts` 會自動更新，接著修改：

- **`src/lib/api.ts`** — `getMyCoupons()` 的 select / 排序欄位（目前查 `coupons` 並可能用到 `coupon_code` / `used_at` / `assigned_at`）。
- **`src/lib/coupons.functions.ts`** — `claimCoupon`（INSERT 用 `coupon_serialnum`）、`markCouponUsed`（UPDATE `used_date`）。
- **`src/routes/$lang.coupons.tsx`** — 顯示券號、已使用狀態的欄位名稱。
- **`docs/DATABASE_SCHEMA.md`** — 欄位表、generated columns、CHECK 約束、ER 圖、附錄重建 SQL、第 8 節對應表全面更新；移除 `assigned_at` 段落。

## 風險

- 目前 `coupons` 表為空（lazy 領券，尚未對接中台），DROP/重建 generated columns **不會遺失資料**。
- 若實際已有資料，需先評估資料保留策略（此情境暫不適用）。
