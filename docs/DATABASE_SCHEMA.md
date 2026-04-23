# 資料庫 Schema 規格書

> 本文件描述本專案於 Lovable Cloud（PostgreSQL 14.5）內所有資料表的完整規格，
> 包含欄位型別、約束、索引、RLS、觸發器與函式，作為交接給後端工程師、
> 或日後對接自家 API 的依據。
>
> 自動產生時間：以撰寫日為準。若資料表結構有調整，請以 `supabase/migrations/` 中
> 最新的遷移檔為準。

---

## 1. 概覽

- **DBMS**：PostgreSQL 14.5（由 Lovable Cloud / Supabase 託管）
- **Schema**：`public`
- **資料表數量**：5 張
  - `participants`
  - `lottery_entries`
  - `coupons`
  - `coupon_allocation_rules`
  - `winners`
- **自訂型別 / Enums**：無
- **Storage Buckets**：無

### ER 關聯圖

```text
             participants
              (PK: email)
                  │
      ┌───────────┴────────────┐
      │                        │
      ▼                        ▼
  lottery_entries           coupons
  (FK: email →              (FK: email →
   participants.email,       participants.email,
   ON DELETE CASCADE)        ON DELETE CASCADE)

  coupon_allocation_rules     winners
  （獨立規則表，               （獨立公告表，
    被 trigger 讀取）            無關聯）
```

### 資料流（重要！）

1. 使用者輸入 email → `participants` INSERT
2. **AFTER INSERT trigger** 自動執行 `assign_coupons_to_participant()`
3. trigger 讀取 `coupon_allocation_rules` 中所有 `is_active = true` 的規則
4. 依規則的 `quantity_per_participant` 為該 email 產生對應數量的 `coupons` 紀錄
5. 使用者掃描 / 手動輸入 TN → `lottery_entries` INSERT（`tn_number` UNIQUE，重複會回 23505）

---

## 2. 各資料表詳細規格

---

### Table: `participants`

- **用途**：儲存所有參與者基本資料（email、語言偏好、裝置 ID）
- **Primary Key**：`email`
- **Row Count 預估**：每位使用者一筆

#### 欄位規格

| 欄位名 | 型別 | Nullable | 預設值 | Unique | PK | FK | 說明 |
|---|---|---|---|---|---|---|---|
| `email` | `text` | NO | — | ✓ (PK) | ✓ | — | 使用者 email，作為主鍵 |
| `device_id` | `text` | YES | — | — | — | — | 前端產生的 device fingerprint（見 `src/lib/device.ts`） |
| `language` | `text` | NO | `'zh'` | — | — | — | 使用者語系（zh / en / ja / ko） |
| `created_at` | `timestamptz` | NO | `now()` | — | — | — | 建立時間 |
| `updated_at` | `timestamptz` | NO | `now()` | — | — | — | 最後更新時間（由 trigger 自動維護） |

#### 索引

| Index 名稱 | 欄位 | 類型 |
|---|---|---|
| `participants_pkey` | `email` | UNIQUE (PK) |
| `idx_participants_device` | `device_id` | btree |

#### 外鍵

無（被 `coupons.email`、`lottery_entries.email` 反向參照）

#### CHECK 約束

無

#### RLS 政策

| 政策名稱 | 操作 | 角色 | USING | WITH CHECK | 實務意義 |
|---|---|---|---|---|---|
| Anyone can read participant | SELECT | public | `true` | — | 任何人可讀取（用於前端查詢自己 email） |
| Anyone can insert participant | INSERT | public | — | `true` | 任何人可註冊 |
| Anyone can update participant language/device | UPDATE | public | `true` | `true` | 任何人可更新語系與裝置 |

> ⚠️ 無 DELETE 政策 → 一般 `anon` 角色無法刪除 participant

#### Triggers

| Trigger 名稱 | 時機 | 函式 | 說明 |
|---|---|---|---|
| `update_participants_updated_at` | BEFORE UPDATE | `update_updated_at_column()` | 自動更新 `updated_at` |
| `trg_assign_coupons_on_participant` | AFTER INSERT | `assign_coupons_to_participant()` | 新增參與者後自動配發優惠券 |

---

### Table: `lottery_entries`

- **用途**：儲存所有抽獎登錄紀錄（每張交易券號一筆）
- **Primary Key**：`id`
- **Row Count 預估**：等於上傳的有效交易券號數量

#### 欄位規格

