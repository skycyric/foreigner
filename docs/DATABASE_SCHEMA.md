# 資料庫 Schema 規格書

> 本文件描述本專案於 Lovable Cloud（PostgreSQL）內所有資料表的完整規格，
> 作為交接給後端工程師、或日後對接票券中台 API 的依據。
>
> 若資料表結構有調整，請以 `supabase/migrations/` 中最新的遷移檔為準。

---

## 1. 概覽

- **DBMS**：PostgreSQL（由 Lovable Cloud / Supabase 託管）
- **Schema**：`public`
- **資料表數量**：4 張
  - `participants`
  - `lottery_entries`
  - `coupons`
  - `winners`
- **自訂型別 / Enums**：無
- **Storage Buckets**：無

### ER 關聯圖

```text
             participants
              (PK: email)
                  │
      ┌───────────┴────────────┐
      ▼                        ▼
  lottery_entries           coupons
  (FK: email →              (FK: email →
   participants.email,       participants.email,
   ON DELETE CASCADE)        ON DELETE CASCADE)

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

### Table: `coupons`

- **用途**：使用者**領取／使用紀錄**。本表**不**鏡像券細節（折扣、效期、券種名稱），
  那些一律由票券中台 API 提供。
- **Primary Key**：`coupon_serialnum`（固定 16 碼，由中台領券 API 回傳）

#### 欄位規格

| 欄位名 | 型別 | Nullable | 預設值 | 說明 |
|---|---|---|---|---|
| `coupon_serialnum` | `char(16)` | NO | — | 主鍵，16 碼券號（見下方結構） |
| `email` | `text` | NO | — | FK → `participants.email` ON DELETE CASCADE |
| `used_date` | `timestamptz` | YES | — | 使用時間（中台 webhook 後 UPDATE） |
| `created_at` | `timestamptz` | NO | `now()` | |
| `leading_code` | `char(2)` | — | _generated_ | substring 1-2，由 `coupon_serialnum` 自動拆解 |
| `issue_source` | `char(1)` | — | _generated_ | substring 3 |
| `usage_category` | `char(1)` | — | _generated_ | substring 4 |
| `type_serial` | `char(2)` | — | _generated_ | substring 5-6 |
| `serial_number` | `char(9)` | — | _generated_ | substring 7-15 |
| `check_digit` | `char(1)` | — | _generated_ | substring 16 |

> generated columns 為 `STORED`，由 PostgreSQL 在 INSERT/UPDATE 時自動依 `coupon_serialnum`
> 拆解，不可手動寫入。

#### 16 碼券號結構（昇恆昌規則）

```text
[Leading Code 2碼][券別代碼 4碼][流水號 9碼][檢查碼 1碼]
        99            W101         180000001        0
        |             |||
        |             ||└─ type_serial：券種流水（2碼）
        |             |└── usage_category：1-7
        |             └─── issue_source：W / E / R
        └───────────────── leading_code：99/98/97/96
                            = iRich CRM / ERP / POS / 宜睿
```

#### CHECK 約束

```sql
coupons_code_format_chk:
  coupon_serialnum ~ '^[0-9]{2}[WER][1-7][0-9]{11}$'
