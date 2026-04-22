# Lucky Draw — 抽獎活動網站

行動優先的抽獎活動網站，支援中／英／日／韓四語，採純靜態 SPA 部署。

## 功能

- Email 登錄：兩種輸入模式（Tabs 切換）
  - **快速選擇網域**：account 輸入框 + 5 組常用網域 chip，避免手動敲 `@`
  - **自行輸入 Email**：標準 `<input type="email" autocomplete="email">`，相容 autofill / 密碼管理員
  - 強化「擷取確認卡」：放大、品牌色框、`CheckCircle2` 圖示，送出前必看見
  - Autofill / 貼上偵測：自動跳 toast、卡片 1.5s 閃爍、smooth scroll 到確認卡
  - 常見 typo 網域偵測（gmial / hotnail / yahoo.cm…）即時提示一鍵修正
- 自動以 `device_id`（localStorage）+ Email 識別參與者；回訪者直接跳到優惠券頁
- Code128 一維折扣券條碼顯示（jsbarcode）
- 交易單 QR Code 掃描（@zxing/browser + @zxing/library），自動解析 `T/N^date^amount^store` 格式，支援相機與相片上傳
- 手動輸入 T/N（格式集中於 `src/lib/api.ts` 的 `TN_FORMAT`，兩段式 `[英文 2 碼]-[數字 10 碼]`，自動跳格、行動裝置數字鍵盤）
- 同一 Email 可登錄多筆交易單，但同一張交易單只能登錄一次（DB unique 約束）
- 中獎名單頁（Email 遮罩 + 候補順位）
- 四語 i18n 切換（zh / en / ja / ko），URL 前綴 `/zh/`、`/en/`…；SSR 端依 cookie / Accept-Language 決定初始語言，client 端 fallback 用 navigator + localStorage
- 全站非同步動作統一 `LoadingOverlay` 遮罩 + 按鈕去抖，避免使用者重複點擊
- 測試模式（`src/lib/test-mode.ts`）：白名單 / 前綴 TN 可重複登錄，方便活動現場 demo

## 技術棧

- TanStack Start v1（React 19 + SSR，部署到 Cloudflare Workers via `@cloudflare/vite-plugin`）
- Vite 7 + TypeScript（strict）
- Tailwind CSS v4 + shadcn/ui
- 檔案式路由（`src/routes/$lang.*.tsx`），語言為 URL 第一段
- TanStack Query（資料快取）
- react-i18next + cookie/Accept-Language SSR 偵測
- jsbarcode（Code128）+ @zxing/browser（QR 掃描）+ html5-qrcode（備援）
- Lovable Cloud（Postgres + RLS）— 預設後端

## API 抽象層

所有後端呼叫集中在 `src/lib/api.ts`，元件層只透過 `api.*` 存取：

```ts
api.getOrCreateParticipant({ email, device_id, language })
api.getMyCoupons({ email })
api.submitLotteryEntry({ tn, email, raw_payload?, source })
api.getWinners()
```

TN 格式集中於同檔案的 `TN_FORMAT` 常數（`letters`, `digits`, `pattern`），改長度只動這裡，scan / manual / API 全部跟著變。

### 切換到公司自家後端

設定 `VITE_API_BASE_URL` 環境變數，build 時即會改走外部 REST API：

```bash
VITE_API_BASE_URL=https://your-api.everrich-group.com/api npm run build
```

預期端點規格（JSON）：

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/participants` | `{ email, device_id, language }` | `{ email }` |
| GET  | `/coupons?email=...` | — | `Coupon[]` |
| POST | `/lottery/submit` | `{ tn, email, raw_payload?, source }` | `{ id, alreadyUsed? }` |
| GET  | `/winners` | — | `Winner[]` |

## 路由結構

- `/` → 依 cookie / Accept-Language 自動跳轉到 `/{lang}`
- `/{lang}` → 首頁（`home.cta` 立即登錄）
- `/{lang}/welcome` → Email 登錄
- `/{lang}/scan` → QR 掃描
- `/{lang}/manual` → 手動輸入 T/N
- `/{lang}/result` → 登錄成功 / 已登錄結果
- `/{lang}/coupons` → 我的優惠券（Code128 條碼）
- `/{lang}/winners` → 中獎名單
- `/{lang}/about`、`/{lang}/terms` → 說明 / 條款

## 資料表

| 表 | 用途 |
|---|---|
| `participants` | 報名者（PK: email；含 device_id, language） |
| `coupons` | 折扣券（先匯入 coupon_code，再以 UPDATE 綁定 email） |
| `coupon_allocation_rules` | 優惠券分配規則（依 coupon_prefix 決定每位參與者領幾張） |
| `lottery_entries` | 抽獎登錄紀錄（tn_number unique） |
| `winners` | 中獎名單（masked_email + rank + is_backup） |

## 部署到公司主機（events.everrich-group.com）

目前部署在 Cloudflare Workers（透過 Lovable 自動部署）。如需自架到公司主機，有兩條路：

### A. 仍用 Cloudflare Workers / 邊緣節點（建議）

使用 `wrangler` 部署 `dist/` 即可。可享 SSR + edge cache，無需處理 SPA fallback。

### B. 改純靜態 SPA 部署

若要丟到 Apache / IIS 子目錄：

1. 在 `vite.config.ts` 切換為 SPA 模式（移除 `@cloudflare/vite-plugin`、改 `base: './'`）。
2. `npm run build` 產出 `dist/` 資料夾。
3. 將整個 `dist/` 內容上傳到主機任意子目錄，例：`/luckydraw2026/`。
4. 設定主機 SPA fallback（將該子目錄底下所有 404 rewrite 到 `index.html`）：

   **Apache** — 在 `luckydraw2026/.htaccess`：
   ```
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /luckydraw2026/
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /luckydraw2026/index.html [L]
   </IfModule>
   ```

   **IIS** — 在 `web.config`：
   ```xml
   <rewrite>
     <rules>
       <rule name="SPA Fallback" stopProcessing="true">
         <match url=".*" />
         <conditions logicalGrouping="MatchAll">
           <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
           <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
         </conditions>
         <action type="Rewrite" url="index.html" />
       </rule>
     </rules>
   </rewrite>
   ```

5. 進入 `https://events.everrich-group.com/luckydraw2026/`，瀏覽器會自動依語系跳轉到 `/zh/`、`/en/` 等子路徑。

## 後台資料管理（第一版）

直接於 Lovable Cloud Studio 編輯資料表：

- `participants` — 報名者
- `coupons` — 折扣券（先匯入 coupon_code，再以 UPDATE 綁定 email）
- `coupon_allocation_rules` — 優惠券分配規則
- `lottery_entries` — 抽獎登錄紀錄
- `winners` — 中獎名單

上線前請務必檢查 `docs/PRODUCTION_CHECKLIST.md`，移除 `src/lib/test-mode.ts` 的測試 TN 白名單。
