# 上線前清單

## 1. 部署

- 前端 build 後的靜態檔放到 `events.everrich-group.com/luckydraw*` 路徑下
- 必須與後端 same-origin，否則 `POST /landing/eventpost.php` 會 CORS 失敗

## 2. 驗證

- [ ] 首頁可進入並切換語言（zh / en / ja / ko）
- [ ] welcome 頁輸入 email 後跳到 coupons 頁
- [ ] 掃描 / 手動輸入交易單後送出，DevTools Network 可看到 `POST /landing/eventpost.php` 回 2xx
- [ ] 同一筆 TN 第二次送出顯示「已使用」（localStorage 黑名單運作）
- [ ] result 頁顯示完整 TN，無 `__t...` 後綴

## 3. 其他

- [ ] 關閉所有 `console.log` debug 訊息
- [ ] 確認 i18n 各語言翻譯完整
- [ ] 確認 logo、條款、活動辦法文案最終版