```

#### 索引

| Index 名稱 | 欄位 | 類型 |
|---|---|---|
| `coupons_pkey` | `coupon_serialnum` | UNIQUE (PK) |
| `idx_coupons_email` | `email` | btree |
| `idx_coupons_email_used` | `(email, used_date)` | btree |

#### 外鍵

| 來源欄位 | 目標 | ON DELETE |
|---|---|---|
| `email` | `participants.email` | CASCADE |

#### RLS 政策

| 政策名稱 | 操作 | 角色 | 條件 |
|---|---|---|---|
| Anyone can read coupons | SELECT | public | `USING (true)` |
| Anyone can insert coupon claim | INSERT | public | `WITH CHECK (true)`（由 `claimCoupon` server fn 呼叫） |
| Anyone can update coupon used_date | UPDATE | public | `USING (true) WITH CHECK (true)`（由 `markCouponUsed` server fn 呼叫） |

> ⚠️ 寫入路徑目前依賴 server function 自律（並未限制只能改 `used_date`）。
> 上線前需改為 `auth.uid()` 收緊 + 欄位層級限制（見 R3）。

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

> ⚠️ 舊版的 `assign_coupons_to_participant()` 已於本次重構中刪除（改為 Lazy 領券）。

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
| R3 | RLS 政策**全部開放 public** | **高** | 任何匿名使用者皆可讀／寫 `coupons` / `lottery_entries` / `participants` | 上線前需改為 `auth.uid()` 比對 |
| R4 | `participants` 無 DELETE 政策 | 低 | GDPR / 個資法刪除權需求 | 視業務需求新增 admin-only 政策 |
| R6 | `lottery_entries.source` 無 CHECK | 低 | 前端可寫入任意字串 | 可加 `CHECK (source IN ('manual','qr'))` |
| R7 | 測試模式 TN 後綴繞過 | **高** | `src/lib/api.ts` 在 `isTestTn` 為真時會繞過唯一檢查 | 上線前移除 |
| R8 | 票券中台 API 不可用時的降級 | 中 | Lazy 領券完全依賴中台 | 中台 timeout / 5xx 時前端應顯示「暫時無法領取，請稍後再試」，不要寫入空券碼 |
| R9 | `coupons` UPDATE 政策過寬 | 中 | 目前任何人可改任何欄位（包含 `assigned_at`、`email`） | 加欄位層級 trigger 或改為 `auth.uid()` 並只允許 `used_date` |

---

## 8. 與前端／Server Function 對應表

| 方法 | 位置 | 操作 | 表 / 對外 API |
|---|---|---|---|
| `getOrCreateParticipant()` | `src/lib/api.ts` | UPSERT | `participants`（onConflict: email） |
| `getMyCoupons()` | `src/lib/api.ts` | SELECT | `coupons` WHERE email = $1（已領清單） |
| `submitLotteryEntry()` | `src/lib/api.ts` | INSERT | `lottery_entries` |
| `getWinners()` | `src/lib/api.ts` | SELECT | `winners` ORDER BY rank |
| `listAvailableCoupons()` | `src/lib/coupons.functions.ts` | 中台 GET | （TODO）`{COUPON_MIDDLEWARE_BASE_URL}/coupons/available?email=` |
| `claimCoupon()` | `src/lib/coupons.functions.ts` | 中台 POST + 本地 INSERT | （TODO）`{COUPON_MIDDLEWARE_BASE_URL}/coupons/claim` → INSERT `coupons` |
| `markCouponUsed()` | `src/lib/coupons.functions.ts` | UPDATE | `coupons.used_date` |

---

## 9. 票券中台 API 對接規格（規劃中）

### 環境變數

| 名稱 | 類型 | 說明 |
|---|---|---|
| `COUPON_MIDDLEWARE_BASE_URL` | server-only env | 中台 API base URL |
| `COUPON_MIDDLEWARE_API_KEY` | secret | 中台 API key（用 `secrets--add_secret` 設定） |

### 預期 endpoints

```text
GET  {BASE_URL}/coupons/available?email=...
  → 200 [{ template_id, name, description, issue_source, usage_category, ... }]

POST {BASE_URL}/coupons/claim
  body: { email, template_id }
  → 200 { coupon_serialnum: "16碼" }
  → 409 已領取
  → 410 已售罄

POST {BASE_URL}/webhooks/coupon-used   ← 由中台 call 我們
  body: { coupon_serialnum, used_date }
  → 我們的 server route 收到後 UPDATE coupons.used_date
```

### 錯誤處理原則

- 中台 4xx → 回傳明確錯誤碼給前端，不寫入 DB
- 中台 5xx / timeout → 回傳「暫時無法領取」，前端顯示重試按鈕
- 中台回傳的 `coupon_serialnum` 必須符合 `^[0-9]{2}[WER][1-7][0-9]{11}$`，否則拒絕寫入

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

-- coupons（領取／使用紀錄；細節由中台 API 提供）
CREATE TABLE public.coupons (
  coupon_serialnum      char(16) PRIMARY KEY,
  email            text NOT NULL REFERENCES public.participants(email) ON DELETE CASCADE,
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  used_date          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  leading_code     char(2) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 1 FOR 2)) STORED,
  issue_source     char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 3 FOR 1)) STORED,
  usage_category   char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 4 FOR 1)) STORED,
  type_serial      char(2) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 5 FOR 2)) STORED,
  serial_number    char(9) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 7 FOR 9)) STORED,
  check_digit      char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 16 FOR 1)) STORED,
  CONSTRAINT coupons_code_format_chk
    CHECK (coupon_serialnum ~ '^[0-9]{2}[WER][1-7][0-9]{11}$')
);
CREATE INDEX idx_coupons_email      ON public.coupons(email);
CREATE INDEX idx_coupons_email_used ON public.coupons(email, used_date);

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