| 欄位名 | 型別 | Nullable | 預設值 | Unique | PK | FK | 說明 |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | ✓ (PK) | ✓ | — | 主鍵 |
| `tn_number` | `text` | NO | — | ✓ | — | — | 交易券號（格式由前端 `TN_FORMAT` 控制，目前 `^[A-Z]{2}\d{10}$`） |
| `email` | `text` | NO | — | — | — | → `participants.email` ON DELETE CASCADE | 登錄者 |
| `raw_payload` | `text` | YES | — | — | — | — | QR 原始字串（`source = 'qr'` 時使用） |
| `source` | `text` | NO | `'manual'` | — | — | — | 來源：`'manual'` 或 `'qr'`（無 CHECK 約束，由前端控制） |
| `created_at` | `timestamptz` | NO | `now()` | — | — | — | 登錄時間 |

#### 索引

| Index 名稱 | 欄位 | 類型 |
|---|---|---|
| `lottery_entries_pkey` | `id` | UNIQUE (PK) |
| `lottery_entries_tn_number_key` | `tn_number` | UNIQUE |
| `idx_lottery_email` | `email` | btree |

#### 外鍵

| 來源欄位 | 目標 | ON DELETE | ON UPDATE |
|---|---|---|---|
| `email` | `participants.email` | CASCADE | NO ACTION |

#### CHECK 約束

無

#### RLS 政策

| 政策名稱 | 操作 | 角色 | USING | WITH CHECK | 實務意義 |
|---|---|---|---|---|---|
| Anyone can read lottery entries | SELECT | public | `true` | — | 任何人可讀（含他人紀錄）⚠️ |
| Anyone can insert lottery entry | INSERT | public | — | `true` | 任何人可登錄 |

> ⚠️ 無 UPDATE / DELETE 政策

#### Triggers

無

#### 重複登錄的後端行為

- `tn_number` 為 UNIQUE → 重複插入會回傳 PostgreSQL 錯誤碼 `23505`
- 前端 `src/lib/api.ts` 的 `submitLotteryEntry` 會把 `23505` 翻譯成 `{ alreadyUsed: true }`
- ⚠️ **測試模式**：`isTestTn(tn)` 為真的測試券號會被加上 `__t<timestamp>` 後綴繞過唯一檢查（上線前需移除，見 `docs/PRODUCTION_CHECKLIST.md`）

---

### Table: `coupons`

- **用途**：儲存所有優惠券（由 trigger 在參與者註冊後自動產生）
- **Primary Key**：`coupon_code`
- **Row Count 預估**：每位 participant × `coupon_allocation_rules` 中所有啟用規則的 `quantity_per_participant` 總和

#### 欄位規格

| 欄位名 | 型別 | Nullable | 預設值 | Unique | PK | FK | 說明 |
|---|---|---|---|---|---|---|---|
| `coupon_code` | `text` | NO | — | ✓ (PK) | ✓ | — | 優惠券碼（trigger 產生：`prefix + YYMMDD + 8 位隨機數字`） |
| `email` | `text` | YES | — | — | — | → `participants.email` ON DELETE CASCADE | 配發給的使用者，可為 NULL（預發但未指派） |
| `assigned_at` | `timestamptz` | YES | — | — | — | — | 配發時間 |
| `used_at` | `timestamptz` | YES | — | — | — | — | 使用時間，NULL 表示未使用 |
| `note` | `text` | YES | — | — | — | — | 備註（從規則表帶入） |
| `created_at` | `timestamptz` | NO | `now()` | — | — | — | 建立時間 |

#### 索引

| Index 名稱 | 欄位 | 類型 |
|---|---|---|
| `coupons_pkey` | `coupon_code` | UNIQUE (PK) |
| `idx_coupons_email` | `email` | btree |

#### 外鍵

| 來源欄位 | 目標 | ON DELETE | ON UPDATE |
|---|---|---|---|
| `email` | `participants.email` | CASCADE | NO ACTION |

#### CHECK 約束

無

#### RLS 政策

| 政策名稱 | 操作 | 角色 | USING | WITH CHECK | 實務意義 |
|---|---|---|---|---|---|
| Anyone can read coupons | SELECT | public | `true` | — | 任何人可讀（前端依 email 過濾）⚠️ |

> ⚠️ 無 INSERT / UPDATE / DELETE 政策 → 寫入只能透過 `SECURITY DEFINER` 的 trigger function

#### Triggers

無（被 `participants` 的 trigger 寫入）

---

### Table: `coupon_allocation_rules`

