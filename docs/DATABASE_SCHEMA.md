# 資料庫 Schema 規格書

> 本文件描述本專案於 Lovable Cloud（PostgreSQL）內所有資料表的完整規格，
> 作為交接給後端工程師、或日後對接票券中台 API 的依據。
>
> 若資料表結構有調整，請以 `supabase/migrations/` 中最新的遷移檔為準。

---

## 1. 概覽

- **DBMS**：PostgreSQL（由 Lovable Cloud / Supabase 託管）
- **Schema**：`public`
- **資料表數量**：3 張
  - `participants`
  - `lottery_entries`
  - `winners`

> **優惠券**：3 組固定券號改存於前端常數 `src/lib/coupons.ts`，**不再使用資料表**。
> 詳見本文件第 9 節「優惠券（前端常數）」。
- **自訂型別 / Enums**：無
- **Storage Buckets**：無

### ER 關聯圖

```text
             participants
              (PK: email)
                  │
                  ▼
              lottery_entries
              (FK: email → participants.email,
               ON DELETE CASCADE)

  winners
  （獨立公告表，無關聯）
```

### 資料流（重要！）

本系統採 **Lazy 領券** 設計，本地 `coupons` 表只記錄「領取／使用紀錄」，
券的細節（折扣、效期、券種名稱）一律由**票券中台 API** 提供。

```text
1. 註冊 → INSERT participants（不再自動產券）
2. 使用者進 /coupons 頁
   → 前端呼叫 server function `listAvailableCoupons({ email })`
   → server function 呼叫中台「該 email 可領哪些券」
3. 使用者按「領取」按鈕
   → 前端呼叫 server function `claimCoupon({ email, template_id })`
   → server function 呼叫中台領券 API → 拿到 16 碼 coupon_serialnum
   → INSERT 至本地 coupons 表
4. 使用者使用券
   → 中台 webhook（或下次查詢時）→ UPDATE coupons.used_date
5. 使用者掃描 / 手動輸入 TN → INSERT lottery_entries
   （tn_number UNIQUE，重複會回 23505）
```

---

## 2. 各資料表詳細規格

### Table: `participants`

- **用途**：儲存所有參與者基本資料（email、語言偏好、裝置 ID）
- **Primary Key**：`email`

| 欄位名 | 型別 | Nullable | 預設值 | 說明 |
|---|---|---|---|---|
| `email` | `text` | NO | — | 主鍵 |
| `device_id` | `text` | YES | — | 前端 device fingerprint |
| `language` | `text` | NO | `'zh'` | zh / en / ja / ko |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | trigger 自動維護 |

**索引**：`participants_pkey (email)`、`idx_participants_device (device_id)`

**RLS**：SELECT / INSERT / UPDATE 皆 `public` 全開（⚠️ 上線前需收緊，見第 7 節 R3）

**Triggers**：
- `update_participants_updated_at` (BEFORE UPDATE) → `update_updated_at_column()`

---

### Table: `lottery_entries`

- **用途**：儲存所有抽獎登錄紀錄（每張交易券號一筆）
- **Primary Key**：`id`

| 欄位名 | 型別 | Nullable | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主鍵 |
| `tn_number` | `text` | NO | — | 交易券號（UNIQUE，格式由前端 `TN_FORMAT` 控制） |
| `email` | `text` | NO | — | FK → `participants.email` ON DELETE CASCADE |
| `raw_payload` | `text` | YES | — | QR 原始字串 |
| `source` | `text` | NO | `'manual'` | `'manual'` / `'qr'`（無 CHECK） |
| `created_at` | `timestamptz` | NO | `now()` | |

**索引**：`lottery_entries_pkey`、`lottery_entries_tn_number_key (UNIQUE)`、`idx_lottery_email`

**RLS**：SELECT / INSERT 皆 `public` 全開（⚠️ R3）

**重複登錄**：UNIQUE 衝突回傳 PostgreSQL `23505` → 前端翻譯為 `{ alreadyUsed: true }`

> ⚠️ **測試模式**：`isTestTn(tn)` 為真的測試券號會被加上 `__t<timestamp>` 後綴繞過唯一檢查（上線前需移除）。

