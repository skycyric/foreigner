
使用者在 Cloud view 的 participants 表想刪除幾筆資料，但 UI 產生的 SQL 用了 `id` 欄位 — 而我們的 `participants` 表主鍵是 `email`，根本沒有 `id` 欄位（schema 確認：只有 email / device_id / language / created_at / updated_at）。

這不是程式 bug，是 Lovable Cloud 內建表格 UI 預設用 `id` 當識別欄，但我們刻意用 `email` 當主鍵（避免 auth.users FK 限制）。所以那個刪除按鈕對 participants 表不適用。

## 解法選項

**選項 A — 手動 SQL 刪除（建議，最快）**
直接在 Cloud → SQL Editor 執行：
```sql
DELETE FROM participants WHERE email IN ('test1@example.com', 'test2@example.com');
```
或用條件批次清測試資料：
```sql
DELETE FROM participants WHERE email LIKE '%test%';
```
注意 coupons / lottery_entries 有 FK 指向 participants.email，需要先清子表，或者改用 CASCADE：
```sql
DELETE FROM lottery_entries WHERE email = 'xxx@example.com';
DELETE FROM coupons WHERE email = 'xxx@example.com';
DELETE FROM participants WHERE email = 'xxx@example.com';
```

**選項 B — 加一個 id 欄位讓 UI 能用**
新增 `id uuid default gen_random_uuid()` 欄位（保留 email 為 unique）。代價：
- 要寫一支 migration
- 程式碼還是用 email 做關聯，新欄位純粹只為了讓 Cloud UI 的刪除鈕能動
- 多一欄沒實質用途的資料

**選項 C — 都不動，未來都用 SQL Editor 處理 participants**
告知此 UI 限制，之後刪 participants 都走 SQL。

## 我的建議

走 **選項 A**：用 SQL 刪除，因為：
1. 一次性需求，不值得改 schema
2. 加 id 欄位純粹為了遷就 UI，會讓 schema 變複雜
3. 你之後正式上線清測試資料時，本來就建議用 SQL（更精準、可附條件）

如果你常常要刪測試資料，我可以幫你在後台加一個簡單的 admin 頁面，這比改 schema 更乾淨。

## 要我幫你做什麼

請告訴我你想刪哪幾筆 participants（提供 email），我可以：
1. 直接幫你執行對應的 DELETE SQL（包含先清 coupons / lottery_entries 子表）
2. 或者你自己去 Cloud → SQL Editor 貼上面的 SQL 執行

如果你選 1，請貼上要刪的 email；如果你想批次清所有測試資料（例如某 prefix），也告訴我規則。
