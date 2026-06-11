# 搬遷版部署指南

本前端已調整為對接昇恆昌 `events.everrich-group.com` 後端的搬遷版本。
Supabase / Lovable Cloud 相關程式已全數移除。

## 部署假設

前端打包後與後端 **same-origin** 部署：

- 例：`https://events.everrich-group.com/luckydraw/` (前端)
- 後端 API：`https://events.everrich-group.com/landing/eventpost.php`

前端打的是相對路徑 `/landing/eventpost.php`，所以不需要 CORS 設定。
若部署到不同網域必須由維運在 nginx / reverse proxy 處理 CORS 或反向代理。

## 後端 API 規格

```
POST /landing/eventpost.php
Content-Type: application/x-www-form-urlencoded

lang_type=tw            # tw / en / jp / kr
eventName=EmailLuckyDraw2026
upload_data={"Email":"user@example.com","NoteText":"YA2101223580"}
```

- 後端不回 status code（皆 200）/ 不檢查格式 / 不檢查重複
- 成功判定：HTTP 2xx
- TN 格式檢查 (`^[A-Z]{2}\d{10}$`) 由前端負責
- 重複登錄由前端用 localStorage 黑名單擋

## 部署 build

TanStack Start 預設輸出 Cloudflare Workers SSR bundle。內網部署若要純靜態：

- **方案 A**：用 Node runtime 跑 `node .output/server/index.mjs`
- **方案 B**：改為純 SPA build（需手動調整 `vite.config.ts`，捨棄 SSR/SEO）

## 已知限制

- **重複登錄純靠 localStorage** — 清快取／換瀏覽器會繞過
- **無中獎名單頁** — 後端無 API
- **無回應錯誤可參考** — 任何非 2xx 都拋通用錯誤

## 程式進入點

`src/lib/api.ts` 是唯一對外 API 入口。要改 endpoint、event name、欄位映射只動這檔。