- **用途**：定義「新使用者註冊後，要自動配發哪些優惠券、各幾張」
- **Primary Key**：`id`
- **Row Count 預估**：規則數量（通常 1～10 筆）

#### 欄位規格

| 欄位名 | 型別 | Nullable | 預設值 | Unique | PK | FK | 說明 |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | ✓ (PK) | ✓ | — | 主鍵 |
| `rule_name` | `text` | NO | — | — | — | — | 規則名稱（內部識別用） |
| `coupon_prefix` | `text` | NO | — | — | — | — | 產生優惠券碼時使用的前綴 |
| `quantity_per_participant` | `integer` | NO | `1` | — | — | — | 每位參與者要發幾張 |
| `is_active` | `boolean` | NO | `true` | — | — | — | 是否啟用此規則 |
| `note` | `text` | YES | — | — | — | — | 備註，會寫入 `coupons.note` |
| `created_at` | `timestamptz` | NO | `now()` | — | — | — | 建立時間 |

#### 索引

| Index 名稱 | 欄位 | 類型 |
|---|---|---|
| `coupon_allocation_rules_pkey` | `id` | UNIQUE (PK) |

#### 外鍵 / CHECK

無

#### RLS 政策

| 政策名稱 | 操作 | 角色 | USING | 實務意義 |
|---|---|---|---|---|
| Anyone can read allocation rules | SELECT | public | `true` | 任何人可讀 |

> 無 INSERT / UPDATE / DELETE 政策 → 只能透過 SQL migration 或 dashboard 改動

#### Triggers

無

---

### Table: `winners`

- **用途**：抽獎結果公告（活動結束後寫入）
- **Primary Key**：`id`
- **Row Count 預估**：得獎者人數（含備取）

#### 欄位規格

| 欄位名 | 型別 | Nullable | 預設值 | Unique | PK | FK | 說明 |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | ✓ (PK) | ✓ | — | 主鍵 |
| `prize_name` | `text` | NO | — | — | — | — | 獎項名稱 |
| `masked_email` | `text` | NO | — | — | — | — | 已遮罩的 email（隱私保護，例如 `a***@gmail.com`） |
| `rank` | `integer` | NO | `1` | — | — | — | 名次（前端依此排序） |
| `is_backup` | `boolean` | NO | `false` | — | — | — | 是否為備取 |
| `announced_at` | `timestamptz` | NO | `now()` | — | — | — | 公告時間 |

#### 索引

| Index 名稱 | 欄位 | 類型 |
|---|---|---|
| `winners_pkey` | `id` | UNIQUE (PK) |

#### 外鍵 / CHECK

無

#### RLS 政策

| 政策名稱 | 操作 | 角色 | USING | 實務意義 |
|---|---|---|---|---|
| Anyone can read winners | SELECT | public | `true` | 公開公告，任何人可讀 |

> 無 INSERT / UPDATE / DELETE 政策

#### Triggers

無

---

## 3. 資料庫函式（Functions）

### `update_updated_at_column()`

- **語言**：PL/pgSQL
- **回傳**：trigger
- **SECURITY**：INVOKER（預設）
- **search_path**：`public`
- **用途**：通用 trigger function，在 BEFORE UPDATE 時把 `NEW.updated_at` 設為 `now()`
- **目前掛載**：`participants.update_participants_updated_at`

```sql
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
```

### `assign_coupons_to_participant()`

- **語言**：PL/pgSQL
- **回傳**：trigger
- **SECURITY**：**DEFINER**（以 owner 權限執行，可繞過 RLS 寫入 `coupons`）
- **search_path**：`public`
- **用途**：新參與者註冊後自動配發優惠券
- **執行流程**：
  1. 若非 INSERT 操作 → 直接返回
  2. 若該 email 已有 `coupons` 紀錄 → 跳過（避免重複配發）
  3. 讀取所有 `coupon_allocation_rules` 中 `is_active = true` 的規則
  4. 對每條規則，依 `quantity_per_participant` 迴圈產生優惠券碼：
     `coupon_prefix + YYMMDD + 4 位隨機 + 4 位隨機`
  5. INSERT 至 `coupons`，遇到 `coupon_code` 衝突則 `ON CONFLICT DO NOTHING`

---

## 4. Triggers 總覽

