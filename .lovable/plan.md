## 調整內容

### 1. Header 改用 RICHCLUB Logo
- 將上傳的 `RICHCLUB_雙LOGO-06.jpg` 透過 lovable-assets 上架為 CDN 圖片（不放進 repo），import pointer JSON 後在 Header 使用
- 移除 Header 內的 `Gift` icon 和 `t("brand")` 文字
- Logo 置中顯示在橫幅（黑底白字 logo，header 背景改為深色以配合 logo，或保留卡片底色但 logo 仍清晰；建議 header 改為黑底）
- 返回箭頭維持在左側
- **語言切換從 header 右側移除**，改放到 header 下方（PageShell 內，main 上方）置右顯示

### 2. 首頁標題上方 icon 移除
- `src/routes/$lang.index.tsx` 中「昇恆昌購物回饋折扣券 立即登錄抽好禮」上方的 icon 拿掉（保留標題與 CTA）

### 技術細節
- 新增 `src/assets/richclub-logo.jpg.asset.json`（lovable-assets pointer）
- 修改 `src/components/Header.tsx`：
  - Header bar：左=返回鈕（或佔位）、中=Logo `<img>`、右=空白佔位（維持置中）
  - 移除 `<select>` 語言切換
  - 新增一個 sub-bar（在 header 下方或 PageShell 頂部）放語言切換 select，右對齊
- 修改 `src/routes/$lang.index.tsx`：移除標題上方的 icon 區塊

### 不更動
- 翻譯字串 `brand` 暫不刪除（其他地方可能仍引用 meta），但 Header 不再顯示
- BACK_MAP 與返回邏輯不變
