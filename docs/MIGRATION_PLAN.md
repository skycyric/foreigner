# 內網搬遷計畫（Migration Plan）

本系統現階段以 **Lovable Cloud（Supabase）** 作為過渡期後端。
上線前將整體搬到公司內網（參考 `events.everrich-group.com/luckydraw*` 架構：
前端靜態頁 + 公司提供的 REST API）。

本文件說明搬遷時要動哪些檔案，以及目前已預留的抽象點。

---

## 一、抽象規則

**所有對外資料存取唯一入口** = `src/lib/api.ts`

- UI 元件 / 路由 **只能** `import { api } from "@/lib/api"`，禁止直接 `import { supabase }`
- 搬遷時只動 `src/lib/api.ts` 內部實作，UI 完全不用改
- 已預留 `VITE_API_BASE_URL` 環境變數開關：設了就走 `fetch(BASE + path)`，沒設就走 Supabase

## 二、優惠券（已搬完）

- 3 組固定券號（`97E51126A6002000` / `97E51126A1008000` / `97E51126F1003000`）
  存於 `src/lib/coupons.ts` 常數，**非資料庫**
- 搬遷時跟著前端原樣帶走，**零成本**

## 三、搬遷時要做的事

### 1. 替換 `src/lib/api.ts` 內部實作

| 方法 | 目前實作 | 內網實作（預期） |
|---|---|---|
| `getOrCreateParticipant` | `supabase.from("participants").upsert(...)` | `POST {BASE}/participants` |
| `submitLotteryEntry` | `supabase.from("lottery_entries").insert(...)`，23505 → alreadyUsed | `POST {BASE}/lottery/submit`，HTTP 409 → alreadyUsed |
| `getWinners` | `supabase.from("winners").select(...)` | `GET {BASE}/winners` |

設好 `VITE_API_BASE_URL` 後，`USE_REMOTE_API` 自動為 true，現有 `remote()` helper 就會生效。

### 2. 環境變數

| 名稱 | 用途 |
|---|---|
| `VITE_API_BASE_URL` | 公司 API base URL（例：`https://events.everrich-group.com/api`） |

搬遷後可移除：`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`VITE_SUPABASE_PROJECT_ID`

### 3. 移除 Supabase 相依

確認 `USE_REMOTE_API` 都走通後：
- `bun remove @supabase/supabase-js`
- 刪除 `src/integrations/supabase/` 整個資料夾
- 刪除 `supabase/` 資料夾（migrations、config.toml）
- 移除 `src/lib/api.ts` 內所有 Supabase 分支與 `import { supabase }`
- 移除 `src/lib/server-identity.ts`（若內網用 session cookie，需重寫）

### 4. 部署

- 公司內網通常用 Nginx / IIS 託管靜態檔
- 本專案為 TanStack Start（含 SSR Worker）。內網部署需確認：
  - **方案 A**：改為純 SPA build（`vite build`，輸出 `dist/`），所有頁面走 client-side render。會失去 SSR / SEO，但內網活動頁通常不需要 SEO。
  - **方案 B**：內網提供 Node runtime，跑 `node .output/server/index.mjs`。

## 四、未來公司 API 預期 endpoint（建議規格）

```text
POST {BASE}/participants
  body: { email, device_id, language }
  → 200 { email }

POST {BASE}/lottery/submit
  body: { tn, email, raw_payload?, source: "manual"|"qr" }
  → 200 { id }
  → 409 { alreadyUsed: true }
  → 400 INVALID_TN_FORMAT

GET  {BASE}/winners
  → 200 [{ id, prize_name, masked_email, rank, is_backup }]
```

## 五、檢查清單（搬遷當天）

- [ ] `VITE_API_BASE_URL` 設定完成
- [ ] 公司 API 三支 endpoint 全部可通
- [ ] 移除測試模式（見 `docs/PRODUCTION_CHECKLIST.md` R7）
- [ ] 移除 Supabase 相依
- [ ] /coupons、/scan、/manual、/winners 流程完整跑過