---

### Table: `winners`

- **用途**：抽獎結果公告
- **Primary Key**：`id`

| 欄位名 | 型別 | Nullable | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主鍵 |
| `prize_name` | `text` | NO | — | 獎項名稱 |
| `masked_email` | `text` | NO | — | 已遮罩的 email |
| `rank` | `integer` | NO | `1` | 名次 |
| `is_backup` | `boolean` | NO | `false` | 是否為備取 |
| `announced_at` | `timestamptz` | NO | `now()` | |

**RLS**：SELECT `public`（公開公告）

---

## 3. 資料庫函式

### `update_updated_at_column()`

通用 trigger function：BEFORE UPDATE 時把 `NEW.updated_at` 設為 `now()`。
目前掛載：`participants.update_participants_updated_at`。

---

## 4. Triggers 總覽

| Table | Trigger | 時機 | 函式 |
|---|---|---|---|
| `participants` | `update_participants_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |

---

## 5. Enums / 自訂型別

無。

---

## 6. Storage Buckets

無。

---

## 7. 已知資料完整性風險

| 編號 | 項目 | 嚴重性 | 說明 | 建議 |
|---|---|---|---|---|
| R3 | RLS 政策**全部開放 public** | **高** | 任何匿名使用者皆可讀／寫 `lottery_entries` / `participants` | 上線前需改為 `auth.uid()` 比對 |
| R4 | `participants` 無 DELETE 政策 | 低 | GDPR / 個資法刪除權需求 | 視業務需求新增 admin-only 政策 |
| R6 | `lottery_entries.source` 無 CHECK | 低 | 前端可寫入任意字串 | 可加 `CHECK (source IN ('manual','qr'))` |
| R7 | 測試模式 TN 後綴繞過 | **高** | `src/lib/api.ts` 在 `isTestTn` 為真時會繞過唯一檢查 | 上線前移除 |

---

## 8. 與前端／Server Function 對應表

| 方法 | 位置 | 操作 | 表 / 對外 API |
|---|---|---|---|
| `getOrCreateParticipant()` | `src/lib/api.ts` | UPSERT | `participants`（onConflict: email） |
| `submitLotteryEntry()` | `src/lib/api.ts` | INSERT | `lottery_entries` |
| `getWinners()` | `src/lib/api.ts` | SELECT | `winners` ORDER BY rank |

---

## 9. 優惠券（前端常數）

3 組固定券號儲存於 `src/lib/coupons.ts`：

| 券號 | 用途 |
|---|---|
| `97E51126A6002000` | 折扣券 A6 |
| `97E51126A1008000` | 折扣券 A1 |
| `97E51126F1003000` | 折扣券 F1 |

- 前端用 `qrcode` 套件即時把 16 碼券號編成 QR Code 顯示
- POS 端用掃描器讀 QR → POS 後端 parser 取得 16 碼 → 中台核銷
- **本系統不記錄誰用了哪張券**（無 DB 寫入路徑）
- 詳見 `docs/MIGRATION_PLAN.md`「優惠券（已搬完）」

---

## 附錄 A：完整重建 SQL（精簡版）

```sql
-- participants
CREATE TABLE public.participants (
  email      text PRIMARY KEY,
  device_id  text,
  language   text NOT NULL DEFAULT 'zh',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_participants_device ON public.participants(device_id);

-- lottery_entries
CREATE TABLE public.lottery_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tn_number   text NOT NULL UNIQUE,
  email       text NOT NULL REFERENCES public.participants(email) ON DELETE CASCADE,
  raw_payload text,
  source      text NOT NULL DEFAULT 'manual',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lottery_email ON public.lottery_entries(email);

-- winners
CREATE TABLE public.winners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_name   text NOT NULL,
  masked_email text NOT NULL,
  rank         integer NOT NULL DEFAULT 1,
  is_backup    boolean NOT NULL DEFAULT false,
  announced_at timestamptz NOT NULL DEFAULT now()
);
```

RLS、Triggers 的建立 SQL 請見 `supabase/migrations/`。
