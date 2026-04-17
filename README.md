# Lucky Draw — 抽獎活動網站

行動優先的抽獎活動網站，支援中／英／日／韓四語，採純靜態 SPA 部署。

## 功能

- Email 登錄（帳號 + 網域 chip 選擇，避免手動輸入 `@`）
- 自動以 `device_id`（localStorage）+ Email 識別參與者
- Code128 一維折扣券條碼顯示（jsbarcode）
- 交易單 QR Code 掃描（html5-qrcode），自動解析 `T/N^date^amount^store` 格式
- 手動輸入 T/N（兩段式 `[英文 2 碼]-[數字]`，自動跳格、行動裝置數字鍵盤）
- 同一 Email 可登錄多筆交易單，但同一張交易單只能登錄一次
- 中獎名單頁（Email 遮罩 + 候補順位）
- 四語 i18n 切換（zh / en / ja / ko），URL 前綴 `/zh/`、`/en/`…

## 技術棧

- TanStack Start（SPA、`base: './'`）
- Tailwind CSS v4 + shadcn/ui（紅×黃×米白節慶配色）
- react-i18next + 瀏覽器語系自動偵測
- jsbarcode（Code128）+ html5-qrcode（相機）
- Lovable Cloud（Postgres + RLS）— 預設後端

## API 抽象層

所有後端呼叫集中在 `src/lib/api.ts`：

```ts
api.getOrCreateParticipant({ email, device_id, language })
api.getMyCoupons({ email })
api.lookupTransaction({ tn })
api.submitLotteryEntry({ tn, email, raw_payload?, source })
api.getWinners()
```

### 切換到貴司自家後端

設定 `VITE_API_BASE_URL` 環境變數，build 時即會改走外部 REST API：

```bash
VITE_API_BASE_URL=https://your-api.everrich-group.com/api npm run build
```

預期端點規格（JSON）：

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/participants` | `{ email, device_id, language }` | `{ email }` |
| GET  | `/coupons?email=...` | — | `Coupon[]` |
| GET  | `/lottery/lookup?tn=...` | — | `{ found, alreadyUsed, amount?, date? }` |
| POST | `/lottery/submit` | `{ tn, email, raw_payload?, source }` | `{ id }` |
| GET  | `/winners` | — | `Winner[]` |

## 部署到貴司主機（events.everrich-group.com）

1. `npm run build` 產出 `dist/` 資料夾。
2. 將整個 `dist/` 內容上傳到主機任意子目錄，例：`/luckydraw2026/`。
3. 設定主機 SPA fallback（將該子目錄底下所有 404 rewrite 到 `index.html`）：

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

4. 進入 `https://events.everrich-group.com/luckydraw2026/`，瀏覽器會自動依語系跳轉到 `/zh/`、`/en/` 等子路徑。

## 後台資料管理（第一版）

直接於 Lovable Cloud Studio 編輯資料表：

- `participants` — 報名者
- `coupons` — 折扣券（先匯入 coupon_code，再以 UPDATE 綁定 email）
- `lottery_entries` — 抽獎登錄紀錄
- `valid_transactions` — 合法交易單（mock；未來改接貴司 ERP）
- `winners` — 中獎名單
