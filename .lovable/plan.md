

確認三個關鍵決定後，鎖定最終架構：

## 確認結論
1. **後端**：Lovable Cloud 當 API（前端靜態檔丟到貴司主機呼叫 Lovable Cloud endpoint），但所有 API 呼叫集中在 `src/lib/api.ts` 一個檔案，並透過 `VITE_API_BASE_URL` 環境變數切換 → 之後要換成貴司自家後端，只要改檔案 + 重新 build 即可。
2. **路由**：採用參考站可接受的模式 → **History 路由**（`/welcome`、`/coupons`…），由貴司主機設 SPA fallback（rewrite 全部到 `index.html`）；同時 Vite `base: './'` 確保資源路徑相對。
3. **部署位置**：`https://events.everrich-group.com/<活動子目錄>/`，子目錄底下會有不同語系。

## 語系架構（重點調整）
依「子目錄裡面會有不同語系的 html 檔」這句話：
- 採用 **單一 SPA + URL 語系前綴**：`/zh/`、`/en/`、`/ja/`、`/ko/`
- 路由結構：`/$lang/welcome`、`/$lang/coupons`…，根目錄 `/` 自動依 `navigator.language` 重導到對應語系
- 每個語系頁面有獨立 URL 可分享（符合「不同語系的 html」精神，雖然實際是 SPA 動態渲染）
- 每個語系獨立 `<head>` meta（title / description / og:locale），對 SEO 與社群分享友善

## 最終技術棧
- TanStack Start（History 路由、`base: './'`、SPA build）
- Lovable Cloud（5 張表 + RLS + server functions 對外暴露為 API）
- `react-i18next`（zh / en / ja / ko 四份 JSON）
- `jsbarcode`（Code128）+ `html5-qrcode`（相機掃 QR）
- shadcn/ui + Tailwind（紅×黃節慶配色）

## 路由清單
```
/                          → 自動偵測語系 redirect 到 /zh|en|ja|ko/
/$lang/                    → 首頁（主視覺 + 立即登錄 CTA）
/$lang/welcome             → Email 輸入（拆帳號 + 網域 chip + 條款勾選）
/$lang/coupons             → 我的 Code128 折扣券 + 抽獎入口
/$lang/scan                → 相機掃交易單 QR
/$lang/manual              → 手動輸入 [AA]-[數字]
/$lang/result              → 登記結果
/$lang/about               → 活動辦法
/$lang/terms               → 個資條款
/$lang/winners             → 中獎名單（email 遮罩 + 候補順位）
```

## API 抽象層（核心關鍵）
`src/lib/api.ts` 統一管理所有後端呼叫，介面如下：
```ts
api.getOrCreateParticipant({ email, device_id, language })
api.getMyCoupons({ email })
api.lookupTransaction({ tn })
api.submitLotteryEntry({ tn, raw_payload, source, email })
api.getWinners()
```
- 預設 implementation 走 Lovable Cloud server functions
- 留 `VITE_USE_MOCK=true` 開關可切到純前端 mock，方便離線測試
- 之後換貴司 API 時只要改 `api.ts` 內每個方法的 `fetch` URL 與 payload mapping

## 資料模型（Lovable Cloud）
- `participants`：email PK / device_id / language / created_at
- `coupons`：coupon_code unique / email / assigned_at
- `lottery_entries`：tn_number unique / email / raw_payload / source / created_at
- `valid_transactions`（mock）：tn_number / amount / date
- `winners`：prize_name / masked_email / rank / is_backup

## 部署交付物
- `dist/` 資料夾（含 `index.html` + 相對路徑資源）
- `README.md`：放置子目錄、設定主機 SPA fallback、設定 API base URL 三步驟
- 後台 CSV 匯入頁（管理用，第一版可用 Lovable Cloud Studio 直接編輯資料表代替）

## 實作順序
1. 設計 token（紅／黃／米白）+ Vite `base: './'` 設定
2. 路由骨架（`$lang` 動態 segment + 自動 redirect）
3. i18n 四語檔骨架 + 語言切換器
4. 啟用 Lovable Cloud + 5 張表 + server functions
5. `src/lib/api.ts` 抽象層
6. 核心頁：welcome / coupons / scan / manual / result
7. 內容頁：about / terms / winners
8. 種 mock 資料 + 行動裝置 QA

