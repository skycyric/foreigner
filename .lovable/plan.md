
## 目標

產出一份完整的資料庫 schema 規格文件，涵蓋本專案所有資料表的欄位定義、約束、索引、RLS、觸發器、函式，方便交接給後端工程師或做為對接 API 的依據。

## 產出物

新增一份文件：`docs/DATABASE_SCHEMA.md`

內容結構如下（中英對照欄位名稱，純文字 + Markdown 表格，不依賴額外工具即可閱讀）：

### 1. 概覽
- 資料庫：PostgreSQL（Lovable Cloud / Supabase）
- 5 張資料表：`participants`、`lottery_entries`、`coupons`、`coupon_allocation_rules`、`winners`
- ER 關聯圖（ASCII）：

```text
participants (email PK)
   │
   ├──< lottery_entries (email FK)
   │
   └──< coupons (email FK)

coupon_allocation_rules (獨立規則表，被 trigger 讀取)

winners (獨立公告表)
```

### 2. 每張資料表的詳細規格

每張表用統一格式呈現：

#### Table: `<table_name>`
- **用途**：一句話說明
- **Primary Key**：欄位
- **Row Count 預估**：說明（例如「每位參與者一筆」）

**欄位規格表**：

| 欄位名 | 型別 | Nullable | 預設值 | Unique | PK | FK | 說明 |
|---|---|---|---|---|---|---|---|

**索引（Indexes）**：列出所有索引（透過 `pg_indexes` 查詢確認）

**外鍵（Foreign Keys）**：來源欄位 → 目標表.欄位、ON DELETE / ON UPDATE 行為

**CHECK 約束**：若有

**RLS 政策**：政策名稱、操作（SELECT/INSERT/UPDATE/DELETE）、角色、USING / WITH CHECK 表達式、實務意義

**Triggers**：列出綁在此表的 trigger

### 3. 資料庫函式（Functions）

- `update_updated_at_column()`：用途、語言、SECURITY 模式
- `assign_coupons_to_participant()`：用途、執行時機、邏輯流程（讀規則表 → 依規則數量產生唯一碼 → 寫入 coupons）

### 4. Triggers 總覽

從 `information_schema.triggers` 撈出實際存在的 trigger（目前 `<db-triggers>` 顯示為空，但 `assign_coupons_to_participant` 是 trigger function，需驗證是否真的有掛上）。

### 5. Enums / Custom Types

目前無，明確標註「無自訂型別」。

### 6. Storage Buckets

無。

### 7. 已知資料完整性風險（提醒區）

- `coupons.email` nullable + FK → 未指派的優惠券允許 email 為 NULL
- `lottery_entries.tn_number` 沒有 unique 約束（從 schema 看起來），但 `api.ts` 依賴 `23505` 判斷重複 → **需驗證是否有 unique index**
- RLS 全部開放 `public` 讀寫 → 上線前需收緊
- `participants` 沒有 DELETE policy → 無法刪除參與者

### 8. 與前端 / API 對應

附上 `src/lib/api.ts` 中各 API 對應到哪張表 / 哪些欄位的對照表，方便日後切換到自家後端 API 時照樣實作。

---

## 執行步驟

1. 用 `supabase--read_query` 執行以下查詢補完目前 schema 文件缺少的資訊：
   - `information_schema.table_constraints` + `key_column_usage`：抓 PK / UNIQUE / FK 約束
   - `pg_indexes`：抓所有索引（特別確認 `lottery_entries.tn_number` 是否有 unique index）
   - `information_schema.triggers`：抓真正掛載的 trigger
   - `information_schema.check_constraints`：抓 CHECK 約束
2. 結合 `<supabase-tables>` 已知資訊 + 上述查詢結果，撰寫 `docs/DATABASE_SCHEMA.md`
3. 文件以繁體中文撰寫（與專案其他文件風格一致），欄位名 / 型別 / SQL 保留英文

## 不會動到

- 任何資料表結構（純文件產出）
- 任何 RLS / 函式 / Trigger
- 任何前端程式碼