| Table | Trigger | 時機 | 函式 |
|---|---|---|---|
| `participants` | `update_participants_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `participants` | `trg_assign_coupons_on_participant` | AFTER INSERT | `assign_coupons_to_participant()` |

---

## 5. Enums / 自訂型別

目前**無**任何自訂 enum 或 composite type。

- `lottery_entries.source` 雖然語意上只接受 `'manual'` / `'qr'`，但實際是 `text` 沒有 CHECK 也沒有 enum，由前端控制。
- `participants.language` 同理（語意上是 `zh` / `en` / `ja` / `ko`）。

---

## 6. Storage Buckets

**無**任何 Supabase Storage bucket。所有資料皆存於 PostgreSQL 表內。

---

## 7. 已知資料完整性風險（提醒區）

| 編號 | 項目 | 嚴重性 | 說明 | 建議 |
|---|---|---|---|---|
| R1 | ~~`participants` 上有兩個重複 trigger~~ | ✅ 已修正 | 已於 migration 中刪除 `trg_assign_coupons_after_participant_insert` | — |
| R2 | ~~`lottery_entries.tn_number` 有兩個重複 UNIQUE index~~ | ✅ 已修正 | 已於 migration 中刪除 `lottery_entries_tn_number_unique` | — |
| R3 | RLS 政策**全部開放 public** | **高** | 任何匿名使用者皆可讀 `coupons` / `lottery_entries` / `participants` 全表 | 上線前應改為「依 email match auth.uid() 或 session」收緊 |
| R4 | `participants` 無 DELETE 政策 | 低 | 一般匿名角色無法刪除帳號（GDPR / 個資法刪除權需求） | 視業務需求決定是否新增 admin-only 政策 |
| R5 | `coupons.email` nullable | 低 | 允許未指派的優惠券存在（設計上可能是預留功能） | 若不需要可加 `NOT NULL` |
| R6 | `lottery_entries.source` 無 CHECK | 低 | 前端可寫入任意字串 | 可加 `CHECK (source IN ('manual','qr'))` |
| R7 | 測試模式（test mode）TN 後綴繞過 | **高** | `src/lib/api.ts` 在 `isTestTn` 為真時會把 TN 加 `__t<timestamp>` 後綴避開唯一檢查 | 上線前依 `docs/PRODUCTION_CHECKLIST.md` 移除 |

---

## 8. 與前端 API 對應表

`src/lib/api.ts` 中各方法對應到的資料表 / 欄位，方便日後切換到自家後端時照樣實作。

| API 方法 | HTTP 對應 | 操作 | 表 | 欄位 / 邏輯 |
|---|---|---|---|---|
| `getOrCreateParticipant({ email, device_id, language })` | `POST /participants` | UPSERT | `participants` | `onConflict: 'email'`，回傳 `{ email }` |
| `getMyCoupons({ email })` | `GET /coupons?email=...` | SELECT | `coupons` | `WHERE email = $1`，回傳 `Coupon[]` |
| `submitLotteryEntry({ tn, email, raw_payload, source })` | `POST /lottery/submit` | INSERT | `lottery_entries` | 先驗 `TN_FORMAT.pattern`；遇 23503 自動補 participant 後重試；遇 23505 回 `{ alreadyUsed: true }` |
| `getWinners()` | `GET /winners` | SELECT | `winners` | `ORDER BY rank ASC` |

### 前端關鍵設定常數

| 常數 | 位置 | 預設值 | 用途 |
|---|---|---|---|
| `TN_FORMAT.pattern` | `src/lib/api.ts` | `/^[A-Z]{2}\d{10}$/` | 前端與後端共用的 TN 格式驗證 |
| `TN_FORMAT.letters` | 同上 | `2` | 字母位數 |
| `TN_FORMAT.digits` | 同上 | `10` | 數字位數 |
| `isTestTn()` | `src/lib/test-mode.ts` | — | 判斷是否為測試券號（demo 用） |

---

## 附錄 A：完整重建 SQL（精簡版）

若要在新環境重建 schema，可參考以下精簡 SQL（實際請以 `supabase/migrations/` 為準）：

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

-- coupons
CREATE TABLE public.coupons (
  coupon_code text PRIMARY KEY,
  email       text REFERENCES public.participants(email) ON DELETE CASCADE,
  assigned_at timestamptz,
  used_at     timestamptz,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupons_email ON public.coupons(email);

-- coupon_allocation_rules
CREATE TABLE public.coupon_allocation_rules (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name                text NOT NULL,
  coupon_prefix            text NOT NULL,
  quantity_per_participant integer NOT NULL DEFAULT 1,
  is_active                boolean NOT NULL DEFAULT true,
  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

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

RLS、Triggers、Functions 的建立 SQL 請見 `supabase/migrations/`。
